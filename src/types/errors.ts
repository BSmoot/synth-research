/**
 * Custom error types for resilience patterns
 *
 * These errors follow the BudgetExceededError pattern established in
 * synthesis-orchestrator.ts:34-39
 */

/**
 * Error thrown when an operation exceeds its configured timeout.
 * Used with AbortController to cancel long-running LLM API calls.
 */
export class TimeoutError extends Error {
  readonly operationName: string;
  readonly timeoutMs: number;

  constructor(operationName: string, timeoutMs: number) {
    super(`Operation '${operationName}' timed out after ${timeoutMs}ms`);
    this.name = 'TimeoutError';
    this.operationName = operationName;
    this.timeoutMs = timeoutMs;
  }
}

/**
 * Error thrown when a circuit breaker is in the OPEN state.
 * Indicates that requests are being rejected to protect the system.
 */
export class CircuitOpenError extends Error {
  readonly circuitName: string;

  constructor(circuitName: string) {
    super(`Circuit '${circuitName}' is open - requests are being rejected`);
    this.name = 'CircuitOpenError';
    this.circuitName = circuitName;
  }
}

/**
 * Error thrown during hypothesis integration phase.
 * Used to distinguish integration errors from other pipeline failures.
 */
export class IntegrationError extends Error {
  readonly phase: 'clustering' | 'synthesis' | 'dependency' | 'coverage';
  readonly context: Record<string, unknown>;

  constructor(
    message: string,
    phase: IntegrationError['phase'],
    context: Record<string, unknown> = {}
  ) {
    super(message);
    this.name = 'IntegrationError';
    this.phase = phase;
    this.context = context;
  }
}
