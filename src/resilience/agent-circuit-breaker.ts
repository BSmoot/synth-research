/**
 * Agent Circuit Breaker Registry
 *
 * Manages independent circuit breakers for different agent types.
 * Implements ADR-008 Phase 1.3: Per-Agent Circuit Breaker isolation.
 *
 * Features:
 * - Lazy initialization of breakers per agent
 * - Configurable failure threshold and reset timeout
 * - Registry-wide status reporting and reset operations
 * - Independent failure tracking per agent (no cascading failures)
 */

import { CircuitBreaker, CircuitBreakerConfig } from './circuit-breaker.js';

export class AgentCircuitBreakerRegistry {
  private readonly breakers: Map<string, CircuitBreaker> = new Map();
  private readonly defaultConfig: CircuitBreakerConfig;

  /**
   * Create a new registry with default configuration for all breakers.
   *
   * @param defaultConfig - Default configuration applied to all created breakers.
   *                       failureThreshold defaults to 3, resetTimeoutMs defaults to 30000.
   */
  constructor(defaultConfig: Partial<CircuitBreakerConfig> = {}) {
    this.defaultConfig = {
      failureThreshold: defaultConfig.failureThreshold ?? 3,
      resetTimeoutMs: defaultConfig.resetTimeoutMs ?? 30000,
    };
  }

  /**
   * Get or create a circuit breaker for the specified agent.
   *
   * Breakers are created lazily on first access and reused for subsequent calls
   * with the same agent name. Each breaker is configured with the registry's
   * default settings plus the agent name for identification.
   *
   * @param agentName - Unique identifier for the agent (e.g., 'domain-analyst')
   * @returns CircuitBreaker instance for this agent
   */
  getBreaker(agentName: string): CircuitBreaker {
    if (!this.breakers.has(agentName)) {
      this.breakers.set(
        agentName,
        new CircuitBreaker({
          ...this.defaultConfig,
          name: agentName,
        })
      );
    }
    return this.breakers.get(agentName)!;
  }

  /**
   * Get the current state of all registered circuit breakers.
   *
   * @returns Object mapping agent names to their circuit breaker states.
   *          Returns empty object if no breakers have been created yet.
   */
  getStatus(): Record<string, { state: string }> {
    const status: Record<string, { state: string }> = {};
    for (const [name, breaker] of this.breakers) {
      status[name] = { state: breaker.getState() };
    }
    return status;
  }

  /**
   * Reset all circuit breakers to CLOSED state.
   *
   * This clears failure counts and reopens all circuits, allowing all agents
   * to execute again. Useful for recovery scenarios or manual intervention.
   */
  resetAll(): void {
    for (const breaker of this.breakers.values()) {
      breaker.reset();
    }
  }
}
