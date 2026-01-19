/**
 * Unit tests for AgentCircuitBreakerRegistry
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Registry manages independent breakers per agent
 * - Failures in one agent don't affect others
 * - Configuration is applied correctly to created breakers
 * - Registry-wide operations (getStatus, resetAll) work correctly
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { AgentCircuitBreakerRegistry } from '../../../src/resilience/agent-circuit-breaker.js';

describe('AgentCircuitBreakerRegistry', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create registry with default config', () => {
      const registry = new AgentCircuitBreakerRegistry();

      expect(registry).toBeDefined();
      expect(registry.getStatus()).toEqual({});
    });

    it('should create registry with custom config', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 5,
        resetTimeoutMs: 60000,
      });

      expect(registry).toBeDefined();
      expect(registry.getStatus()).toEqual({});
    });
  });

  describe('getBreaker()', () => {
    it('should create new breaker on first access for agent name', () => {
      const registry = new AgentCircuitBreakerRegistry();

      const breaker = registry.getBreaker('domain-analyst');

      expect(breaker).toBeDefined();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should return same breaker instance for same agent name', () => {
      const registry = new AgentCircuitBreakerRegistry();

      const breaker1 = registry.getBreaker('domain-analyst');
      const breaker2 = registry.getBreaker('domain-analyst');

      expect(breaker1).toBe(breaker2);
    });

    it('should return different breakers for different agent names', () => {
      const registry = new AgentCircuitBreakerRegistry();

      const breakerAnalyst = registry.getBreaker('domain-analyst');
      const breakerPollinator = registry.getBreaker('cross-pollinator');

      expect(breakerAnalyst).not.toBe(breakerPollinator);
    });

    it('should create breaker with configured threshold and timeout', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      });

      const breaker = registry.getBreaker('test-agent');

      // Verify config by testing behavior
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Verify timeout
      vi.advanceTimersByTime(4999);
      expect(breaker.canExecute()).toBe(false);

      vi.advanceTimersByTime(1);
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('breaker independence', () => {
    it('should maintain independent failure counts per agent', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      const breakerA = registry.getBreaker('agent-a');
      const breakerB = registry.getBreaker('agent-b');

      // Add failures to agent-a
      breakerA.recordFailure();
      breakerA.recordFailure();

      // Agent-a should still be closed (threshold is 3)
      expect(breakerA.getState()).toBe('CLOSED');

      // Agent-b should be unaffected
      expect(breakerB.getState()).toBe('CLOSED');

      // One more failure opens agent-a
      breakerA.recordFailure();
      expect(breakerA.getState()).toBe('OPEN');

      // Agent-b should still be closed
      expect(breakerB.getState()).toBe('CLOSED');
    });

    it('should not cascade domain-analyst failure to cross-pollinator', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      const analystBreaker = registry.getBreaker('domain-analyst');
      const pollinatorBreaker = registry.getBreaker('cross-pollinator');

      // Open domain-analyst circuit
      analystBreaker.recordFailure();
      analystBreaker.recordFailure();

      expect(analystBreaker.getState()).toBe('OPEN');
      expect(analystBreaker.canExecute()).toBe(false);

      // Cross-pollinator should still work
      expect(pollinatorBreaker.getState()).toBe('CLOSED');
      expect(pollinatorBreaker.canExecute()).toBe(true);
    });

    it('should allow one agent to succeed while another fails', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      const breakerA = registry.getBreaker('agent-a');
      const breakerB = registry.getBreaker('agent-b');

      // Agent-a has failures
      breakerA.recordFailure();
      breakerA.recordFailure();
      expect(breakerA.getState()).toBe('OPEN');

      // Agent-b has successes
      breakerB.recordSuccess();
      expect(breakerB.getState()).toBe('CLOSED');

      // Agent-b can still execute
      expect(breakerB.canExecute()).toBe(true);

      // Agent-a cannot
      expect(breakerA.canExecute()).toBe(false);
    });
  });

  describe('getStatus()', () => {
    it('should return empty object when no breakers registered', () => {
      const registry = new AgentCircuitBreakerRegistry();

      const status = registry.getStatus();

      expect(status).toEqual({});
    });

    it('should return state of all registered breakers', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Create breakers for three agents
      registry.getBreaker('domain-analyst');
      registry.getBreaker('cross-pollinator');
      const synthesizerBreaker = registry.getBreaker('hypothesis-synthesizer');

      // Open one of them
      synthesizerBreaker.recordFailure();
      synthesizerBreaker.recordFailure();

      const status = registry.getStatus();

      expect(status).toEqual({
        'domain-analyst': { state: 'CLOSED' },
        'cross-pollinator': { state: 'CLOSED' },
        'hypothesis-synthesizer': { state: 'OPEN' },
      });
    });

    it('should show correct state (CLOSED, OPEN, HALF_OPEN) for each breaker', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      });

      const breakerClosed = registry.getBreaker('agent-closed');
      const breakerOpen = registry.getBreaker('agent-open');
      const breakerHalfOpen = registry.getBreaker('agent-half-open');

      // Set up states
      breakerClosed.recordSuccess(); // Stays CLOSED

      breakerOpen.recordFailure();
      breakerOpen.recordFailure(); // Goes OPEN

      breakerHalfOpen.recordFailure();
      breakerHalfOpen.recordFailure(); // Goes OPEN
      vi.advanceTimersByTime(5000);
      breakerHalfOpen.canExecute(); // Transitions to HALF_OPEN

      const status = registry.getStatus();

      expect(status).toEqual({
        'agent-closed': { state: 'CLOSED' },
        'agent-open': { state: 'OPEN' },
        'agent-half-open': { state: 'HALF_OPEN' },
      });
    });
  });

  describe('resetAll()', () => {
    it('should reset all breakers to CLOSED state', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      const breakerA = registry.getBreaker('agent-a');
      const breakerB = registry.getBreaker('agent-b');
      const breakerC = registry.getBreaker('agent-c');

      // Open multiple circuits
      breakerA.recordFailure();
      breakerA.recordFailure();

      breakerB.recordFailure();
      breakerB.recordFailure();

      breakerC.recordFailure();

      expect(breakerA.getState()).toBe('OPEN');
      expect(breakerB.getState()).toBe('OPEN');
      expect(breakerC.getState()).toBe('CLOSED');

      // Reset all
      registry.resetAll();

      expect(breakerA.getState()).toBe('CLOSED');
      expect(breakerB.getState()).toBe('CLOSED');
      expect(breakerC.getState()).toBe('CLOSED');
    });

    it('should clear failure counts for all breakers', () => {
      const registry = new AgentCircuitBreakerRegistry({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      const breakerA = registry.getBreaker('agent-a');
      const breakerB = registry.getBreaker('agent-b');

      // Add failures but not enough to open
      breakerA.recordFailure();
      breakerA.recordFailure();

      breakerB.recordFailure();

      // Reset all
      registry.resetAll();

      // Each agent should need full threshold again to open
      breakerA.recordFailure();
      expect(breakerA.getState()).toBe('CLOSED');
      breakerA.recordFailure();
      expect(breakerA.getState()).toBe('CLOSED');
      breakerA.recordFailure();
      expect(breakerA.getState()).toBe('OPEN');

      breakerB.recordFailure();
      expect(breakerB.getState()).toBe('CLOSED');
      breakerB.recordFailure();
      expect(breakerB.getState()).toBe('CLOSED');
      breakerB.recordFailure();
      expect(breakerB.getState()).toBe('OPEN');
    });
  });
});
