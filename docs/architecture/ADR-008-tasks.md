# ADR-008 Task Graph: Platform Enhancement Suite

**Generated**: 2026-01-17
**Source ADR**: docs/architecture/ADR-008-platform-enhancement-suite.md
**Contracts Reference**: docs/architecture/ADR-008-contracts.md
**Methodology**: TDD (Test-Driven Development)

---

## Executive Summary

| Metric | Value |
|--------|-------|
| Total Tasks | 38 |
| Estimated LOC | ~2,400 |
| Phases | 3 |
| Critical Path Tasks | 15 |
| New Files | 12 |
| Modified Files | 6 |
| New Dependencies | 1 (winston) |

---

## Task Legend

| Field | Description |
|-------|-------------|
| `id` | Unique task identifier (format: `phase-feature-sequence`) |
| `agent` | APEX agent responsible: `apex-test-designer`, `apex-developer`, `apex-integrator`, `apex-reviewer` |
| `tdd_phase` | TDD phase: `red` (failing tests), `green` (pass tests), `refactor` |
| `requires` | Task IDs that must complete first |
| `blocks` | Task IDs that cannot start until this completes |
| `output` | Primary file(s) created or modified |

---

## Phase 0: Foundation Setup

### Task P0-001: Install Winston Dependency

| Field | Value |
|-------|-------|
| **ID** | `P0-001` |
| **Title** | Install Winston logging dependency |
| **Agent** | `apex-integrator` |
| **TDD Phase** | N/A (infrastructure) |
| **Requires** | None |
| **Blocks** | `P1-LOG-001` |
| **LOC** | ~5 |

**Specification**:
Add winston as a production dependency to package.json.

**Output Files**:
- `package.json` (modify)

**Acceptance Criteria**:
- [ ] `npm install winston` succeeds
- [ ] `package.json` includes `"winston": "^3.x.x"` in dependencies
- [ ] `npm ci && npm run build` succeeds

**Verification**:
```bash
npm install winston --save
npm run build
grep -q '"winston"' package.json && echo "PASS" || echo "FAIL"
```

---

## Phase 1: Foundation (Logging, Schema Versioning, Per-Agent Circuit Breakers)

### 1.1 Winston Structured Logging

#### Task P1-LOG-001: Design Logger Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P1-LOG-001` |
| **Title** | TDD: Design failing tests for Winston logger |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P0-001` |
| **Blocks** | `P1-LOG-002` |
| **LOC** | ~100 |

**Specification**:
Design tests that specify behavior of the Winston logger module before implementation.
Tests MUST fail until implementation exists.

**Output Files**:
- `tests/unit/logging/logger.test.ts` (new)

**Acceptance Criteria**:
- [ ] Test file imports from `../../src/logging/logger.js`
- [ ] Tests cover: logger creation, child logger creation, log levels, JSON format
- [ ] Tests cover: LogContext interface with traceId, agent, stage
- [ ] All tests FAIL (module does not exist)

**Verification**:
```bash
npx vitest run tests/unit/logging/logger.test.ts 2>&1 | grep -q "FAIL" && echo "RED PHASE PASS" || echo "RED PHASE FAIL"
```

**Context Files**:
- `src/context/pipeline-context.ts` (lines 246-248 - existing console.log pattern)
- `tests/unit/circuit-breaker.test.ts` (test pattern reference)

---

#### Task P1-LOG-002: Implement Logger Module (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P1-LOG-002` |
| **Title** | TDD: Implement Winston logger to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P1-LOG-001` |
| **Blocks** | `P1-LOG-003` |
| **LOC** | ~80 |

**Specification**:
Implement the Winston logger module to make all tests pass.
Do NOT modify tests.

**Output Files**:
- `src/logging/logger.ts` (new)

**Contract Requirements** (from ADR-008-contracts.md):
- Export `LogContext` interface with: `traceId?: string`, `agent?: string`, `stage?: string`, `[key: string]: unknown`
- Export `logger` winston instance with JSON format in production, colorized simple format in development
- Export `createChildLogger(context: LogContext): winston.Logger` function

**Acceptance Criteria**:
- [ ] All tests in `tests/unit/logging/logger.test.ts` pass
- [ ] TypeScript compiles without errors
- [ ] Exports: `logger`, `createChildLogger`, `LogContext`

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/logging/logger.test.ts
```

---

#### Task P1-LOG-003: Integrate Logger into PipelineContext

| Field | Value |
|-------|-------|
| **ID** | `P1-LOG-003` |
| **Title** | Integrate Winston logger into PipelineContext |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P1-LOG-002` |
| **Blocks** | `P1-PHASE-INT` |
| **LOC** | ~40 |

**Specification**:
Replace `console.log` in PipelineContext with Winston structured logging.
Preserve existing log format for trace ID correlation.

**Output Files**:
- `src/context/pipeline-context.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md):
- MUST preserve `[{traceId.slice(0,8)}] message` format in output
- MUST use `createChildLogger({ traceId, domain })` in constructor
- MUST add methods: `info()`, `warn()`, `error()`, `debug()`

**Acceptance Criteria**:
- [ ] `console.log` removed from PipelineContext
- [ ] Logger uses traceId and domain as default meta
- [ ] Existing tests continue to pass
- [ ] TypeScript compiles without errors

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
grep -r "console.log" src/context/pipeline-context.ts && echo "FAIL: console.log still present" || echo "PASS"
```

---

### 1.2 Schema Versioning

#### Task P1-SCHEMA-001: Design Schema Version Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P1-SCHEMA-001` |
| **Title** | TDD: Design failing tests for schema versioning |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | None |
| **Blocks** | `P1-SCHEMA-002` |
| **LOC** | ~60 |

**Specification**:
Design tests for schema version management before implementation.

**Output Files**:
- `tests/unit/types/schema-version.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: SCHEMA_VERSION constant format (semver)
- [ ] Tests cover: SchemaVersionSchema validation
- [ ] Tests cover: isCompatibleSchema() function
- [ ] All tests FAIL

**Verification**:
```bash
npx vitest run tests/unit/types/schema-version.test.ts 2>&1 | grep -q "FAIL" && echo "RED PHASE PASS"
```

---

#### Task P1-SCHEMA-002: Implement Schema Version Module (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P1-SCHEMA-002` |
| **Title** | TDD: Implement schema versioning to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P1-SCHEMA-001` |
| **Blocks** | `P1-SCHEMA-003` |
| **LOC** | ~50 |

**Specification**:
Implement schema versioning module per ADR-008 specification.

**Output Files**:
- `src/types/schema-version.ts` (new)

**Acceptance Criteria**:
- [ ] Exports: `SCHEMA_VERSION`, `SchemaVersionSchema`, `isCompatibleSchema()`
- [ ] SCHEMA_VERSION = '1.1.0'
- [ ] All tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/types/schema-version.test.ts
```

---

#### Task P1-SCHEMA-003: Integrate Schema Version into TraceMetadata

| Field | Value |
|-------|-------|
| **ID** | `P1-SCHEMA-003` |
| **Title** | Add schemaVersion to TraceMetadataSchema |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P1-SCHEMA-002` |
| **Blocks** | `P1-PHASE-INT` |
| **LOC** | ~20 |

**Specification**:
Extend TraceMetadataSchema to include schemaVersion field.

**Output Files**:
- `src/types/trace.ts` (modify)

**Contract Requirements**:
- Add `schemaVersion: z.string().default(SCHEMA_VERSION)` to TraceMetadataSchema
- Import from `./schema-version.js`

**Acceptance Criteria**:
- [ ] TraceMetadataSchema includes schemaVersion field
- [ ] Default value is SCHEMA_VERSION constant
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### 1.3 Per-Agent Circuit Breakers

#### Task P1-CB-001: Design Agent Circuit Breaker Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P1-CB-001` |
| **Title** | TDD: Design failing tests for per-agent circuit breakers |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | None |
| **Blocks** | `P1-CB-002` |
| **LOC** | ~120 |

**Specification**:
Design tests for AgentCircuitBreakerRegistry class.

**Output Files**:
- `tests/unit/resilience/agent-circuit-breaker.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: registry creation with default config
- [ ] Tests cover: getBreaker() creates/retrieves per-agent breakers
- [ ] Tests cover: getStatus() returns all breaker states
- [ ] Tests cover: resetAll() resets all breakers
- [ ] All tests FAIL

**Context Files**:
- `src/resilience/circuit-breaker.ts` (existing CircuitBreaker contract)
- `tests/unit/circuit-breaker.test.ts` (test pattern reference)

**Verification**:
```bash
npx vitest run tests/unit/resilience/agent-circuit-breaker.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P1-CB-002: Implement Agent Circuit Breaker Registry (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P1-CB-002` |
| **Title** | TDD: Implement AgentCircuitBreakerRegistry to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P1-CB-001` |
| **Blocks** | `P1-CB-003` |
| **LOC** | ~80 |

**Specification**:
Implement the AgentCircuitBreakerRegistry class per ADR-008 specification.

**Output Files**:
- `src/resilience/agent-circuit-breaker.ts` (new)

**Contract Requirements** (from ADR-008-contracts.md):
- MUST use existing CircuitBreaker class (Contract 5)
- MUST maintain Map<agentName, CircuitBreaker>
- Methods: `getBreaker(agentName)`, `getStatus()`, `resetAll()`

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Uses existing CircuitBreaker, not replacement
- [ ] TypeScript compiles

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/resilience/agent-circuit-breaker.test.ts
```

---

#### Task P1-CB-003: Integrate Per-Agent Circuit Breakers into Orchestrator

| Field | Value |
|-------|-------|
| **ID** | `P1-CB-003` |
| **Title** | Integrate per-agent circuit breakers into orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P1-CB-002` |
| **Blocks** | `P1-PHASE-INT` |
| **LOC** | ~60 |

**Specification**:
Add `circuitBreaker.perAgent` config option and integrate AgentCircuitBreakerRegistry.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md - Contract 1):
- Add `perAgent?: boolean` to circuitBreaker config section
- When perAgent=true, use AgentCircuitBreakerRegistry instead of single breaker

**Acceptance Criteria**:
- [ ] New config option: `circuitBreaker.perAgent`
- [ ] Fallback behavior per agent type (as specified in ADR-008)
- [ ] Backward compatible (existing behavior when perAgent=false)

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### Task P1-PHASE-INT: Phase 1 Integration Tests

| Field | Value |
|-------|-------|
| **ID** | `P1-PHASE-INT` |
| **Title** | Phase 1 integration tests |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | N/A (integration) |
| **Requires** | `P1-LOG-003`, `P1-SCHEMA-003`, `P1-CB-003` |
| **Blocks** | Phase 2 tasks |
| **LOC** | ~80 |

**Specification**:
Integration tests verifying Phase 1 components work together.

**Output Files**:
- `tests/integration/phase1-foundation.test.ts` (new)

**Acceptance Criteria**:
- [ ] Logger integrates with PipelineContext
- [ ] Schema version appears in trace output
- [ ] Per-agent circuit breakers isolate failures

**Verification**:
```bash
npx vitest run tests/integration/phase1-foundation.test.ts
```

---

## Phase 2: Intelligence (LLM Domain Classification, Hypothesis Deduplication, Confidence Calibration)

### 2.1 LLM-Powered Domain Classification

#### Task P2-CLASS-001: Design Domain Classifier Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P2-CLASS-001` |
| **Title** | TDD: Design failing tests for domain classifier |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P1-PHASE-INT` |
| **Blocks** | `P2-CLASS-002` |
| **LOC** | ~120 |

**Specification**:
Design tests for the DomainClassifier class.

**Output Files**:
- `tests/unit/classification/domain-classifier.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: keyword-based classification (high confidence)
- [ ] Tests cover: LLM fallback for ambiguous queries (low confidence)
- [ ] Tests cover: ClassificationResult interface
- [ ] Tests mock Anthropic client for LLM tests
- [ ] All tests FAIL

**Context Files**:
- `src/types/domains.ts` (DomainTag, normalizeDomain contract)
- `src/orchestrator/synthesis-orchestrator.ts` (lines 442-552 - existing inferDomain)

**Verification**:
```bash
npx vitest run tests/unit/classification/domain-classifier.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P2-CLASS-002: Implement Domain Classifier (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P2-CLASS-002` |
| **Title** | TDD: Implement DomainClassifier to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P2-CLASS-001` |
| **Blocks** | `P2-CLASS-003` |
| **LOC** | ~150 |

**Specification**:
Implement DomainClassifier per ADR-008 specification.

**Output Files**:
- `src/classification/domain-classifier.ts` (new)

**Contract Requirements** (from ADR-008-contracts.md - Contract 9):
- MUST call `normalizeDomain(llmOutput, fallbackDomain)` on LLM response
- MUST return valid DomainTag from DomainTagSchema
- ambiguityThreshold default: 0.7

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Uses normalizeDomain() for LLM output
- [ ] Keyword classification for confident matches
- [ ] LLM only for ambiguous queries

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/classification/domain-classifier.test.ts
```

---

#### Task P2-CLASS-003: Integrate Domain Classifier into Orchestrator

| Field | Value |
|-------|-------|
| **ID** | `P2-CLASS-003` |
| **Title** | Integrate domain classifier into orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P2-CLASS-002` |
| **Blocks** | `P2-PHASE-INT` |
| **LOC** | ~40 |

**Specification**:
Add classification config and replace inferDomain with DomainClassifier.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md - Contract 1):
- Add `classification?: { useLLM?: boolean; ambiguityThreshold?: number }` to config
- Use DomainClassifier when `classification.useLLM` is true

**Acceptance Criteria**:
- [ ] Config option for LLM classification
- [ ] Backward compatible (default to keyword-only)
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### 2.2 Hypothesis Deduplication

#### Task P2-DEDUP-001: Design Deduplicator Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P2-DEDUP-001` |
| **Title** | TDD: Design failing tests for hypothesis deduplicator |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P1-PHASE-INT` |
| **Blocks** | `P2-DEDUP-002` |
| **LOC** | ~100 |

**Specification**:
Design tests for the HypothesisDeduplicator class.

**Output Files**:
- `tests/unit/deduplication/hypothesis-dedup.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: deduplicate() returns unique and duplicates
- [ ] Tests cover: similarity threshold configuration
- [ ] Tests cover: FIFO eviction at maxStoredEmbeddings
- [ ] Tests cover: cosine similarity calculation
- [ ] All tests FAIL

**Context Files**:
- `src/types/hypothesis.ts` (Hypothesis schema)

**Verification**:
```bash
npx vitest run tests/unit/deduplication/hypothesis-dedup.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P2-DEDUP-002: Implement Hypothesis Deduplicator (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P2-DEDUP-002` |
| **Title** | TDD: Implement HypothesisDeduplicator to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P2-DEDUP-001` |
| **Blocks** | `P2-DEDUP-003` |
| **LOC** | ~120 |

**Specification**:
Implement HypothesisDeduplicator per ADR-008 specification.

**Output Files**:
- `src/deduplication/hypothesis-dedup.ts` (new)

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Default similarityThreshold: 0.85
- [ ] Default maxStoredEmbeddings: 10000
- [ ] FIFO eviction when limit reached

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/deduplication/hypothesis-dedup.test.ts
```

---

#### Task P2-DEDUP-003: Integrate Deduplicator into Orchestrator

| Field | Value |
|-------|-------|
| **ID** | `P2-DEDUP-003` |
| **Title** | Integrate deduplicator into orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P2-DEDUP-002` |
| **Blocks** | `P2-PHASE-INT` |
| **LOC** | ~30 |

**Specification**:
Add deduplication config and integrate into hypothesis synthesis stage.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md - Contract 1):
- Add `deduplication?: { enabled?: boolean; similarityThreshold?: number; maxStoredEmbeddings?: number }` to config

**Acceptance Criteria**:
- [ ] Config option for deduplication
- [ ] Deduplicate after hypothesis synthesis stage
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### 2.3 Confidence Calibration

#### Task P2-CAL-001: Design Confidence Calibrator Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P2-CAL-001` |
| **Title** | TDD: Design failing tests for confidence calibrator |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P1-PHASE-INT` |
| **Blocks** | `P2-CAL-002` |
| **LOC** | ~100 |

**Specification**:
Design tests for the ConfidenceCalibrator class.

**Output Files**:
- `tests/unit/calibration/confidence-tracker.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: recordOutcome() stores calibration records
- [ ] Tests cover: adjustConfidence() returns raw when insufficient samples
- [ ] Tests cover: adjustConfidence() adjusts toward observed pass rate
- [ ] Tests cover: getCalibrationStats() returns bucket statistics
- [ ] All tests FAIL

**Context Files**:
- `src/types/hypothesis.ts` (ScoredHypothesis, Verdict)

**Verification**:
```bash
npx vitest run tests/unit/calibration/confidence-tracker.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P2-CAL-002: Implement Confidence Calibrator (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P2-CAL-002` |
| **Title** | TDD: Implement ConfidenceCalibrator to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P2-CAL-001` |
| **Blocks** | `P2-CAL-003` |
| **LOC** | ~120 |

**Specification**:
Implement ConfidenceCalibrator per ADR-008 specification.

**Output Files**:
- `src/calibration/confidence-tracker.ts` (new)

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Default minSamplesForAdjustment: 50
- [ ] 5 buckets: 0-20%, 20-40%, 40-60%, 60-80%, 80-100%

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/calibration/confidence-tracker.test.ts
```

---

#### Task P2-CAL-003: Integrate Calibrator into Orchestrator

| Field | Value |
|-------|-------|
| **ID** | `P2-CAL-003` |
| **Title** | Integrate confidence calibrator into orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P2-CAL-002` |
| **Blocks** | `P2-PHASE-INT` |
| **LOC** | ~30 |

**Specification**:
Add calibration config and integrate into hypothesis challenge stage.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Contract Requirements**:
- Add `calibration?: { enabled?: boolean; minSamplesForAdjustment?: number }` to config

**Acceptance Criteria**:
- [ ] Config option for calibration
- [ ] Record outcomes after challenge stage
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### Task P2-PHASE-INT: Phase 2 Integration Tests

| Field | Value |
|-------|-------|
| **ID** | `P2-PHASE-INT` |
| **Title** | Phase 2 integration tests |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | N/A (integration) |
| **Requires** | `P2-CLASS-003`, `P2-DEDUP-003`, `P2-CAL-003` |
| **Blocks** | Phase 3 tasks |
| **LOC** | ~80 |

**Specification**:
Integration tests verifying Phase 2 components work together.

**Output Files**:
- `tests/integration/phase2-intelligence.test.ts` (new)

**Acceptance Criteria**:
- [ ] Domain classifier integrates with orchestrator
- [ ] Deduplication removes similar hypotheses
- [ ] Calibration records outcomes

**Verification**:
```bash
npx vitest run tests/integration/phase2-intelligence.test.ts
```

---

## Phase 3: Performance & Features (Prompt Caching, Streaming, Evidence Gatherer)

### 3.1 Prompt Caching

#### Task P3-CACHE-001: Design Prompt Caching Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P3-CACHE-001` |
| **Title** | TDD: Design failing tests for prompt caching |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P2-PHASE-INT` |
| **Blocks** | `P3-CACHE-002` |
| **LOC** | ~80 |

**Specification**:
Design tests for prompt caching in BaseAgent.callLLM().

**Output Files**:
- `tests/unit/agents/prompt-caching.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: cache_control added when enableCaching=true
- [ ] Tests cover: no cache_control when enableCaching=false
- [ ] Tests cover: cache hit logging
- [ ] All tests FAIL

**Context Files**:
- `src/agents/base-agent.ts` (callLLM method)

**Verification**:
```bash
npx vitest run tests/unit/agents/prompt-caching.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P3-CACHE-002: Implement Prompt Caching (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P3-CACHE-002` |
| **Title** | TDD: Implement prompt caching in BaseAgent |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P3-CACHE-001` |
| **Blocks** | `P3-CACHE-003` |
| **LOC** | ~60 |

**Specification**:
Add prompt caching support to BaseAgent.callLLM() per ADR-008 specification.

**Output Files**:
- `src/agents/base-agent.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md - Contract 2):
- Add `enableCaching?: boolean` to callLLM options
- Use `cache_control: { type: 'ephemeral' }` for system prompts
- Log cache hits via logger

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] System prompt uses cache_control when enabled
- [ ] Cache hit/creation tokens logged

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/agents/prompt-caching.test.ts
```

---

#### Task P3-CACHE-003: Integrate Prompt Caching Config

| Field | Value |
|-------|-------|
| **ID** | `P3-CACHE-003` |
| **Title** | Add prompt caching config to orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P3-CACHE-002` |
| **Blocks** | `P3-PHASE-INT` |
| **LOC** | ~20 |

**Specification**:
Add promptCaching config option and enable caching for all agents.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Acceptance Criteria**:
- [ ] Config: `promptCaching?: { enabled?: boolean }`
- [ ] Pass enableCaching to all agent callLLM calls
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### 3.2 Streaming Responses

#### Task P3-STREAM-001: Design Streaming Handler Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P3-STREAM-001` |
| **Title** | TDD: Design failing tests for streaming handler |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P2-PHASE-INT` |
| **Blocks** | `P3-STREAM-002` |
| **LOC** | ~100 |

**Specification**:
Design tests for StreamingOrchestrator.

**Output Files**:
- `tests/unit/streaming/stream-handler.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: StreamEvent interface
- [ ] Tests cover: runStreaming() yields events
- [ ] Tests cover: stage_start, stage_complete, token, error event types
- [ ] All tests FAIL

**Verification**:
```bash
npx vitest run tests/unit/streaming/stream-handler.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P3-STREAM-002: Implement Streaming Handler (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P3-STREAM-002` |
| **Title** | TDD: Implement StreamingOrchestrator to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P3-STREAM-001` |
| **Blocks** | `P3-STREAM-003` |
| **LOC** | ~100 |

**Specification**:
Implement StreamingOrchestrator per ADR-008 specification.

**Output Files**:
- `src/streaming/stream-handler.ts` (new)

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Yields StreamEvent objects
- [ ] Uses Anthropic streaming API

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/streaming/stream-handler.test.ts
```

---

#### Task P3-STREAM-003: Add Streaming CLI Flag

| Field | Value |
|-------|-------|
| **ID** | `P3-STREAM-003` |
| **Title** | Add --stream CLI flag |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P3-STREAM-002` |
| **Blocks** | `P3-PHASE-INT` |
| **LOC** | ~40 |

**Specification**:
Add --stream flag to CLI and integrate StreamingOrchestrator.

**Output Files**:
- `src/cli.ts` (modify)
- `src/orchestrator/synthesis-orchestrator.ts` (modify)

**Acceptance Criteria**:
- [ ] `--stream` flag recognized in CLI
- [ ] Config: `streaming?: { enabled?: boolean }`
- [ ] Stream events displayed in terminal

**Verification**:
```bash
npx tsc --noEmit
node dist/cli.js --help | grep -q "\-\-stream"
```

---

### 3.3 Evidence Gatherer

#### Task P3-EVID-001: Design Evidence Gatherer Tests (TDD Red)

| Field | Value |
|-------|-------|
| **ID** | `P3-EVID-001` |
| **Title** | TDD: Design failing tests for evidence gatherer agent |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | `red` |
| **Requires** | `P2-PHASE-INT` |
| **Blocks** | `P3-EVID-002` |
| **LOC** | ~120 |

**Specification**:
Design tests for EvidenceGathererAgent.

**Output Files**:
- `tests/unit/agents/evidence-gatherer.test.ts` (new)

**Acceptance Criteria**:
- [ ] Tests cover: EvidenceGathererAgent extends BaseAgent
- [ ] Tests cover: execute() returns EvidenceResult
- [ ] Tests cover: Evidence schema validation
- [ ] Tests cover: evidenceStrength classification
- [ ] Tests cover: AbortSignal handling
- [ ] All tests FAIL

**Context Files**:
- `src/agents/base-agent.ts` (BaseAgent contract)
- `src/types/hypothesis.ts` (ScoredHypothesis)
- `src/types/domains.ts` (Citation schema)

**Verification**:
```bash
npx vitest run tests/unit/agents/evidence-gatherer.test.ts 2>&1 | grep -q "FAIL"
```

---

#### Task P3-EVID-002: Implement Evidence Gatherer Agent (TDD Green)

| Field | Value |
|-------|-------|
| **ID** | `P3-EVID-002` |
| **Title** | TDD: Implement EvidenceGathererAgent to pass tests |
| **Agent** | `apex-developer` |
| **TDD Phase** | `green` |
| **Requires** | `P3-EVID-001` |
| **Blocks** | `P3-EVID-003` |
| **LOC** | ~180 |

**Specification**:
Implement EvidenceGathererAgent per ADR-008 specification.

**Output Files**:
- `src/agents/evidence-gatherer.ts` (new)

**Contract Requirements** (from ADR-008-contracts.md - Contract 2):
- MUST extend `BaseAgent<EvidenceRequest, EvidenceResult>`
- MUST accept `AbortSignal` in execute()
- Default all citations to `verified: false`

**Acceptance Criteria**:
- [ ] All tests pass
- [ ] Extends BaseAgent correctly
- [ ] Default model: claude-sonnet-4-20250514
- [ ] Citations default to verified: false

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit/agents/evidence-gatherer.test.ts
```

---

#### Task P3-EVID-003: Define EvidencedHypothesis Schema

| Field | Value |
|-------|-------|
| **ID** | `P3-EVID-003` |
| **Title** | Add EvidencedHypothesisSchema to types |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P3-EVID-002` |
| **Blocks** | `P3-EVID-004` |
| **LOC** | ~30 |

**Specification**:
Extend hypothesis schema chain with EvidencedHypothesis.

**Output Files**:
- `src/types/hypothesis.ts` (modify)

**Contract Requirements** (from ADR-008-contracts.md - Contract 7):
- Add `EvidencedHypothesisSchema = ScoredHypothesisSchema.extend({ evidence: EvidenceSchema })`

**Acceptance Criteria**:
- [ ] EvidencedHypothesisSchema exported
- [ ] Extends ScoredHypothesisSchema
- [ ] TypeScript compiles

**Verification**:
```bash
npx tsc --noEmit
```

---

#### Task P3-EVID-004: Integrate Evidence Gatherer into Orchestrator

| Field | Value |
|-------|-------|
| **ID** | `P3-EVID-004` |
| **Title** | Integrate evidence gatherer stage into orchestrator |
| **Agent** | `apex-integrator` |
| **TDD Phase** | `refactor` |
| **Requires** | `P3-EVID-003` |
| **Blocks** | `P3-PHASE-INT` |
| **LOC** | ~60 |

**Specification**:
Add evidence gathering as Stage 5 when enabled.

**Output Files**:
- `src/orchestrator/synthesis-orchestrator.ts` (modify)
- `src/context/pipeline-context.ts` (modify)

**Contract Requirements**:
- Add `setEvidencedHypotheses()` to PipelineContext
- Run evidence gathering after challenge stage when `enableEvidenceGatherer: true`

**Acceptance Criteria**:
- [ ] Stage 5 runs when enabled
- [ ] PipelineContext stores evidenced hypotheses
- [ ] Existing tests pass

**Verification**:
```bash
npx tsc --noEmit
npx vitest run tests/unit
```

---

### Task P3-PHASE-INT: Phase 3 Integration Tests

| Field | Value |
|-------|-------|
| **ID** | `P3-PHASE-INT` |
| **Title** | Phase 3 integration tests |
| **Agent** | `apex-test-designer` |
| **TDD Phase** | N/A (integration) |
| **Requires** | `P3-CACHE-003`, `P3-STREAM-003`, `P3-EVID-004` |
| **Blocks** | `FINAL-REVIEW` |
| **LOC** | ~80 |

**Specification**:
Integration tests verifying Phase 3 components work together.

**Output Files**:
- `tests/integration/phase3-performance.test.ts` (new)

**Acceptance Criteria**:
- [ ] Prompt caching reduces token usage
- [ ] Streaming outputs events progressively
- [ ] Evidence gatherer produces EvidencedHypothesis

**Verification**:
```bash
npx vitest run tests/integration/phase3-performance.test.ts
```

---

## Final Review

### Task FINAL-REVIEW: Complete Implementation Review

| Field | Value |
|-------|-------|
| **ID** | `FINAL-REVIEW` |
| **Title** | Final implementation review |
| **Agent** | `apex-reviewer` |
| **TDD Phase** | N/A (review) |
| **Requires** | `P3-PHASE-INT` |
| **Blocks** | None |
| **LOC** | N/A |

**Specification**:
Review complete implementation against ADR-008 requirements.

**Acceptance Criteria**:
- [ ] All 38 tasks complete
- [ ] All tests pass: `npm test`
- [ ] TypeScript compiles: `npx tsc --noEmit`
- [ ] No circular dependencies: `npx madge --circular src/`
- [ ] No anti-patterns in new code

**Verification**:
```bash
npm test
npx tsc --noEmit
npx madge --circular src/
```

---

## Dependency Graph

```
Phase 0 (Setup):
  P0-001 (winston install)
    |
    v
Phase 1 (Foundation):
  P1-LOG-001 -> P1-LOG-002 -> P1-LOG-003 -----+
  P1-SCHEMA-001 -> P1-SCHEMA-002 -> P1-SCHEMA-003 -+-> P1-PHASE-INT
  P1-CB-001 -> P1-CB-002 -> P1-CB-003 --------+
                                               |
                                               v
Phase 2 (Intelligence):
  P2-CLASS-001 -> P2-CLASS-002 -> P2-CLASS-003 ---+
  P2-DEDUP-001 -> P2-DEDUP-002 -> P2-DEDUP-003 ---+-> P2-PHASE-INT
  P2-CAL-001 -> P2-CAL-002 -> P2-CAL-003 ---------+
                                                   |
                                                   v
Phase 3 (Performance & Features):
  P3-CACHE-001 -> P3-CACHE-002 -> P3-CACHE-003 -----------+
  P3-STREAM-001 -> P3-STREAM-002 -> P3-STREAM-003 --------+-> P3-PHASE-INT -> FINAL-REVIEW
  P3-EVID-001 -> P3-EVID-002 -> P3-EVID-003 -> P3-EVID-004 -+
```

---

## Critical Path

The critical path determines minimum implementation time:

```
P0-001 -> P1-LOG-001 -> P1-LOG-002 -> P1-LOG-003 -> P1-PHASE-INT ->
P2-CLASS-001 -> P2-CLASS-002 -> P2-CLASS-003 -> P2-PHASE-INT ->
P3-EVID-001 -> P3-EVID-002 -> P3-EVID-003 -> P3-EVID-004 -> P3-PHASE-INT -> FINAL-REVIEW
```

**Critical Path Tasks**: 15
**Estimated Critical Path LOC**: ~1,100

---

## Parallelization Opportunities

### Phase 1 (after P0-001):
- `P1-LOG-001`, `P1-SCHEMA-001`, `P1-CB-001` can run in parallel

### Phase 2 (after P1-PHASE-INT):
- `P2-CLASS-001`, `P2-DEDUP-001`, `P2-CAL-001` can run in parallel

### Phase 3 (after P2-PHASE-INT):
- `P3-CACHE-001`, `P3-STREAM-001`, `P3-EVID-001` can run in parallel

**Maximum Parallelization Factor**: 3

---

## File Summary

### New Files (8 source, 14 test)

| Source Path | Task | LOC |
|-------------|------|-----|
| `src/logging/logger.ts` | P1-LOG-002 | ~80 |
| `src/types/schema-version.ts` | P1-SCHEMA-002 | ~50 |
| `src/resilience/agent-circuit-breaker.ts` | P1-CB-002 | ~80 |
| `src/classification/domain-classifier.ts` | P2-CLASS-002 | ~150 |
| `src/deduplication/hypothesis-dedup.ts` | P2-DEDUP-002 | ~120 |
| `src/calibration/confidence-tracker.ts` | P2-CAL-002 | ~120 |
| `src/streaming/stream-handler.ts` | P3-STREAM-002 | ~100 |
| `src/agents/evidence-gatherer.ts` | P3-EVID-002 | ~180 |

### Modified Files (6)

| Path | Tasks |
|------|-------|
| `package.json` | P0-001 |
| `src/context/pipeline-context.ts` | P1-LOG-003, P3-EVID-004 |
| `src/types/trace.ts` | P1-SCHEMA-003 |
| `src/types/hypothesis.ts` | P3-EVID-003 |
| `src/orchestrator/synthesis-orchestrator.ts` | P1-CB-003, P2-CLASS-003, P2-DEDUP-003, P2-CAL-003, P3-CACHE-003, P3-STREAM-003, P3-EVID-004 |
| `src/agents/base-agent.ts` | P3-CACHE-002 |
| `src/cli.ts` | P3-STREAM-003 |

### New Test Files (14)

| Path | Task |
|------|------|
| `tests/unit/logging/logger.test.ts` | P1-LOG-001 |
| `tests/unit/types/schema-version.test.ts` | P1-SCHEMA-001 |
| `tests/unit/resilience/agent-circuit-breaker.test.ts` | P1-CB-001 |
| `tests/unit/classification/domain-classifier.test.ts` | P2-CLASS-001 |
| `tests/unit/deduplication/hypothesis-dedup.test.ts` | P2-DEDUP-001 |
| `tests/unit/calibration/confidence-tracker.test.ts` | P2-CAL-001 |
| `tests/unit/agents/prompt-caching.test.ts` | P3-CACHE-001 |
| `tests/unit/streaming/stream-handler.test.ts` | P3-STREAM-001 |
| `tests/unit/agents/evidence-gatherer.test.ts` | P3-EVID-001 |
| `tests/integration/phase1-foundation.test.ts` | P1-PHASE-INT |
| `tests/integration/phase2-intelligence.test.ts` | P2-PHASE-INT |
| `tests/integration/phase3-performance.test.ts` | P3-PHASE-INT |

---

## References

- **ADR-008**: `docs/architecture/ADR-008-platform-enhancement-suite.md`
- **Contracts**: `docs/architecture/ADR-008-contracts.md`
- **Test Pattern**: `tests/unit/circuit-breaker.test.ts`
- **Vitest Config**: Uses vitest 2.0.0 with TypeScript
