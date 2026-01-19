/**
 * Pipeline context management for Synthesis Labs
 */

import { randomUUID } from 'crypto';
import type winston from 'winston';
import type {
  UserQuery,
  DomainAnalysis,
  CrossDomainConnection,
  Hypothesis,
  ScoredHypothesis,
  StageResult,
  DomainTag,
} from '../types/index.js';
import type {
  TokenUsage,
  AgentTokenUsage,
  AccumulatedTokenUsage,
  CostEstimate,
  MODEL_PRICING,
} from '../types/tokens.js';
import type { TraceEntry } from '../types/trace.js';
import type { TokenTracker, TraceCollector } from '../agents/base-agent.js';
import { createChildLogger } from '../logging/logger.js';

export interface ContextSummary {
  query: string;
  domain: DomainTag;
  keyConceptsCount: number;
  connectionsCount: number;
  hypothesesCount: number;
  topConcepts: string[];
  topConnections: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export class PipelineContext implements TokenTracker, TraceCollector {
  public readonly traceId: string;
  public readonly startTime: Date;
  public readonly query: UserQuery;
  public readonly domain: DomainTag;

  private readonly _logger: winston.Logger;
  private _analysis: DomainAnalysis | null = null;
  private _connections: CrossDomainConnection[] = [];
  private _hypotheses: Hypothesis[] = [];
  private _scoredHypotheses: ScoredHypothesis[] = [];
  private _stages: StageResult[] = [];
  private _warnings: string[] = [];
  private _tokenUsage: AgentTokenUsage[] = [];
  private _traces: TraceEntry[] = [];

  constructor(query: UserQuery, domain: DomainTag) {
    this.traceId = randomUUID();
    this.startTime = new Date();
    this.query = query;
    this.domain = domain;
    this._logger = createChildLogger({ traceId: this.traceId, domain });
  }

  // ============================================================================
  // Setters
  // ============================================================================

  setAnalysis(analysis: DomainAnalysis): void {
    this._analysis = analysis;
  }

  addConnections(connections: CrossDomainConnection[]): void {
    this._connections.push(...connections);
  }

  addHypotheses(hypotheses: Hypothesis[]): void {
    this._hypotheses.push(...hypotheses);
  }

  setScoredHypotheses(hypotheses: ScoredHypothesis[]): void {
    this._scoredHypotheses = hypotheses;
  }

  addStage(stage: StageResult): void {
    this._stages.push(stage);
  }

  addWarning(warning: string): void {
    this._warnings.push(warning);
  }

  // ============================================================================
  // Token Tracking (implements TokenTracker)
  // ============================================================================

  recordUsage(agent: string, model: string, usage: TokenUsage): void {
    this._tokenUsage.push({
      agent,
      model,
      usage,
      timestamp: new Date().toISOString(),
    });
  }

  // ============================================================================
  // Trace Collection (implements TraceCollector)
  // ============================================================================

  recordTrace(entry: TraceEntry): void {
    this._traces.push(entry);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get analysis(): DomainAnalysis | null {
    return this._analysis;
  }

  get connections(): CrossDomainConnection[] {
    return this._connections;
  }

  get hypotheses(): Hypothesis[] {
    return this._hypotheses;
  }

  get scoredHypotheses(): ScoredHypothesis[] {
    return this._scoredHypotheses;
  }

  get stages(): StageResult[] {
    return this._stages;
  }

  get warnings(): string[] {
    return this._warnings;
  }

  get elapsedMs(): number {
    return Date.now() - this.startTime.getTime();
  }

  get tokenUsage(): AccumulatedTokenUsage {
    const total = {
      inputTokens: 0,
      outputTokens: 0,
      totalTokens: 0,
    };

    const byAgent: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }> = {};
    const byModel: Record<string, { inputTokens: number; outputTokens: number; totalTokens: number }> = {};

    for (const entry of this._tokenUsage) {
      // Total accumulation
      total.inputTokens += entry.usage.inputTokens;
      total.outputTokens += entry.usage.outputTokens;
      total.totalTokens += entry.usage.inputTokens + entry.usage.outputTokens;

      // By agent
      if (!byAgent[entry.agent]) {
        byAgent[entry.agent] = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      }
      byAgent[entry.agent].inputTokens += entry.usage.inputTokens;
      byAgent[entry.agent].outputTokens += entry.usage.outputTokens;
      byAgent[entry.agent].totalTokens += entry.usage.inputTokens + entry.usage.outputTokens;

      // By model
      if (!byModel[entry.model]) {
        byModel[entry.model] = { inputTokens: 0, outputTokens: 0, totalTokens: 0 };
      }
      byModel[entry.model].inputTokens += entry.usage.inputTokens;
      byModel[entry.model].outputTokens += entry.usage.outputTokens;
      byModel[entry.model].totalTokens += entry.usage.inputTokens + entry.usage.outputTokens;
    }

    return {
      total,
      byAgent,
      byModel,
    };
  }

  get traces(): TraceEntry[] {
    return this._traces;
  }

  calculateCost(): CostEstimate {
    const usage = this.tokenUsage;
    let totalUsd = 0;
    const byModel: Record<string, number> = {};

    // Import pricing data
    const pricing: typeof MODEL_PRICING = {
      'claude-sonnet-4-20250514': { inputPerMTok: 3, outputPerMTok: 15 },
      'claude-opus-4-20250514': { inputPerMTok: 15, outputPerMTok: 75 },
    };

    for (const [model, tokens] of Object.entries(usage.byModel)) {
      const modelPricing = pricing[model as keyof typeof pricing];
      if (modelPricing) {
        const inputCost = (tokens.inputTokens / 1_000_000) * modelPricing.inputPerMTok;
        const outputCost = (tokens.outputTokens / 1_000_000) * modelPricing.outputPerMTok;
        const modelTotal = inputCost + outputCost;
        byModel[model] = modelTotal;
        totalUsd += modelTotal;
      }
    }

    return {
      usd: totalUsd,
      byModel,
    };
  }

  // ============================================================================
  // Summary for LLM context
  // ============================================================================

  getSummary(): ContextSummary {
    const topConcepts = this._analysis?.concepts
      .slice(0, 10)
      .map((c) => c.name) ?? [];

    const topConnections = this._connections
      .slice(0, 5)
      .map((c) => ({
        source: c.sourceConcept.name,
        target: c.targetConcept.name,
        type: c.connectionType,
      }));

    return {
      query: this.query.text,
      domain: this.domain,
      keyConceptsCount: this._analysis?.concepts.length ?? 0,
      connectionsCount: this._connections.length,
      hypothesesCount: this._hypotheses.length,
      topConcepts,
      topConnections,
    };
  }

  // ============================================================================
  // Logging (Winston structured logging)
  // ============================================================================

  /**
   * Log at info level (backward compatible with original log() method)
   */
  log(message: string, meta?: object): void {
    this._logger.info(message, meta);
  }

  /**
   * Log at info level with optional metadata
   */
  info(message: string, meta?: object): void {
    this._logger.info(message, meta);
  }

  /**
   * Log at warn level with optional metadata
   */
  warn(message: string, meta?: object): void {
    this._logger.warn(message, meta);
  }

  /**
   * Log at error level with optional metadata
   */
  error(message: string, meta?: object): void {
    this._logger.error(message, meta);
  }

  /**
   * Log at debug level with optional metadata
   */
  debug(message: string, meta?: object): void {
    this._logger.debug(message, meta);
  }
}
