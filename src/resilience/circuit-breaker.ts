/**
 * Circuit Breaker implementation for API resilience
 *
 * Implements the circuit breaker pattern with three states:
 * - CLOSED: Normal operation, requests allowed
 * - OPEN: Failure threshold reached, requests rejected
 * - HALF_OPEN: Testing if service recovered, limited requests allowed
 */

export type CircuitBreakerState = 'CLOSED' | 'OPEN' | 'HALF_OPEN';

export interface CircuitBreakerConfig {
  /** Number of consecutive failures before opening circuit */
  failureThreshold: number;
  /** Milliseconds to wait before attempting recovery (OPEN -> HALF_OPEN) */
  resetTimeoutMs: number;
  /** Optional name for this circuit (useful for logging) */
  name?: string;
}

export class CircuitBreaker {
  private state: CircuitBreakerState = 'CLOSED';
  private failureCount = 0;
  private lastFailureTime: number | null = null;
  private readonly config: Required<CircuitBreakerConfig>;

  constructor(config: CircuitBreakerConfig) {
    this.config = {
      ...config,
      name: config.name ?? 'default',
    };
  }

  /**
   * Check if an operation can be executed.
   * Returns true if circuit allows requests, false otherwise.
   * Also handles OPEN -> HALF_OPEN transition when timeout has elapsed.
   */
  canExecute(): boolean {
    if (this.state === 'CLOSED') {
      return true;
    }

    if (this.state === 'OPEN') {
      if (this.shouldAttemptReset()) {
        this.state = 'HALF_OPEN';
        return true;
      }
      return false;
    }

    // HALF_OPEN: allow probe request
    return true;
  }

  /**
   * Record a successful operation.
   * Resets failure count and transitions HALF_OPEN -> CLOSED.
   */
  recordSuccess(): void {
    this.failureCount = 0;
    this.lastFailureTime = null;

    if (this.state === 'HALF_OPEN') {
      this.state = 'CLOSED';
    }
  }

  /**
   * Record a failed operation.
   * Increments failure count and may transition to OPEN state.
   */
  recordFailure(): void {
    this.failureCount++;
    this.lastFailureTime = Date.now();

    if (this.state === 'HALF_OPEN') {
      // Probe failed, reopen circuit
      this.state = 'OPEN';
      return;
    }

    if (this.failureCount >= this.config.failureThreshold) {
      this.state = 'OPEN';
    }
  }

  /**
   * Get the current circuit state.
   */
  getState(): CircuitBreakerState {
    return this.state;
  }

  /**
   * Reset the circuit breaker to initial CLOSED state.
   * Clears all failure tracking.
   */
  reset(): void {
    this.state = 'CLOSED';
    this.failureCount = 0;
    this.lastFailureTime = null;
  }

  /**
   * Check if enough time has passed to attempt recovery.
   */
  private shouldAttemptReset(): boolean {
    if (this.lastFailureTime === null) {
      return true;
    }
    return Date.now() - this.lastFailureTime >= this.config.resetTimeoutMs;
  }
}
