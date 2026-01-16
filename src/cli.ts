#!/usr/bin/env node
/**
 * Synthesis Labs CLI
 * Cross-domain research hypothesis generation
 */

// Load environment variables from .env file
import 'dotenv/config';

import { SynthesisOrchestrator } from './orchestrator/index.js';
import { SUPPORTED_DOMAINS, DOMAIN_METADATA, DomainTag } from './types/index.js';

// ============================================================================
// CLI Interface
// ============================================================================

async function main(): Promise<void> {
  const args = process.argv.slice(2);

  // Help
  if (args.includes('--help') || args.includes('-h') || args.length === 0) {
    printHelp();
    process.exit(0);
  }

  // Version
  if (args.includes('--version') || args.includes('-v')) {
    console.log('synthesis-labs v0.1.0');
    process.exit(0);
  }

  // Parse arguments
  const domainArg = args.find((a) => a.startsWith('--domain='));
  const domain = domainArg
    ? (domainArg.split('=')[1] as DomainTag)
    : undefined;

  // Parse trace flags
  const traceEnabled = args.includes('--trace');
  const traceDirArg = args.find((a) => a.startsWith('--trace-dir='));
  const traceDir = traceDirArg ? traceDirArg.split('=')[1] : './traces';

  // Parse token budget flag
  const maxTokensArg = args.find((a) => a.startsWith('--max-tokens='));
  const maxTokenBudget = maxTokensArg ? parseInt(maxTokensArg.split('=')[1], 10) : undefined;

  // Get query (all non-flag arguments)
  const query = args
    .filter((a) => !a.startsWith('--'))
    .join(' ')
    .trim();

  if (!query) {
    console.error('Error: Please provide a research query.');
    printHelp();
    process.exit(1);
  }

  // Validate domain if provided
  if (domain && !SUPPORTED_DOMAINS.includes(domain)) {
    console.error(`Error: Invalid domain "${domain}".`);
    console.error(`Supported domains: ${SUPPORTED_DOMAINS.join(', ')}`);
    process.exit(1);
  }

  // Check API key
  if (!process.env.ANTHROPIC_API_KEY) {
    console.error('Error: ANTHROPIC_API_KEY not found.');
    console.error('');
    console.error('Option 1: Create a .env file with:');
    console.error('  ANTHROPIC_API_KEY=your-key-here');
    console.error('');
    console.error('Option 2: Set environment variable:');
    console.error('  Windows (PowerShell): $env:ANTHROPIC_API_KEY="your-key-here"');
    console.error('  Windows (CMD):        set ANTHROPIC_API_KEY=your-key-here');
    console.error('  macOS/Linux:          export ANTHROPIC_API_KEY=your-key-here');
    process.exit(1);
  }

  // Run synthesis
  console.log('\n========================================');
  console.log('  SYNTHESIS LABS');
  console.log('  Cross-Domain Research Hypothesis Generation');
  console.log('========================================\n');

  console.log(`Query: "${query}"`);
  if (domain) {
    console.log(`Domain: ${DOMAIN_METADATA[domain].name}`);
  }
  console.log('');

  try {
    const orchestrator = new SynthesisOrchestrator({
      traceEnabled,
      traceOutputDir: traceDir,
      maxTokenBudget,
    });
    const result = await orchestrator.run({
      text: query,
      targetDomain: domain,
    });

    // Print results
    printResults(result);
  } catch (error) {
    console.error('\nError during synthesis:', error);
    process.exit(1);
  }
}

// ============================================================================
// Output Formatting
// ============================================================================

function printHelp(): void {
  console.log(`
Synthesis Labs - Cross-Domain Research Hypothesis Generation

USAGE:
  synth <query> [options]

OPTIONS:
  --domain=<domain>     Target domain for analysis
  --trace               Enable detailed trace output
  --trace-dir=<path>    Directory for trace files (default: ./traces)
  --max-tokens=<num>    Maximum token budget for pipeline
  --help, -h            Show this help message
  --version, -v         Show version

SUPPORTED DOMAINS:
  ${SUPPORTED_DOMAINS.map((d) => `${d}: ${DOMAIN_METADATA[d].name}`).join('\n  ')}

EXAMPLES:
  synth "How can we improve CRISPR guide RNA design?"
  synth "Applications of transformers in drug discovery" --domain=computational-biology
  synth "Novel approaches to room-temperature superconductors" --trace --max-tokens=50000

ENVIRONMENT:
  ANTHROPIC_API_KEY  Required. Your Anthropic API key.
`);
}

function printResults(result: {
  traceId: string;
  query: string;
  domain: string;
  hypotheses: Array<{
    rank: number;
    title: string;
    statement: string;
    scores: {
      composite: number;
      specificity: { score: number };
      novelty: { score: number };
      connectionValidity: { score: number };
      feasibility: { score: number };
      grounding: { score: number };
    };
    verdict: string;
    components: {
      insight: string;
      application: string;
      mechanism: string;
      prediction: string;
    };
    citations: Array<{ title: string; type: string }>;
    suggestedExperiment?: {
      title: string;
      methodology: string;
      resourceEstimate: {
        timeMonths: number;
        budgetUSD: string;
      };
    };
  }>;
  metadata: {
    totalGenerated: number;
    totalValidated: number;
    totalRejected: number;
    executionTimeMs: number;
    stages: Array<{ stage: string; status: string; durationMs: number }>;
    tokenUsage?: {
      inputTokens: number;
      outputTokens: number;
      totalTokens: number;
    };
    costEstimate?: {
      usd: number;
    };
  };
  warnings: string[];
}): void {
  console.log('\n========================================');
  console.log('  RESULTS');
  console.log('========================================\n');

  console.log(`Trace ID: ${result.traceId}`);
  console.log(`Domain: ${result.domain}`);
  console.log('');

  // Summary
  console.log('SUMMARY:');
  console.log(`  Generated: ${result.metadata.totalGenerated} hypotheses`);
  console.log(`  Validated: ${result.metadata.totalValidated}`);
  console.log(`  Rejected: ${result.metadata.totalRejected}`);
  console.log(`  Time: ${(result.metadata.executionTimeMs / 1000).toFixed(1)}s`);
  console.log('');

  // Token usage (if available)
  if (result.metadata.tokenUsage) {
    console.log('TOKEN USAGE:');
    console.log(`  Input tokens: ${result.metadata.tokenUsage.inputTokens.toLocaleString()}`);
    console.log(`  Output tokens: ${result.metadata.tokenUsage.outputTokens.toLocaleString()}`);
    console.log(`  Total tokens: ${result.metadata.tokenUsage.totalTokens.toLocaleString()}`);
    if (result.metadata.costEstimate) {
      console.log(`  Estimated cost: $${result.metadata.costEstimate.usd.toFixed(4)}`);
    }
    console.log('');
  }

  // Stages
  console.log('PIPELINE STAGES:');
  for (const stage of result.metadata.stages) {
    const status = stage.status === 'success' ? '✓' : stage.status === 'error' ? '✗' : '~';
    console.log(`  ${status} ${stage.stage}: ${(stage.durationMs / 1000).toFixed(1)}s`);
  }
  console.log('');

  // Warnings
  if (result.warnings.length > 0) {
    console.log('WARNINGS:');
    for (const warning of result.warnings) {
      console.log(`  ⚠ ${warning}`);
    }
    console.log('');
  }

  // Hypotheses
  if (result.hypotheses.length === 0) {
    console.log('No validated hypotheses generated.');
    return;
  }

  console.log('----------------------------------------');
  console.log('  VALIDATED HYPOTHESES');
  console.log('----------------------------------------\n');

  for (const hypothesis of result.hypotheses) {
    console.log(`#${hypothesis.rank}: ${hypothesis.title}`);
    console.log(`Verdict: ${hypothesis.verdict.toUpperCase()} (Score: ${hypothesis.scores.composite.toFixed(2)})`);
    console.log('');
    console.log(`Statement: ${hypothesis.statement}`);
    console.log('');

    console.log('Scores:');
    console.log(`  Specificity: ${hypothesis.scores.specificity.score}/5`);
    console.log(`  Novelty: ${hypothesis.scores.novelty.score}/5`);
    console.log(`  Connection Validity: ${hypothesis.scores.connectionValidity.score}/5`);
    console.log(`  Feasibility: ${hypothesis.scores.feasibility.score}/5`);
    console.log(`  Grounding: ${hypothesis.scores.grounding.score}/5`);
    console.log('');

    console.log('Components:');
    console.log(`  Insight: ${hypothesis.components.insight}`);
    console.log(`  Application: ${hypothesis.components.application}`);
    console.log(`  Mechanism: ${hypothesis.components.mechanism}`);
    console.log(`  Prediction: ${hypothesis.components.prediction}`);
    console.log('');

    if (hypothesis.citations.length > 0) {
      console.log('Citations:');
      for (const citation of hypothesis.citations) {
        console.log(`  - ${citation.title} (${citation.type})`);
      }
      console.log('');
    }

    if (hypothesis.suggestedExperiment) {
      console.log('Suggested Experiment:');
      console.log(`  ${hypothesis.suggestedExperiment.title}`);
      console.log(`  Methodology: ${hypothesis.suggestedExperiment.methodology}`);
      console.log(`  Timeline: ${hypothesis.suggestedExperiment.resourceEstimate.timeMonths} months`);
      console.log(`  Budget: ${hypothesis.suggestedExperiment.resourceEstimate.budgetUSD}`);
      console.log('');
    }

    console.log('----------------------------------------\n');
  }

  console.log('Note: All hypotheses require independent verification.');
  console.log('Citations marked as "llm-knowledge" should be verified before use.');
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
