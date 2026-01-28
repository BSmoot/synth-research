# ADR-008: Platform Enhancement Suite

**Status**: Proposed
**Date**: 2026-01-17
**Author**: APEX Architecture Review

---

## Context

Following the initial v1.0 release of Synthesis Labs, an APEX code review identified nine enhancement areas to improve system intelligence, reliability, and operational maturity.

### Current State Analysis

| Area | Current Implementation | Gap |
|------|----------------------|-----|
| **Domain Classification** | Keyword matching in `inferDomain()` (orchestrator lines 442-552) | Ambiguous queries misclassified; rigid keyword lists |
| **Hypothesis Deduplication** | None | Repeated runs generate duplicate hypotheses |
| **Confidence Calibration** | Static LLM confidence | No learning from validation outcomes |
| **Prompt Caching** | None | System prompts re-sent every call (~2K tokens/call) |
| **Streaming** | Batch responses only | User waits with no feedback during long operations |
| **Circuit Breakers** | Single orchestrator-level breaker | One agent failure trips entire pipeline |
| **Logging** | `console.log()` in PipelineContext (line 247) | Unstructured, no log levels, poor observability |
| **Schema Versioning** | None | Schema evolution breaks trace compatibility |
| **Evidence Gatherer** | Descoped in ADR-007 | Citations remain unverified `llm-knowledge` type |

### Relevant Code Locations

- `src/orchestrator/synthesis-orchestrator.ts`: Domain inference (442-552), circuit breaker (76-82, 564-620)
- `src/agents/base-agent.ts`: LLM calls (73-159), system prompts per call
- `src/context/pipeline-context.ts`: Logging (246-248), token tracking
- `src/types/*.ts`: Zod schemas without version markers
- `src/resilience/circuit-breaker.ts`: Single circuit breaker implementation
- `.claude/agents/evidence-gatherer.md`: Existing specification (planned v1.1)

---

## Decision

Implement a coordinated enhancement suite in **three phases**, prioritizing foundational changes (logging, schema versioning) before dependent features.

---

## Phase 1: Foundation (Logging, Schema Versioning, Per-Agent Circuit Breakers)

### 1.1 Winston Structured Logging

**Replace all `console.log` with Winston structured logging.**

Create `src/logging/logger.ts`:
```typescript
import winston from 'winston';

export interface LogContext {
  traceId?: string;
  agent?: string;
  stage?: string;
  [key: string]: unknown;
}

export const logger = winston.createLogger({
  level: process.env.LOG_LEVEL || 'info',
  format: winston.format.combine(
    winston.format.timestamp(),
    winston.format.errors({ stack: true }),
    winston.format.json()
  ),
  defaultMeta: { service: 'synthesis-labs' },
  transports: [
    new winston.transports.Console({
      format: process.env.NODE_ENV === 'production'
        ? winston.format.json()
        : winston.format.combine(
            winston.format.colorize(),
            winston.format.simple()
          ),
    }),
  ],
});

export function createChildLogger(context: LogContext): winston.Logger {
  return logger.child(context);
}
```

**Modify `src/context/pipeline-context.ts`:**
```typescript
import { createChildLogger } from '../logging/logger.js';

export class PipelineContext implements TokenTracker, TraceCollector {
  private readonly logger: winston.Logger;

  constructor(query: UserQuery, domain: DomainTag) {
    this.traceId = randomUUID();
    this.logger = createChildLogger({ traceId: this.traceId, domain });
  }

  log(level: 'debug' | 'info' | 'warn' | 'error', message: string, meta?: object): void {
    this.logger.log(level, message, meta);
  }

  info(message: string, meta?: object): void { this.log('info', message, meta); }
  warn(message: string, meta?: object): void { this.log('warn', message, meta); }
  error(message: string, meta?: object): void { this.log('error', message, meta); }
  debug(message: string, meta?: object): void { this.log('debug', message, meta); }
}
```

### 1.2 Schema Versioning

**Add version markers to all Zod schemas and trace metadata.**

Create `src/types/schema-version.ts`:
```typescript
import { z } from 'zod';

export const SCHEMA_VERSION = '1.1.0' as const;

export const SchemaVersionSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
});

export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

export function isCompatibleSchema(version: string): boolean {
  const [major] = version.split('.').map(Number);
  const [currentMajor] = SCHEMA_VERSION.split('.').map(Number);
  return major === currentMajor;
}
```

**Update `src/types/trace.ts`:**
```typescript
import { SCHEMA_VERSION } from './schema-version.js';

export const TraceMetadataSchema = z.object({
  schemaVersion: z.string().default(SCHEMA_VERSION),
  traceId: z.string(),
  // ... existing fields
  pipelineVersion: z.string().optional(),
});
```

### 1.3 Per-Agent Circuit Breakers

**Isolate failures per agent rather than at orchestrator level.**

Create `src/resilience/agent-circuit-breaker.ts`:
```typescript
import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker.js';

export class AgentCircuitBreakerRegistry {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig;

  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = {
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      ...defaultConfig,
    };
  }

  getBreaker(agentName: string): CircuitBreaker {
    if (!this.breakers.has(agentName)) {
      this.breakers.set(agentName, new CircuitBreaker({
        ...this.defaultConfig,
        name: agentName,
      }));
    }
    return this.breakers.get(agentName)!;
  }

  getStatus(): Record<string, { state: string }> {
    const status: Record<string, { state: string }> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = { state: breaker.getState() };
    }
    return status;
  }

  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
```

**Fallback behavior when agent circuit opens:**

| Agent | Fallback Strategy |
|-------|-------------------|
| domain-analyst | Fail pipeline (critical) |
| cross-pollinator | Return empty connections, continue with warning |
| hypothesis-synthesizer | Fail pipeline (critical) |
| hypothesis-challenger | Return hypotheses unscored with warning |
| evidence-gatherer | Return hypotheses with `llm-knowledge` citations |

---

## Phase 2: Intelligence (LLM Domain Classification, Hypothesis Deduplication, Confidence Calibration)

### 2.1 LLM-Powered Domain Classification

**Replace keyword matching with Claude-powered classification for ambiguous queries.**

Create `src/classification/domain-classifier.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { DomainTag, SUPPORTED_DOMAINS, normalizeDomain } from '../types/index.js';
import { logger } from '../logging/logger.js';

export interface ClassificationResult {
  domain: DomainTag;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ domain: DomainTag; confidence: number }>;
  usedLLM: boolean;
}

export class DomainClassifier {
  private readonly client: Anthropic;
  private readonly ambiguityThreshold = 0.7;

  constructor(client: Anthropic) {
    this.client = client;
  }

  async classify(query: string): Promise<ClassificationResult> {
    const keywordResult = this.classifyByKeywords(query);

    if (keywordResult.confidence >= this.ambiguityThreshold) {
      return { ...keywordResult, usedLLM: false };
    }

    logger.info('Using LLM for ambiguous domain classification', {
      query, keywordConfidence: keywordResult.confidence
    });

    return this.classifyByLLM(query, keywordResult);
  }

  private classifyByKeywords(query: string): Omit<ClassificationResult, 'usedLLM'> {
    // Enhanced keyword scoring from existing inferDomain logic
    // Returns domain with confidence score 0-1
    const lowerQuery = query.toLowerCase();
    const scores: Array<{ domain: DomainTag; score: number }> = [];

    // Score each domain based on keyword matches
    // ... implementation details ...

    const sorted = scores.sort((a, b) => b.score - a.score);
    const top = sorted[0] || { domain: 'other' as DomainTag, score: 0.3 };

    return {
      domain: top.domain,
      confidence: top.score,
      reasoning: 'Keyword-based classification',
      alternatives: sorted.slice(1, 4).map(s => ({ domain: s.domain, confidence: s.score })),
    };
  }

  private async classifyByLLM(
    query: string,
    keywordHint: Omit<ClassificationResult, 'usedLLM'>
  ): Promise<ClassificationResult> {
    const systemPrompt = `You are a domain classifier for research queries.
Classify into exactly one of: ${SUPPORTED_DOMAINS.join(', ')}

Respond with JSON only:
{"domain": "exact-domain-tag", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Classify this research query: "${query}"` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';
    const parsed = JSON.parse(text);
    const normalizedDomain = normalizeDomain(parsed.domain, 'other');

    return {
      domain: normalizedDomain,
      confidence: parsed.confidence,
      reasoning: parsed.reasoning,
      alternatives: keywordHint.alternatives,
      usedLLM: true,
    };
  }
}
```

**Cost control:** LLM classification uses claude-sonnet with max_tokens=256. Expected cost: ~$0.001 per classification. Only invoked for ambiguous queries (~20% of cases).

### 2.2 Hypothesis Deduplication

**Embedding-based similarity detection across runs.**

Create `src/deduplication/hypothesis-dedup.ts`:
```typescript
import { Hypothesis } from '../types/index.js';

export interface HypothesisEmbedding {
  hypothesisId: string;
  embedding: number[];
  statement: string;
  createdAt: string;
}

export interface DeduplicationResult {
  unique: Hypothesis[];
  duplicates: Array<{ hypothesis: Hypothesis; similarTo: string; similarity: number }>;
}

export class HypothesisDeduplicator {
  private readonly similarityThreshold: number;
  private embeddings: HypothesisEmbedding[] = [];
  private readonly maxStoredEmbeddings: number;

  constructor(options: { similarityThreshold?: number; maxStoredEmbeddings?: number } = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.maxStoredEmbeddings = options.maxStoredEmbeddings ?? 10000;
  }

  async deduplicate(hypotheses: Hypothesis[]): Promise<DeduplicationResult> {
    const unique: Hypothesis[] = [];
    const duplicates: Array<{ hypothesis: Hypothesis; similarTo: string; similarity: number }> = [];

    for (const hypothesis of hypotheses) {
      const embedding = await this.generateEmbedding(hypothesis.statement);
      const similar = this.findMostSimilar(embedding);

      if (similar && similar.similarity >= this.similarityThreshold) {
        duplicates.push({ hypothesis, similarTo: similar.hypothesisId, similarity: similar.similarity });
      } else {
        unique.push(hypothesis);
        this.storeEmbedding({
          hypothesisId: hypothesis.id,
          embedding,
          statement: hypothesis.statement,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { unique, duplicates };
  }

  private async generateEmbedding(text: string): Promise<number[]> {
    // Use simple hash-based pseudo-embedding until Anthropic embeddings API available
    // This is a placeholder - replace with real embedding API
    const hash = this.simpleHash(text);
    return Array.from({ length: 256 }, (_, i) => Math.sin(hash * (i + 1)));
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = ((hash << 5) - hash) + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private findMostSimilar(embedding: number[]): { hypothesisId: string; similarity: number } | null {
    let best: { hypothesisId: string; similarity: number } | null = null;

    for (const stored of this.embeddings) {
      const similarity = this.cosineSimilarity(embedding, stored.embedding);
      if (!best || similarity > best.similarity) {
        best = { hypothesisId: stored.hypothesisId, similarity };
      }
    }

    return best;
  }

  private storeEmbedding(entry: HypothesisEmbedding): void {
    this.embeddings.push(entry);
    // FIFO eviction
    if (this.embeddings.length > this.maxStoredEmbeddings) {
      this.embeddings.shift();
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    let dot = 0, magA = 0, magB = 0;
    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }
    return dot / (Math.sqrt(magA) * Math.sqrt(magB) || 1);
  }
}
```

**Storage Model:**

| Phase | Storage | Scope | Concurrency |
|-------|---------|-------|-------------|
| MVP | In-memory array | Instance-scoped (per orchestrator) | No sharing between runs |
| Future | `{traceDir}/embeddings.json` | Persistent across sessions | File-based atomic writes |

**Concurrency Safety (MVP):**
- Each `SynthesisOrchestrator` instance creates its own `HypothesisDeduplicator` instance
- No shared state between concurrent pipeline runs
- FIFO eviction operates on instance-local array only

**Future Shared Storage:**
If implementing cross-session deduplication:
```typescript
// Use file-based atomic writes
async persistEmbeddings(): Promise<void> {
  const tempPath = `${this.storagePath}.tmp`;
  await fs.writeFile(tempPath, JSON.stringify(this.embeddings));
  await fs.rename(tempPath, this.storagePath); // Atomic on POSIX
}

// Use mutex for concurrent access
async storeEmbedding(entry: HypothesisEmbedding): Promise<void> {
  await this.mutex.acquire();
  try {
    this.embeddings.push(entry);
    if (this.embeddings.length > this.maxStoredEmbeddings) {
      this.embeddings.shift();
    }
    await this.persistEmbeddings();
  } finally {
    this.mutex.release();
  }
}
```

### 2.3 Confidence Calibration

**Track validation outcomes to calibrate LLM confidence.**

Create `src/calibration/confidence-tracker.ts`:
```typescript
import { ScoredHypothesis, Verdict } from '../types/index.js';

export interface CalibrationRecord {
  hypothesisId: string;
  llmConfidence: number;
  predictedVerdict: Verdict;
  actualVerdict: Verdict;
  compositeScore: number;
  recordedAt: string;
}

export interface CalibrationStats {
  totalRecords: number;
  buckets: Array<{
    range: string;
    count: number;
    passRate: number;
    calibrationError: number;
  }>;
  overallCalibrationError: number;
}

export class ConfidenceCalibrator {
  private records: CalibrationRecord[] = [];
  private readonly minSamplesForAdjustment: number;

  constructor(options: { minSamplesForAdjustment?: number } = {}) {
    this.minSamplesForAdjustment = options.minSamplesForAdjustment ?? 50;
  }

  recordOutcome(hypothesis: ScoredHypothesis, llmConfidence: number): void {
    this.records.push({
      hypothesisId: hypothesis.id,
      llmConfidence,
      predictedVerdict: this.confidenceToVerdict(llmConfidence),
      actualVerdict: hypothesis.verdict,
      compositeScore: hypothesis.scores.composite,
      recordedAt: new Date().toISOString(),
    });
  }

  adjustConfidence(rawConfidence: number): number {
    if (this.records.length < this.minSamplesForAdjustment) {
      return rawConfidence;
    }

    const bucket = this.getBucket(rawConfidence);
    const bucketStats = this.getBucketStats(bucket);

    if (!bucketStats || bucketStats.count < 10) {
      return rawConfidence;
    }

    // Adjust confidence towards observed pass rate
    const adjustment = (bucketStats.passRate - rawConfidence) * 0.5;
    return Math.max(0, Math.min(1, rawConfidence + adjustment));
  }

  getCalibrationStats(): CalibrationStats {
    const buckets = [
      { min: 0.0, max: 0.2, range: '0-20%' },
      { min: 0.2, max: 0.4, range: '20-40%' },
      { min: 0.4, max: 0.6, range: '40-60%' },
      { min: 0.6, max: 0.8, range: '60-80%' },
      { min: 0.8, max: 1.0, range: '80-100%' },
    ];

    const stats = buckets.map(bucket => {
      const inBucket = this.records.filter(
        r => r.llmConfidence >= bucket.min && r.llmConfidence < bucket.max
      );
      const passed = inBucket.filter(r => r.actualVerdict === 'pass').length;
      const passRate = inBucket.length > 0 ? passed / inBucket.length : 0;
      const midpoint = (bucket.min + bucket.max) / 2;

      return {
        range: bucket.range,
        count: inBucket.length,
        passRate,
        calibrationError: Math.abs(passRate - midpoint),
      };
    });

    const totalError = stats.reduce((sum, s) => sum + s.calibrationError * s.count, 0);
    const overallCalibrationError = this.records.length > 0
      ? totalError / this.records.length
      : 0;

    return {
      totalRecords: this.records.length,
      buckets: stats,
      overallCalibrationError,
    };
  }

  private confidenceToVerdict(confidence: number): Verdict {
    if (confidence >= 0.7) return 'pass';
    if (confidence >= 0.5) return 'borderline';
    return 'fail';
  }

  private getBucket(confidence: number): number {
    return Math.floor(confidence * 5);
  }

  private getBucketStats(bucket: number): { count: number; passRate: number } | null {
    const min = bucket / 5;
    const max = (bucket + 1) / 5;
    const inBucket = this.records.filter(
      r => r.llmConfidence >= min && r.llmConfidence < max
    );

    if (inBucket.length === 0) return null;

    const passed = inBucket.filter(r => r.actualVerdict === 'pass').length;
    return {
      count: inBucket.length,
      passRate: passed / inBucket.length,
    };
  }
}
```

**Calibration Record Persistence:**

| Phase | Storage | Location | Retention |
|-------|---------|----------|-----------|
| MVP | In-memory | Instance-scoped | Session only |
| Phase 2+ | JSON file | `{traceDir}/calibration-records.json` | 90 days rolling |

**Persistence Implementation (Phase 2+):**

```typescript
export class ConfidenceCalibrator {
  private records: CalibrationRecord[] = [];
  private readonly storagePath?: string;

  constructor(options: {
    minSamplesForAdjustment?: number;
    storagePath?: string;
  } = {}) {
    this.minSamplesForAdjustment = options.minSamplesForAdjustment ?? 50;
    this.storagePath = options.storagePath;

    // Load existing records on construction
    if (this.storagePath) {
      this.loadRecords();
    }
  }

  private async loadRecords(): Promise<void> {
    if (!this.storagePath) return;

    try {
      const data = await fs.readFile(this.storagePath, 'utf-8');
      const loaded = JSON.parse(data) as CalibrationRecord[];

      // Filter to 90-day retention window
      const cutoff = new Date();
      cutoff.setDate(cutoff.getDate() - 90);
      this.records = loaded.filter(r => new Date(r.recordedAt) >= cutoff);

      logger.info('Loaded calibration records', { count: this.records.length });
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== 'ENOENT') {
        logger.warn('Failed to load calibration records', { error });
      }
      // File doesn't exist yet - start fresh
    }
  }

  async recordOutcome(hypothesis: ScoredHypothesis, llmConfidence: number): Promise<void> {
    const record: CalibrationRecord = {
      hypothesisId: hypothesis.id,
      llmConfidence,
      predictedVerdict: this.confidenceToVerdict(llmConfidence),
      actualVerdict: hypothesis.verdict,
      compositeScore: hypothesis.scores.composite,
      recordedAt: new Date().toISOString(),
    };

    this.records.push(record);

    // Persist asynchronously (don't block pipeline)
    if (this.storagePath) {
      this.persistRecords().catch(err =>
        logger.warn('Failed to persist calibration record', { error: err })
      );
    }
  }

  private async persistRecords(): Promise<void> {
    if (!this.storagePath) return;

    // Atomic write: temp file + rename
    const tempPath = `${this.storagePath}.tmp`;
    await fs.writeFile(tempPath, JSON.stringify(this.records, null, 2));
    await fs.rename(tempPath, this.storagePath);
  }
}
```

**Calibration Data Schema (for persistence):**
```json
[
  {
    "hypothesisId": "uuid",
    "llmConfidence": 0.75,
    "predictedVerdict": "pass",
    "actualVerdict": "pass",
    "compositeScore": 3.8,
    "recordedAt": "2026-01-17T14:30:00Z"
  }
]
```

---

## Phase 3: Performance & Features (Prompt Caching, Streaming, Evidence Gatherer)

### 3.1 Prompt Caching

**Leverage Anthropic's prompt caching for repeated system prompts.**

Modify `src/agents/base-agent.ts`:
```typescript
protected async callLLM(
  systemPrompt: string,
  userPrompt: string,
  options?: {
    tracker?: TokenTracker;
    traceCollector?: TraceCollector;
    agentName?: string;
    signal?: AbortSignal;
    enableCaching?: boolean;
  }
): Promise<string> {
  const startTime = Date.now();

  // Use cache_control for system prompt if caching enabled
  const systemContent = options?.enableCaching !== false
    ? [{
        type: 'text' as const,
        text: systemPrompt,
        cache_control: { type: 'ephemeral' as const }
      }]
    : systemPrompt;

  let response;
  try {
    response = await this.client.messages.create(
      {
        model: this.config.model,
        max_tokens: this.config.maxTokens,
        temperature: this.config.temperature ?? 0.7,
        system: systemContent,
        messages: [{ role: 'user', content: userPrompt }],
      },
      options?.signal ? { signal: options.signal } : undefined
    );
  } catch (error) {
    if (error instanceof Error && error.name === 'AbortError') {
      throw new TimeoutError(
        options?.agentName ?? this.config.name,
        0
      );
    }
    throw error;
  }

  // Track cache performance
  const usage = response.usage as {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };

  if (usage.cache_read_input_tokens && usage.cache_read_input_tokens > 0) {
    logger.debug('Prompt cache hit', {
      agent: this.config.name,
      cachedTokens: usage.cache_read_input_tokens
    });
  }

  // ... rest of existing logic
}
```

**Expected savings:** 30-40% cost reduction. System prompts are ~2K tokens; caching provides 90% reduction on subsequent calls within 5 minutes.

**Security Considerations:**

| Concern | Mitigation |
|---------|------------|
| Secrets in cached prompts | System prompts MUST NOT contain API keys, tokens, or credentials. All secrets passed via client configuration or environment variables. |
| Cross-tenant data leakage | Caching is API-key scoped. Different API keys = different cache namespaces. |
| Cache poisoning | Anthropic manages cache integrity. No client-side cache manipulation possible. |
| Prompt injection in cached content | System prompts are static templates with no user input. User content is in `messages[]`, never in system prompt. |

**CRITICAL RULE**: Never include dynamic secrets in system prompts. The following patterns are **FORBIDDEN**:

```typescript
// ❌ FORBIDDEN - Secret in system prompt
const systemPrompt = `API Key: ${process.env.EXTERNAL_API_KEY}`;

// ❌ FORBIDDEN - User data in system prompt
const systemPrompt = `User preferences: ${userConfig}`;

// ✅ CORRECT - Static system prompt
const systemPrompt = `You are the Domain Analyst for Synthesis Labs...`;

// ✅ CORRECT - Dynamic data in user message
const userPrompt = `Analyze this query: ${userQuery}`;
```

**Cache Invalidation**: Caches expire automatically after 5 minutes. No manual invalidation mechanism needed. If system prompts change (code deployment), new cache entries are created automatically.

### 3.2 Streaming Responses

**Stream partial results for long operations.**

Create `src/streaming/stream-handler.ts`:
```typescript
import { EventEmitter } from 'events';
import Anthropic from '@anthropic-ai/sdk';
import { UserQuery } from '../types/index.js';

export interface StreamEvent {
  type: 'token' | 'stage_start' | 'stage_complete' | 'hypothesis' | 'error';
  data: unknown;
  timestamp: string;
}

export class StreamingOrchestrator extends EventEmitter {
  private readonly client: Anthropic;

  constructor(client: Anthropic) {
    super();
    this.client = client;
  }

  async *runStreaming(query: UserQuery): AsyncGenerator<StreamEvent> {
    yield this.event('stage_start', { stage: 'domain-analysis', message: 'Starting domain analysis...' });

    // Stream domain analysis
    const analysisStream = this.client.messages.stream({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 4096,
      system: 'You are the Domain Analyst...',
      messages: [{ role: 'user', content: query.text }],
    });

    for await (const event of analysisStream) {
      if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
        yield this.event('token', { stage: 'domain-analysis', text: event.delta.text });
      }
    }

    yield this.event('stage_complete', { stage: 'domain-analysis' });

    // Continue with other stages...
  }

  private event(type: StreamEvent['type'], data: unknown): StreamEvent {
    return {
      type,
      data,
      timestamp: new Date().toISOString(),
    };
  }
}
```

**CLI flag:** `--stream` enables streaming mode.

**Graceful Shutdown Behavior:**

The streaming orchestrator MUST handle termination signals cleanly:

```typescript
export class StreamingOrchestrator extends EventEmitter {
  private abortController: AbortController | null = null;
  private isShuttingDown = false;

  async *runStreaming(query: UserQuery): AsyncGenerator<StreamEvent> {
    this.abortController = new AbortController();

    // Register shutdown handlers
    const shutdownHandler = () => this.initiateShutdown();
    process.on('SIGTERM', shutdownHandler);
    process.on('SIGINT', shutdownHandler);

    try {
      // ... streaming logic ...

      for await (const event of analysisStream) {
        if (this.isShuttingDown) {
          yield this.event('cancelled', { reason: 'shutdown_requested' });
          break;
        }
        // ... yield events ...
      }
    } finally {
      process.off('SIGTERM', shutdownHandler);
      process.off('SIGINT', shutdownHandler);
      this.abortController = null;
    }
  }

  private initiateShutdown(): void {
    this.isShuttingDown = true;
    this.abortController?.abort();
    logger.info('Streaming shutdown initiated');
  }
}
```

**Shutdown Event Sequence:**
1. `SIGTERM` received → Set `isShuttingDown = true`, abort in-flight LLM calls
2. Yield final `cancelled` event with reason
3. Clean up event listeners
4. Exit cleanly (no dangling connections)

**Consumer Responsibility:**
CLI consumers MUST handle `cancelled` and `error` events:
```typescript
for await (const event of orchestrator.runStreaming(query)) {
  if (event.type === 'cancelled') {
    console.log('Stream cancelled:', event.data.reason);
    break;
  }
  if (event.type === 'error') {
    console.error('Stream error:', event.data);
    break;
  }
  // ... handle other events ...
}
```

### 3.3 Evidence Gatherer Implementation

**Implement ADR-007's Evidence Gatherer agent.**

Create `src/agents/evidence-gatherer.ts`:
```typescript
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  ScoredHypothesis,
  Citation,
  CitationSchema,
} from '../types/index.js';
import { z } from 'zod';

// Extended hypothesis with evidence
export const EvidenceSchema = z.object({
  verifiedCitations: z.array(CitationSchema),
  newCitations: z.array(CitationSchema),
  evidenceStrength: z.enum(['strong', 'moderate', 'weak', 'none']),
  verificationSummary: z.string(),
});

export type Evidence = z.infer<typeof EvidenceSchema>;

export interface EvidencedHypothesis extends ScoredHypothesis {
  evidence: Evidence;
}

export interface EvidenceRequest {
  hypotheses: ScoredHypothesis[];
  citationsPerHypothesis?: number;
}

export interface EvidenceResult {
  evidencedHypotheses: EvidencedHypothesis[];
  summary: {
    totalHypotheses: number;
    strong: number;
    moderate: number;
    weak: number;
    none: number;
  };
}

// Error types for evidence gathering
export const EvidenceErrorTypeSchema = z.enum([
  'LLM_TIMEOUT',           // is_retryable: true - LLM call timed out
  'LLM_RATE_LIMITED',      // is_retryable: true - API rate limit hit
  'CITATION_PARSE_FAILED', // is_retryable: true - JSON parsing failed
  'INVALID_HYPOTHESIS',    // is_retryable: false - Hypothesis missing required fields
  'EMPTY_HYPOTHESIS_LIST', // is_retryable: false - No hypotheses provided
]);

export type EvidenceErrorType = z.infer<typeof EvidenceErrorTypeSchema>;

const RETRYABLE_EVIDENCE_ERRORS: Set<EvidenceErrorType> = new Set([
  'LLM_TIMEOUT',
  'LLM_RATE_LIMITED',
  'CITATION_PARSE_FAILED',
]);

export class EvidenceGatheringError extends Error {
  readonly errorType: EvidenceErrorType;
  readonly isRetryable: boolean;
  readonly hypothesisId?: string;
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    errorType: EvidenceErrorType,
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'EvidenceGatheringError';
    this.errorType = errorType;
    this.isRetryable = RETRYABLE_EVIDENCE_ERRORS.has(errorType);
    this.hypothesisId = context.hypothesisId as string | undefined;
    this.context = context;
  }
}

const DEFAULT_CONFIG: AgentConfig = {
  name: 'evidence-gatherer',
  model: 'claude-sonnet-4-20250514',
  maxTokens: 4096,
  temperature: 0.3,
};

export class EvidenceGathererAgent extends BaseAgent<EvidenceRequest, EvidenceResult> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(input: EvidenceRequest, signal?: AbortSignal): Promise<EvidenceResult> {
    const evidencedHypotheses: EvidencedHypothesis[] = [];

    for (const hypothesis of input.hypotheses) {
      const systemPrompt = this.buildSystemPrompt();
      const userPrompt = this.buildUserPrompt({ hypotheses: [hypothesis], citationsPerHypothesis: input.citationsPerHypothesis });

      const response = await this.callLLM(systemPrompt, userPrompt, { signal });
      const evidence = this.parseEvidenceResponse(response);

      evidencedHypotheses.push({
        ...hypothesis,
        evidence,
      });
    }

    return {
      evidencedHypotheses,
      summary: this.calculateSummary(evidencedHypotheses),
    };
  }

  protected buildSystemPrompt(): string {
    return `You are the Evidence Gatherer for Synthesis Labs.

Your task is to find supporting evidence for research hypotheses.

CRITICAL RULES:
1. NEVER fabricate citations. If unsure, use type: "llm-knowledge" with verified: false
2. Only set verified: true if you are certain the paper/source exists
3. Include DOI or URL when available
4. Assess evidence strength honestly:
   - strong: 3+ verified citations directly supporting the hypothesis
   - moderate: 1-2 verified citations or strong indirect support
   - weak: Only llm-knowledge citations or tangential support
   - none: No relevant evidence found

Respond with JSON only:
{
  "verifiedCitations": [...],
  "newCitations": [...],
  "evidenceStrength": "strong|moderate|weak|none",
  "verificationSummary": "Brief explanation of evidence quality"
}`;
  }

  protected buildUserPrompt(input: EvidenceRequest): string {
    const hypothesis = input.hypotheses[0];
    return `Find evidence for this hypothesis:

Title: ${hypothesis.title}
Statement: ${hypothesis.statement}
Source Domain: ${hypothesis.sourceDomain}
Target Domain: ${hypothesis.targetDomain}

Components:
- Insight: ${hypothesis.components.insight}
- Application: ${hypothesis.components.application}
- Mechanism: ${hypothesis.components.mechanism}
- Prediction: ${hypothesis.components.prediction}

Existing Citations:
${hypothesis.citations.map(c => `- ${c.title} (${c.type}, verified: ${c.verified})`).join('\n')}

Find ${input.citationsPerHypothesis ?? 3} additional citations that support this hypothesis.`;
  }

  protected parseResponse(response: string): EvidenceResult {
    // This is called by execute() for the full result
    throw new Error('Use parseEvidenceResponse instead');
  }

  private parseEvidenceResponse(response: string): Evidence {
    const json = this.extractJSON(response);
    const parsed = JSON.parse(json);
    return EvidenceSchema.parse(parsed);
  }

  private calculateSummary(hypotheses: EvidencedHypothesis[]): EvidenceResult['summary'] {
    return {
      totalHypotheses: hypotheses.length,
      strong: hypotheses.filter(h => h.evidence.evidenceStrength === 'strong').length,
      moderate: hypotheses.filter(h => h.evidence.evidenceStrength === 'moderate').length,
      weak: hypotheses.filter(h => h.evidence.evidenceStrength === 'weak').length,
      none: hypotheses.filter(h => h.evidence.evidenceStrength === 'none').length,
    };
  }
}
```

**Orchestrator integration:**
```typescript
// In SynthesisOrchestrator.run()
if (this.config.enableEvidenceGatherer && context.scoredHypotheses.length > 0) {
  this.checkBudget(context);
  await this.runEvidenceGathering(context);
}
```

---

## Configuration Changes

```typescript
export interface OrchestratorConfig {
  // Existing fields...
  apiKey?: string;
  maxRetries?: number;
  timeoutMs?: number;
  traceEnabled?: boolean;
  traceOutputDir?: string;
  maxTokenBudget?: number;
  onProgress?: (stage: string, message: string) => void;

  // Phase 1: Foundation
  logging?: {
    level?: 'debug' | 'info' | 'warn' | 'error';
    format?: 'json' | 'pretty';
  };
  circuitBreaker?: {
    enabled?: boolean;
    failureThreshold?: number;
    resetTimeoutMs?: number;
    perAgent?: boolean;  // NEW: Enable per-agent circuit breakers
  };

  // Phase 2: Intelligence
  classification?: {
    useLLM?: boolean;
    ambiguityThreshold?: number;
  };
  deduplication?: {
    enabled?: boolean;
    similarityThreshold?: number;
    maxStoredEmbeddings?: number;
  };
  calibration?: {
    enabled?: boolean;
    minSamplesForAdjustment?: number;
  };

  // Phase 3: Performance & Features
  enableEvidenceGatherer?: boolean;
  streaming?: {
    enabled?: boolean;
  };
  promptCaching?: {
    enabled?: boolean;
  };
}
```

---

## Rationale

### Design Principles

1. **Foundation first**: Logging and schema versioning enable debugging and compatibility for all other features.
2. **Graceful degradation**: Per-agent circuit breakers allow partial pipeline completion.
3. **Cost awareness**: LLM classification only for ambiguous queries (~20%). Prompt caching reduces costs 30-40%.
4. **Incremental adoption**: Each phase can release independently.
5. **Type safety**: All schemas extend existing Zod definitions.

### Alternatives Rejected

| Feature | Rejected Alternative | Reason |
|---------|---------------------|--------|
| Domain Classification | Always use LLM | Cost adds up; keywords work 80%+ of time |
| Hypothesis Deduplication | Exact string matching | Misses semantic duplicates |
| Logging | Pino | Winston has better ecosystem support |
| Per-Agent Breakers | Bulkhead pattern | Too complex for current scale |

---

## Consequences

### Positive
- Structured logging enables observability and alerting
- Agent isolation prevents cascade failures
- LLM classification handles edge cases
- Prompt caching reduces costs 30-40%
- Evidence gatherer fulfills ADR-007 scope

### Negative
- 9 features add code complexity
- Winston, embedding storage add dependencies
- LLM classification/dedup add 5-10% token usage

### Risks

| Risk | Mitigation |
|------|------------|
| Embedding storage grows unbounded | FIFO eviction at 10K entries |
| Prompt caching API changes | Feature flag to disable |
| Evidence gatherer hallucinations | Default verified: false |
| Schema versioning breaks traces | Compatibility checker on load |

---

## Implementation Notes

### Phase 1 (Foundation)
**New Files:**
- `src/logging/logger.ts`
- `src/types/schema-version.ts`
- `src/resilience/agent-circuit-breaker.ts`

**Modified Files:**
- `src/context/pipeline-context.ts`
- `src/orchestrator/synthesis-orchestrator.ts`
- `src/types/trace.ts`

**Dependencies:** `winston`

### Phase 2 (Intelligence)
**New Files:**
- `src/classification/domain-classifier.ts`
- `src/deduplication/hypothesis-dedup.ts`
- `src/calibration/confidence-tracker.ts`

**Modified Files:**
- `src/orchestrator/synthesis-orchestrator.ts`

### Phase 3 (Performance & Features)
**New Files:**
- `src/agents/evidence-gatherer.ts`
- `src/streaming/stream-handler.ts`

**Modified Files:**
- `src/agents/base-agent.ts`
- `src/orchestrator/synthesis-orchestrator.ts`
- `src/cli.ts`

---

## References

- ADR-005: Timeout and Circuit Breaker Strategy
- ADR-006: Parallel Hypothesis Evaluation
- ADR-007: Evidence Gatherer Scope
- Anthropic Prompt Caching: https://docs.anthropic.com/en/docs/build-with-claude/prompt-caching
- Winston Logging: https://github.com/winstonjs/winston
