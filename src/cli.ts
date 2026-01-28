#!/usr/bin/env node
/**
 * Synthesis Labs CLI
 * Cross-domain research hypothesis generation
 */

// Load environment variables from .env file
import 'dotenv/config';

import * as fs from 'node:fs';
import * as path from 'node:path';
import ora from 'ora';
import { SynthesisOrchestrator } from './orchestrator/index.js';
import { SUPPORTED_DOMAINS, DOMAIN_METADATA, DomainTag } from './types/index.js';

const STAGE_LABELS: Record<string, string> = {
  'domain-analysis': 'Stage 1/5: Domain Analysis',
  'cross-pollination': 'Stage 2/5: Cross-Pollination',
  'hypothesis-synthesis': 'Stage 3/5: Hypothesis Synthesis',
  'hypothesis-challenge': 'Stage 4/5: Hypothesis Challenge',
  'hypothesis-integration': 'Stage 5/5: Hypothesis Integration',
};

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

  // Parse output file flag
  const outputArg = args.find((a) => a.startsWith('--output='));
  const outputFile = outputArg ? outputArg.split('=')[1] : undefined;

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

  const spinner = ora({
    text: 'Initializing pipeline...',
    color: 'cyan',
  }).start();

  try {
    const orchestrator = new SynthesisOrchestrator({
      traceEnabled,
      traceOutputDir: traceDir,
      maxTokenBudget,
      onProgress: (stage, message) => {
        const label = STAGE_LABELS[stage] || stage;
        spinner.text = `${label} - ${message}`;
      },
    });
    const result = await orchestrator.run({
      text: query,
      targetDomain: domain,
    });

    spinner.succeed('Synthesis complete');

    // Format and output results
    const formattedResults = formatResults(result);

    // Write to file if output flag provided
    if (outputFile) {
      const outputPath = path.resolve(outputFile);
      const outputDir = path.dirname(outputPath);
      if (!fs.existsSync(outputDir)) {
        fs.mkdirSync(outputDir, { recursive: true });
      }
      fs.writeFileSync(outputPath, formattedResults, 'utf-8');
      console.log(`\nResults saved to: ${outputPath}`);
    }

    // Always print to console
    console.log(formattedResults);
  } catch (error) {
    spinner.fail('Synthesis failed');
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
  --output=<file>       Save results to file (in addition to console output)
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
  synth "Novel approaches to room-temperature superconductors" --output=results/output.txt
  synth "Quantum computing applications" --trace --output=results/quantum.txt

ENVIRONMENT:
  ANTHROPIC_API_KEY  Required. Your Anthropic API key.
`);
}

interface ResultsType {
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
      objective: string;
      methodology: string;
      expectedOutcome: string;
      requirements: {
        dataSources: string[];
        expertise: string[];
        infrastructure: string[];
        dependencies: string[];
        risks: string[];
      };
      successCriteria: string[];
    };
    suggestedResearch?: Array<{
      type: string;
      scope: string;
      questions: string[];
      sources: string[];
      estimatedEffort: string;
    }>;
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
  integration?: {
    clusters: Array<{
      id: string;
      name: string;
      hypothesisIds: string[];
      criterion: string;
      coherenceScore: number;
      summary: string;
    }>;
    integratedTheories: Array<{
      id: string;
      title: string;
      description: string;
      hypothesisIds: string[];
      sourceDomains: string[];
      targetDomain: string;
      unifiedMechanism: string;
      syntheticPredictions: string[];
      confidence: number;
      suggestedValidation?: string;
    }>;
    dependencies: Array<{
      id: string;
      sourceHypothesisId: string;
      targetHypothesisId: string;
      type: string;
      explanation: string;
      strength: number;
    }>;
    queryCoverage: {
      requirements: Array<{
        id: string;
        requirement: string;
        type: string;
        priority: string;
      }>;
      coverage: Array<{
        requirementId: string;
        hypothesisIds: string[];
        coverageScore: number;
        gaps: string[];
      }>;
      overallCoverage: number;
      recommendations: string[];
    };
    metadata: {
      totalHypotheses: number;
      totalClusters: number;
      totalTheories: number;
      totalDependencies: number;
      averageCoherence: number;
    };
  };
  warnings: string[];
}

function formatIntegrationResults(integration: ResultsType['integration']): string[] {
  if (!integration) return [];

  const lines: string[] = [];

  lines.push('========================================');
  lines.push('  INTEGRATION ANALYSIS');
  lines.push('========================================\n');

  // Clusters
  if (integration.clusters.length > 0) {
    lines.push(`HYPOTHESIS CLUSTERS (${integration.clusters.length}):`);
    for (const cluster of integration.clusters) {
      lines.push(`  ${cluster.name}`);
      lines.push(`    Criterion: ${cluster.criterion}`);
      lines.push(`    Coherence: ${cluster.coherenceScore.toFixed(2)}`);
      lines.push(`    Hypotheses: ${cluster.hypothesisIds.join(', ')}`);
      lines.push(`    Summary: ${cluster.summary}`);
      lines.push('');
    }
  }

  // Integrated Theories
  if (integration.integratedTheories.length > 0) {
    lines.push(`INTEGRATED THEORIES (${integration.integratedTheories.length}):`);
    for (const theory of integration.integratedTheories) {
      lines.push(`  ${theory.title}`);
      lines.push(`    Description: ${theory.description}`);
      lines.push(`    Source Domains: ${theory.sourceDomains.join(', ')}`);
      lines.push(`    Target Domain: ${theory.targetDomain}`);
      lines.push(`    Confidence: ${theory.confidence.toFixed(2)}`);
      lines.push(`    Unified Mechanism: ${theory.unifiedMechanism}`);
      lines.push('    Synthetic Predictions:');
      for (const pred of theory.syntheticPredictions) {
        lines.push(`      - ${pred}`);
      }
      if (theory.suggestedValidation) {
        lines.push(`    Validation: ${theory.suggestedValidation}`);
      }
      lines.push('');
    }
  }

  // Dependencies
  if (integration.dependencies.length > 0) {
    lines.push(`HYPOTHESIS DEPENDENCIES (${integration.dependencies.length}):`);
    for (const dep of integration.dependencies) {
      lines.push(`  ${dep.sourceHypothesisId} → ${dep.targetHypothesisId}`);
      lines.push(`    Type: ${dep.type}`);
      lines.push(`    Strength: ${dep.strength.toFixed(2)}`);
      lines.push(`    Explanation: ${dep.explanation}`);
      lines.push('');
    }
  }

  // Query Coverage
  lines.push(...formatQueryCoverage(integration.queryCoverage));

  lines.push('----------------------------------------\n');

  return lines;
}

function formatQueryCoverage(coverage: NonNullable<ResultsType['integration']>['queryCoverage']): string[] {
  if (!coverage) return [];

  const lines: string[] = [];

  lines.push(`QUERY COVERAGE (${(coverage.overallCoverage * 100).toFixed(0)}%):`);

  if (coverage.requirements.length > 0) {
    lines.push('  Requirements:');
    for (const req of coverage.requirements) {
      const cov = coverage.coverage.find((c: { requirementId: string; hypothesisIds: string[]; coverageScore: number; gaps: string[] }) => c.requirementId === req.id);
      const score = cov ? (cov.coverageScore * 100).toFixed(0) : '0';
      lines.push(`    [${score}%] ${req.requirement} (${req.type}, ${req.priority})`);
      if (cov && cov.hypothesisIds.length > 0) {
        lines.push(`      Addressed by: ${cov.hypothesisIds.join(', ')}`);
      }
      if (cov && cov.gaps.length > 0) {
        lines.push('      Gaps:');
        for (const gap of cov.gaps) {
          lines.push(`        - ${gap}`);
        }
      }
    }
    lines.push('');
  }

  if (coverage.recommendations.length > 0) {
    lines.push('  Recommendations:');
    for (const rec of coverage.recommendations) {
      lines.push(`    - ${rec}`);
    }
    lines.push('');
  }

  return lines;
}

function formatResults(result: ResultsType): string {
  const lines: string[] = [];

  lines.push('\n========================================');
  lines.push('  RESULTS');
  lines.push('========================================\n');

  lines.push(`Trace ID: ${result.traceId}`);
  lines.push(`Domain: ${result.domain}`);
  lines.push('');

  // Summary
  lines.push('SUMMARY:');
  lines.push(`  Generated: ${result.metadata.totalGenerated} hypotheses`);
  lines.push(`  Validated: ${result.metadata.totalValidated}`);
  lines.push(`  Rejected: ${result.metadata.totalRejected}`);
  lines.push(`  Time: ${(result.metadata.executionTimeMs / 1000).toFixed(1)}s`);
  lines.push('');

  // Token usage (if available)
  if (result.metadata.tokenUsage) {
    lines.push('TOKEN USAGE:');
    lines.push(`  Input tokens: ${result.metadata.tokenUsage.inputTokens.toLocaleString()}`);
    lines.push(`  Output tokens: ${result.metadata.tokenUsage.outputTokens.toLocaleString()}`);
    lines.push(`  Total tokens: ${result.metadata.tokenUsage.totalTokens.toLocaleString()}`);
    if (result.metadata.costEstimate) {
      lines.push(`  Estimated cost: $${result.metadata.costEstimate.usd.toFixed(4)}`);
    }
    lines.push('');
  }

  // Stages
  lines.push('PIPELINE STAGES:');
  for (const stage of result.metadata.stages) {
    const status = stage.status === 'success' ? '✓' : stage.status === 'error' ? '✗' : '~';
    lines.push(`  ${status} ${stage.stage}: ${(stage.durationMs / 1000).toFixed(1)}s`);
  }
  lines.push('');

  // Warnings
  if (result.warnings.length > 0) {
    lines.push('WARNINGS:');
    for (const warning of result.warnings) {
      lines.push(`  ⚠ ${warning}`);
    }
    lines.push('');
  }

  // Integration Analysis (if available)
  if (result.integration) {
    lines.push(...formatIntegrationResults(result.integration));
  }

  // Hypotheses
  if (result.hypotheses.length === 0) {
    lines.push('No validated hypotheses generated.');
    return lines.join('\n');
  }

  lines.push('----------------------------------------');
  lines.push('  VALIDATED HYPOTHESES');
  lines.push('----------------------------------------\n');

  for (const hypothesis of result.hypotheses) {
    lines.push(`#${hypothesis.rank}: ${hypothesis.title}`);
    lines.push(`Verdict: ${hypothesis.verdict.toUpperCase()} (Score: ${hypothesis.scores.composite.toFixed(2)})`);
    lines.push('');
    lines.push(`Statement: ${hypothesis.statement}`);
    lines.push('');

    lines.push('Scores:');
    lines.push(`  Specificity: ${hypothesis.scores.specificity.score}/5`);
    lines.push(`  Novelty: ${hypothesis.scores.novelty.score}/5`);
    lines.push(`  Connection Validity: ${hypothesis.scores.connectionValidity.score}/5`);
    lines.push(`  Feasibility: ${hypothesis.scores.feasibility.score}/5`);
    lines.push(`  Grounding: ${hypothesis.scores.grounding.score}/5`);
    lines.push('');

    lines.push('Components:');
    lines.push(`  Insight: ${hypothesis.components.insight}`);
    lines.push(`  Application: ${hypothesis.components.application}`);
    lines.push(`  Mechanism: ${hypothesis.components.mechanism}`);
    lines.push(`  Prediction: ${hypothesis.components.prediction}`);
    lines.push('');

    if (hypothesis.citations.length > 0) {
      lines.push('Citations:');
      for (const citation of hypothesis.citations) {
        lines.push(`  - ${citation.title} (${citation.type})`);
      }
      lines.push('');
    }

    // Suggested Research (preliminary investigation)
    if (hypothesis.suggestedResearch && hypothesis.suggestedResearch.length > 0) {
      lines.push('Suggested Research:');
      for (const research of hypothesis.suggestedResearch) {
        lines.push(`  Type: ${research.type}`);
        lines.push(`  Scope: ${research.scope}`);
        lines.push(`  Effort: ${research.estimatedEffort}`);
        if (research.questions.length > 0) {
          lines.push('  Questions:');
          for (const q of research.questions) {
            lines.push(`    - ${q}`);
          }
        }
        if (research.sources.length > 0) {
          lines.push('  Sources:');
          for (const s of research.sources) {
            lines.push(`    - ${s}`);
          }
        }
        lines.push('');
      }
    }

    // Suggested Experiment (full-scale testing)
    if (hypothesis.suggestedExperiment) {
      lines.push('Suggested Experiment:');
      lines.push(`  Title: ${hypothesis.suggestedExperiment.title}`);
      lines.push(`  Objective: ${hypothesis.suggestedExperiment.objective}`);
      lines.push(`  Methodology: ${hypothesis.suggestedExperiment.methodology}`);
      lines.push(`  Expected Outcome: ${hypothesis.suggestedExperiment.expectedOutcome}`);
      lines.push('  Requirements:');
      const req = hypothesis.suggestedExperiment.requirements;
      if (req.dataSources.length > 0) {
        lines.push(`    Data Sources: ${req.dataSources.join(', ')}`);
      }
      if (req.expertise.length > 0) {
        lines.push(`    Expertise: ${req.expertise.join(', ')}`);
      }
      if (req.infrastructure.length > 0) {
        lines.push(`    Infrastructure: ${req.infrastructure.join(', ')}`);
      }
      if (req.dependencies.length > 0) {
        lines.push(`    Dependencies: ${req.dependencies.join(', ')}`);
      }
      if (req.risks.length > 0) {
        lines.push(`    Risks: ${req.risks.join(', ')}`);
      }
      if (hypothesis.suggestedExperiment.successCriteria.length > 0) {
        lines.push('  Success Criteria:');
        for (const criterion of hypothesis.suggestedExperiment.successCriteria) {
          lines.push(`    - ${criterion}`);
        }
      }
      lines.push('');
    }

    lines.push('----------------------------------------\n');
  }

  lines.push('Note: All hypotheses require independent verification.');
  lines.push('Citations marked as "llm-knowledge" should be verified before use.');

  return lines.join('\n');
}

// ============================================================================
// Run
// ============================================================================

main().catch((error) => {
  console.error('Fatal error:', error);
  process.exit(1);
});
