# Synthesis Labs - Claude Code Instructions

This file provides context and instructions for Claude Code sessions in this project.

## Project Overview

Synthesis Labs is a cross-domain research hypothesis generation system. It runs a 4-stage LLM pipeline:
1. **Domain Analysis** - Extract concepts, methods, open problems
2. **Cross-Pollination** - Find analogies across domains
3. **Hypothesis Synthesis** - Generate candidate hypotheses
4. **Hypothesis Challenge** - Validate and score hypotheses

## Research Session Management

When a user wants to run a research session, help them configure and execute it. Do NOT re-explore the codebase each time - use this reference.

### Quick Start Command

```bash
npm run dev -- "<query>" [options]
```

### CLI Options

| Option | Description | Default |
|--------|-------------|---------|
| `--domain=<domain>` | Target research domain | Auto-detected |
| `--trace` | Enable detailed trace output | Disabled |
| `--trace-dir=<path>` | Trace output directory | `./traces` |
| `--output=<file>` | Save results to file | Console only |
| `--max-tokens=<num>` | Token budget cap | Unlimited |

### Supported Domains

| Domain | Key Areas |
|--------|-----------|
| `computational-biology` | Genomics, proteomics, drug discovery, CRISPR |
| `materials-science` | Nanomaterials, polymers, semiconductors |
| `ml-ai` | Deep learning, NLP, computer vision, RL |
| `economics-finance` | Markets, behavioral economics, modeling |
| `social-systems` | Networks, collective behavior, institutions |
| `physics-engineering` | Quantum, thermodynamics, control theory |
| `climate-environment` | Earth systems, sustainability, ecology |
| `healthcare-medicine` | Clinical research, epidemiology |
| `cognitive-science` | Neuroscience, psychology, decision-making |
| `information-systems` | Distributed systems, crypto, data arch |
| `other` | Interdisciplinary or unlisted |

## Temperature Tuning

Temperature affects creativity vs. grounding. Offer to tune before sessions.

### Current Default Settings

| Agent | Temperature | Model | Purpose |
|-------|-------------|-------|---------|
| Domain Analyst | 0.7 | Sonnet | Extract concepts/methods |
| Cross-Pollinator | 0.8 | Opus | Find creative connections |
| Hypothesis Synthesizer | 0.8 | Opus | Generate hypotheses |
| Hypothesis Challenger | 0.5 | Opus | Conservative validation |
| Evidence Gatherer | 0.3 | Sonnet | Factual accuracy |

### Tuning Presets by Novelty Level

| Novelty Level | Domain Analyst | Cross-Pollinator | Synthesizer | Challenger |
|---------------|----------------|------------------|-------------|------------|
| **Conservative** | 0.5 | 0.6 | 0.6 | 0.3 |
| **Balanced** (default) | 0.7 | 0.8 | 0.8 | 0.5 |
| **Exploratory** | 0.8 | 0.9 | 0.9 | 0.6 |
| **Wild** | 0.9 | 1.0 | 1.0 | 0.7 |

### How to Apply Temperature Changes

Edit the temperature in the agent files:
- `src/agents/domain-analyst.ts` (line 26)
- `src/agents/cross-pollinator.ts` (line 30)
- `src/agents/hypothesis-synthesizer.ts` (line 45)
- `src/agents/hypothesis-challenger.ts` (line 101)

## Session Workflow

When helping a user run a research session:

1. **Gather Configuration**
   - Research query/topic
   - Domain (or auto-detect)
   - Output preferences (traces, results file)
   - Novelty level for temperature tuning

2. **Apply Temperature Tuning** (if not using defaults)
   - Edit agent files with selected preset
   - Confirm changes

3. **Run the Session**
   ```bash
   npm run dev -- "<query>" --trace --output=results/<filename>.txt
   ```

4. **Review Results**
   - Check console output for summary
   - Review `results/` for output file
   - Inspect `traces/` for detailed LLM I/O if needed

## Trace Output Structure

When `--trace` is enabled:

```
traces/{trace-id}/
├── metadata.json                 # Run metadata, costs, timing
├── stage-01-domain-analyst.json  # Domain analysis LLM call
├── stage-02-cross-pollinator.json
├── stage-03-hypothesis-synthesizer.json
└── stage-04-hypothesis-challenger.json
```

Each stage file contains:
- `input.system` - System prompt sent to LLM
- `input.user` - User prompt sent to LLM
- `output.raw` - Full LLM response
- `usage.inputTokens` / `usage.outputTokens`
- `durationMs` - Stage timing

## Debugging

### Inspect Traces

```bash
# View prompts sent to an agent
cat traces/{traceId}/stage-01-domain-analyst.json | jq '.input'

# Check token usage per stage
for f in traces/{traceId}/stage-*.json; do
  echo "$(basename $f): $(cat $f | jq '.usage')"
done

# View total cost
cat traces/{traceId}/metadata.json | jq '{cost: .costUsd, tokens: .totalTokens}'
```

### Common Issues

| Issue | Check | Solution |
|-------|-------|----------|
| High cost | Token usage in metadata | Lower max-tokens or use Sonnet |
| Slow stages | durationMs in trace files | Check network/API status |
| Poor hypotheses | output.raw in synthesizer trace | Adjust temperature up |
| All rejected | challenger trace scores | Adjust challenger temp down |

## Key Files Reference

| Purpose | Location |
|---------|----------|
| CLI entry point | `src/cli.ts` |
| Pipeline orchestrator | `src/orchestrator/synthesis-orchestrator.ts` |
| Agent implementations | `src/agents/*.ts` |
| Type definitions | `src/types/*.ts` |
| Trace writer | `src/tracing/trace-writer.ts` |
| Architecture decisions | `docs/architecture/ADR-*.md` |
