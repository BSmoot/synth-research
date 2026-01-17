# ADR-005: Timeout and Circuit Breaker Strategy

**Status**: Proposed
**Date**: 2026-01-17

---

## Context

The synthesis pipeline makes multiple sequential LLM API calls through the orchestrator. Each stage (domain-analysis, cross-pollination, hypothesis-synthesis, hypothesis-challenge) invokes the Anthropic API with potential for:

1. **Unbounded latency**: API calls can hang indefinitely during service degradation
2. **Cascading failures**: A slow or failing API can cause the entire pipeline to stall
3. **Resource exhaustion**: Hung connections consume memory and connection pool slots
4. **Poor user experience**: CLI appears frozen with no feedback

Current implementation analysis:
- `OrchestratorConfig` defines `timeoutMs?: number` (default 120000) but it is **never used**
- `withRetry()` method in `synthesis-orchestrator.ts` (lines 458-478) implements retry with exponential backoff but **no timeout enforcement**
- No circuit breaker protects against repeated API failures
- Each agent's `callLLM()` method has no timeout wrapper

Relevant code locations:
- `src/orchestrator/synthesis-orchestrator.ts`: lines 24-32 (config), lines 458-478 (withRetry)
- `src/agents/base-agent.ts`: `callLLM()` method

## Decision

Implement **timeout enforcement with AbortController** and a **simple circuit breaker** for API resilience:

### Timeout Strategy

Use `AbortController` to enforce timeouts on all LLM API calls. The Anthropic SDK accepts an `AbortSignal` for cancellation support.

```typescript
private async withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), ms);

  try {
    return await promise;
  } finally {
    clearTimeout(timeoutId);
  }
}
```

Integrate timeout into the existing `withRetry()` method:

```typescript
private async withRetry<T>(
  fn: () => Promise<T>,
  retries = this.config.maxRetries ?? 2
): Promise<T> {
  const timeoutMs = this.config.timeoutMs ?? 120000;
  let lastError: Error | undefined;

  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      return await this.withTimeout(fn(), timeoutMs);
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error));
      
      if (error instanceof TimeoutError) {
        this.circuitBreaker.recordFailure();
        throw error;
      }

      if (attempt < retries) {
        const delay = 1000 * Math.pow(2, attempt);
        await new Promise((resolve) => setTimeout(resolve, delay));
      }
    }
  }

  throw lastError;
}
```

### Circuit Breaker Strategy

Implement a lightweight circuit breaker with three states:

| State | Behavior | Transition Trigger |
|-------|----------|-------------------|
| **CLOSED** | Normal operation, all requests allowed | 3 consecutive failures -> OPEN |
| **OPEN** | Fail-fast, all requests rejected | 30 seconds elapsed -> HALF_OPEN |
| **HALF_OPEN** | Allow 1 probe request | Success -> CLOSED, Failure -> OPEN |

```typescript
interface CircuitBreakerConfig {
  failureThreshold: number;     // Default: 3
  resetTimeoutMs: number;       // Default: 30000
  halfOpenMaxProbes: number;    // Default: 1
}

class CircuitBreaker {
  private state: 'CLOSED' | 'OPEN' | 'HALF_OPEN' = 'CLOSED';
  private consecutiveFailures = 0;
  private lastFailureTime?: Date;
  private probeCount = 0;

  canExecute(): boolean {
    if (this.state === 'CLOSED') return true;
    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        this.probeCount = 0;
        return true;
      }
      return false;
    }
    return this.probeCount < this.config.halfOpenMaxProbes;
  }

  recordSuccess(): void {
    this.consecutiveFailures = 0;
    this.state = 'CLOSED';
  }

  recordFailure(): void {
    this.consecutiveFailures++;
    this.lastFailureTime = new Date();
    
    if (this.state === 'HALF_OPEN' || 
        this.consecutiveFailures >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  private shouldAttemptReset(): boolean {
    if (!this.lastFailureTime) return true;
    return Date.now() - this.lastFailureTime.getTime() >= this.config.resetTimeoutMs;
  }
}
```

### Integration with Orchestrator

```typescript
export class SynthesisOrchestrator {
  private readonly circuitBreaker: CircuitBreaker;

  constructor(config: OrchestratorConfig = {}) {
    this.circuitBreaker = new CircuitBreaker({
      failureThreshold: 3,
      resetTimeoutMs: 30000,
      halfOpenMaxProbes: 1,
    });
  }

  private async callWithResilience<T>(fn: () => Promise<T>): Promise<T> {
    if (!this.circuitBreaker.canExecute()) {
      throw new CircuitOpenError('API circuit breaker is open');
    }

    try {
      const result = await this.withRetry(fn);
      this.circuitBreaker.recordSuccess();
      return result;
    } catch (error) {
      this.circuitBreaker.recordFailure();
      throw error;
    }
  }
}
```

### Error Types

```typescript
export class TimeoutError extends Error {
  constructor(operationName: string, timeoutMs: number) {
    super(`Operation "${operationName}" timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
  }
}

export class CircuitOpenError extends Error {
  constructor(message: string) {
    super(message);
    this.name = 'CircuitOpenError';
  }
}
```

## Rationale

1. **AbortController for timeouts**: Native browser/Node.js pattern. Anthropic SDK supports AbortSignal for cancellation. Clean cleanup of pending requests.

2. **3-failure threshold**: Balances responsiveness (detect outages quickly) with tolerance for transient errors. Lower than industry standard of 5 because each pipeline run is user-initiated.

3. **30-second reset timeout**: Matches typical cloud API recovery time. Short enough to resume quickly, long enough to avoid hammering a recovering service.

4. **Separate circuit breaker instance per orchestrator**: Each CLI invocation gets fresh state. Appropriate for CLI tool without persistent process.

5. **Fail-fast in OPEN state**: Returns error immediately rather than waiting for timeout. Better UX - users get immediate feedback.

## Consequences

### Positive
- Bounded latency for all API calls
- Fail-fast during API outages
- Better user experience with predictable timing
- Resource cleanup on timeout
- Prevents cascading failures in pipeline

### Negative
- Additional complexity in orchestrator
- Circuit breaker state not persisted between runs (acceptable for CLI)
- Users may see circuit-open errors during recovery window

### Risks
- **Risk**: Timeout too aggressive causes false failures
  **Mitigation**: Default 120s is generous; configurable via `timeoutMs`

- **Risk**: Circuit breaker opens during transient network issues
  **Mitigation**: 3-failure threshold requires sustained problems

## Implementation Notes

Files to modify:
- `src/orchestrator/synthesis-orchestrator.ts`: Add circuit breaker, modify `withRetry()`
- `src/types/errors.ts` (new): Define `TimeoutError`, `CircuitOpenError`
- `src/resilience/circuit-breaker.ts` (new): Circuit breaker implementation

Configuration changes:
```typescript
interface OrchestratorConfig {
  // Existing (now enforced)
  timeoutMs?: number;
  maxRetries?: number;

  // New
  circuitBreaker?: {
    enabled?: boolean;       // Default: true
    failureThreshold?: number;
    resetTimeoutMs?: number;
  };
}
```

Testing approach:
- Unit test circuit breaker state transitions
- Integration test with mock API that simulates failures
- Manual test with network disconnection

## Confidence

**HIGH** - Standard resilience patterns (timeout, circuit breaker) with well-understood behavior. Implementation is straightforward with Node.js AbortController.
