/**
 * Synthesis Orchestrator
 * Coordinates the full hypothesis generation pipeline
 */

import Anthropic from '@anthropic-ai/sdk';
import { PipelineContext } from '../context/pipeline-context.js';
import {
  DomainAnalystAgent,
  CrossPollinatorAgent,
  HypothesisSynthesizerAgent,
  HypothesisChallengerAgent,
} from '../agents/index.js';
import {
  UserQuery,
  DomainTag,
  SynthesisOutput,
  RankedHypothesis,
  SUPPORTED_DOMAINS,
} from '../types/index.js';
import { TraceWriter } from '../tracing/trace-writer.js';
import type { TraceMetadata } from '../types/trace.js';

export interface OrchestratorConfig {
  apiKey?: string;
  maxRetries?: number;
  timeoutMs?: number;
  traceEnabled?: boolean;
  traceOutputDir?: string;
  maxTokenBudget?: number;
}

export class BudgetExceededError extends Error {
  constructor(used: number, budget: number) {
    super(`Token budget exceeded: ${used} tokens used, budget is ${budget}`);
    this.name = 'BudgetExceededError';
  }
}

export class SynthesisOrchestrator {
  private readonly client: Anthropic;
  private readonly config: OrchestratorConfig;

  // Agents
  private readonly domainAnalyst: DomainAnalystAgent;
  private readonly crossPollinator: CrossPollinatorAgent;
  private readonly hypothesisSynthesizer: HypothesisSynthesizerAgent;
  private readonly hypothesisChallenger: HypothesisChallengerAgent;

  constructor(config: OrchestratorConfig = {}) {
    this.config = {
      maxRetries: 2,
      timeoutMs: 120000,
      traceEnabled: false,
      traceOutputDir: './traces',
      ...config,
    };

    // Initialize Anthropic client
    this.client = new Anthropic({
      apiKey: config.apiKey || process.env.ANTHROPIC_API_KEY,
    });

    // Initialize agents
    this.domainAnalyst = new DomainAnalystAgent(this.client);
    this.crossPollinator = new CrossPollinatorAgent(this.client);
    this.hypothesisSynthesizer = new HypothesisSynthesizerAgent(this.client);
    this.hypothesisChallenger = new HypothesisChallengerAgent(this.client);
  }

  /**
   * Run the full synthesis pipeline
   */
  async run(query: UserQuery): Promise<SynthesisOutput> {
    // Determine target domain
    const domain = query.targetDomain || this.inferDomain(query.text);

    // Initialize context
    const context = new PipelineContext(query, domain);
    context.log(`Starting synthesis for: "${query.text}"`);
    context.log(`Target domain: ${domain}`);

    // Configure agents with trackers
    this.domainAnalyst.setTracker(context);
    this.domainAnalyst.setTraceCollector(context);
    this.crossPollinator.setTracker(context);
    this.crossPollinator.setTraceCollector(context);
    this.hypothesisSynthesizer.setTracker(context);
    this.hypothesisSynthesizer.setTraceCollector(context);
    this.hypothesisChallenger.setTracker(context);
    this.hypothesisChallenger.setTraceCollector(context);

    try {
      // Stage 1: Domain Analysis
      this.checkBudget(context);
      await this.runDomainAnalysis(context);

      // Stage 2: Cross-Pollination
      this.checkBudget(context);
      await this.runCrossPollination(context);

      // Stage 3: Hypothesis Synthesis
      this.checkBudget(context);
      await this.runHypothesisSynthesis(context);

      // Stage 4: Challenge & Score
      this.checkBudget(context);
      await this.runHypothesisChallenge(context);

      // Write traces if enabled
      if (this.config.traceEnabled) {
        await this.writeTraces(context);
      }

      // Build output
      return this.buildOutput(context);
    } catch (error) {
      context.log(`Pipeline error: ${error}`);
      context.addWarning(`Pipeline failed: ${error}`);

      // Write traces even on error
      if (this.config.traceEnabled) {
        try {
          await this.writeTraces(context);
        } catch (traceError) {
          context.log(`Failed to write traces: ${traceError}`);
        }
      }

      // Return partial results if available
      return this.buildOutput(context);
    }
  }

  /**
   * Stage 1: Domain Analysis
   */
  private async runDomainAnalysis(context: PipelineContext): Promise<void> {
    const startTime = Date.now();
    context.log('Stage 1: Domain Analysis');

    try {
      const analysis = await this.withRetry(() =>
        this.domainAnalyst.execute({
          query: context.query.text,
          domain: context.domain,
          depth: 'standard',
        })
      );

      context.setAnalysis(analysis);
      context.addStage({
        stage: 'domain-analysis',
        status: 'success',
        durationMs: Date.now() - startTime,
        message: `Extracted ${analysis.concepts.length} concepts, ${analysis.methods.length} methods, ${analysis.openProblems.length} problems`,
      });

      context.log(
        `  Found ${analysis.concepts.length} concepts, ${analysis.openProblems.length} problems`
      );
    } catch (error) {
      context.addStage({
        stage: 'domain-analysis',
        status: 'error',
        durationMs: Date.now() - startTime,
        message: String(error),
      });
      throw error;
    }
  }

  /**
   * Stage 2: Cross-Pollination
   */
  private async runCrossPollination(context: PipelineContext): Promise<void> {
    const startTime = Date.now();
    context.log('Stage 2: Cross-Pollination');

    if (!context.analysis) {
      throw new Error('Domain analysis required before cross-pollination');
    }

    try {
      const targetDomains = SUPPORTED_DOMAINS.filter(
        (d) => d !== context.domain
      );

      const result = await this.withRetry(() =>
        this.crossPollinator.execute({
          sourceDomain: context.analysis!,
          targetDomains,
          maxConnections: 10,
        })
      );

      context.addConnections(result.connections);
      context.addStage({
        stage: 'cross-pollination',
        status: 'success',
        durationMs: Date.now() - startTime,
        message: `Found ${result.connections.length} cross-domain connections`,
      });

      context.log(`  Found ${result.connections.length} connections`);
    } catch (error) {
      context.addStage({
        stage: 'cross-pollination',
        status: 'error',
        durationMs: Date.now() - startTime,
        message: String(error),
      });
      throw error;
    }
  }

  /**
   * Stage 3: Hypothesis Synthesis
   */
  private async runHypothesisSynthesis(context: PipelineContext): Promise<void> {
    const startTime = Date.now();
    context.log('Stage 3: Hypothesis Synthesis');

    if (context.connections.length === 0) {
      context.addWarning('No connections available for hypothesis synthesis');
      context.addStage({
        stage: 'hypothesis-synthesis',
        status: 'partial',
        durationMs: Date.now() - startTime,
        message: 'Skipped - no connections',
      });
      return;
    }

    try {
      const result = await this.withRetry(() =>
        this.hypothesisSynthesizer.execute({
          connections: context.connections,
          context: context.getSummary(),
          maxHypotheses: 5,
        })
      );

      context.addHypotheses(result.hypotheses);
      context.addStage({
        stage: 'hypothesis-synthesis',
        status: 'success',
        durationMs: Date.now() - startTime,
        message: `Generated ${result.hypotheses.length} hypotheses`,
      });

      context.log(`  Generated ${result.hypotheses.length} hypotheses`);
    } catch (error) {
      context.addStage({
        stage: 'hypothesis-synthesis',
        status: 'error',
        durationMs: Date.now() - startTime,
        message: String(error),
      });
      throw error;
    }
  }

  /**
   * Stage 4: Hypothesis Challenge
   */
  private async runHypothesisChallenge(context: PipelineContext): Promise<void> {
    const startTime = Date.now();
    context.log('Stage 4: Hypothesis Challenge');

    if (context.hypotheses.length === 0) {
      context.addWarning('No hypotheses available for challenge');
      context.addStage({
        stage: 'hypothesis-challenge',
        status: 'partial',
        durationMs: Date.now() - startTime,
        message: 'Skipped - no hypotheses',
      });
      return;
    }

    try {
      const result = await this.withRetry(() =>
        this.hypothesisChallenger.execute({
          hypotheses: context.hypotheses,
        })
      );

      context.setScoredHypotheses(result.scoredHypotheses);
      context.addStage({
        stage: 'hypothesis-challenge',
        status: 'success',
        durationMs: Date.now() - startTime,
        message: `Passed: ${result.summary.passed}, Borderline: ${result.summary.borderline}, Failed: ${result.summary.failed}`,
      });

      context.log(
        `  Passed: ${result.summary.passed}, Borderline: ${result.summary.borderline}, Failed: ${result.summary.failed}`
      );
    } catch (error) {
      context.addStage({
        stage: 'hypothesis-challenge',
        status: 'error',
        durationMs: Date.now() - startTime,
        message: String(error),
      });
      throw error;
    }
  }

  /**
   * Build the final output
   */
  private buildOutput(context: PipelineContext): SynthesisOutput {
    // Rank hypotheses by score
    const rankedHypotheses: RankedHypothesis[] = context.scoredHypotheses
      .filter((h) => h.verdict !== 'fail')
      .sort((a, b) => b.scores.composite - a.scores.composite)
      .map((h, i) => ({
        ...h,
        rank: i + 1,
      }));

    const totalRejected =
      context.hypotheses.length - context.scoredHypotheses.length +
      context.scoredHypotheses.filter((h) => h.verdict === 'fail').length;

    // Get token usage and cost
    const tokenUsage = context.tokenUsage;
    const costEstimate = context.calculateCost();

    return {
      traceId: context.traceId,
      query: context.query.text,
      domain: context.domain,

      hypotheses: rankedHypotheses,

      metadata: {
        totalGenerated: context.hypotheses.length,
        totalValidated: rankedHypotheses.length,
        totalRejected,
        executionTimeMs: context.elapsedMs,
        stages: context.stages,
        tokenUsage: {
          inputTokens: tokenUsage.total.inputTokens,
          outputTokens: tokenUsage.total.outputTokens,
          totalTokens: tokenUsage.total.totalTokens,
        },
        costEstimate: {
          usd: costEstimate.usd,
        },
      },

      warnings: context.warnings,
    };
  }

  /**
   * Check token budget before proceeding
   */
  private checkBudget(context: PipelineContext): void {
    if (!this.config.maxTokenBudget) {
      return;
    }

    const usage = context.tokenUsage;
    const currentTotal = usage.total.totalTokens;

    if (currentTotal > this.config.maxTokenBudget) {
      throw new BudgetExceededError(currentTotal, this.config.maxTokenBudget);
    }
  }

  /**
   * Write traces to disk
   */
  private async writeTraces(context: PipelineContext): Promise<void> {
    const traceDir = this.config.traceOutputDir ?? './traces';
    const writer = new TraceWriter(traceDir);

    const usage = context.tokenUsage;
    const cost = context.calculateCost();

    const metadata: TraceMetadata = {
      traceId: context.traceId,
      query: context.query.text,
      domain: context.domain,
      startTime: context.startTime.toISOString(),
      endTime: new Date().toISOString(),
      totalTokens: {
        inputTokens: usage.total.inputTokens,
        outputTokens: usage.total.outputTokens,
        totalTokens: usage.total.totalTokens,
      },
      costUsd: cost.usd,
    };

    await writer.writeTrace(context.traceId, metadata, context.traces);
    context.log(`Traces written to: ${traceDir}/${context.traceId}`);
  }

  /**
   * Infer domain from query text
   */
  private inferDomain(query: string): DomainTag {
    const lowerQuery = query.toLowerCase();

    // Simple keyword matching
    if (
      lowerQuery.includes('gene') ||
      lowerQuery.includes('protein') ||
      lowerQuery.includes('dna') ||
      lowerQuery.includes('crispr') ||
      lowerQuery.includes('cell') ||
      lowerQuery.includes('drug')
    ) {
      return 'computational-biology';
    }

    if (
      lowerQuery.includes('material') ||
      lowerQuery.includes('polymer') ||
      lowerQuery.includes('nano') ||
      lowerQuery.includes('semiconductor') ||
      lowerQuery.includes('alloy')
    ) {
      return 'materials-science';
    }

    // Default to ML/AI
    return 'ml-ai';
  }

  /**
   * Retry helper with exponential backoff
   */
  private async withRetry<T>(
    fn: () => Promise<T>,
    retries = this.config.maxRetries ?? 2
  ): Promise<T> {
    let lastError: Error | undefined;

    for (let attempt = 0; attempt <= retries; attempt++) {
      try {
        return await fn();
      } catch (error) {
        lastError = error instanceof Error ? error : new Error(String(error));

        if (attempt < retries) {
          const delay = 1000 * Math.pow(2, attempt);
          await new Promise((resolve) => setTimeout(resolve, delay));
        }
      }
    }

    throw lastError;
  }
}
