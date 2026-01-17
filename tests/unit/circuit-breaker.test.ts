/**
 * Unit tests for CircuitBreaker class
 * TDD Phase: RED - Tests written before implementation
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { CircuitBreaker, CircuitBreakerState } from '../../src/resilience/circuit-breaker.js';

describe('CircuitBreaker', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('constructor', () => {
    it('should create with valid config', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });
      expect(breaker).toBeDefined();
    });

    it('should start in CLOSED state', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should accept optional name', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
        name: 'testCircuit',
      });
      expect(breaker).toBeDefined();
    });
  });

  describe('canExecute()', () => {
    it('should return true when CLOSED', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });
      expect(breaker.canExecute()).toBe(true);
    });

    it('should return false when OPEN', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Trigger failures to open circuit
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.canExecute()).toBe(false);
    });

    it('should return true when HALF_OPEN for first probe', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open the circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Advance time to trigger HALF_OPEN
      vi.advanceTimersByTime(30000);

      // First call should transition to HALF_OPEN and allow
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });

  describe('recordSuccess()', () => {
    it('should keep circuit CLOSED when already CLOSED', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition HALF_OPEN to CLOSED', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Advance to HALF_OPEN
      vi.advanceTimersByTime(30000);
      breaker.canExecute(); // Triggers transition

      expect(breaker.getState()).toBe('HALF_OPEN');

      // Success should close
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should reset failure count', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      // Add some failures but not enough to open
      breaker.recordFailure();
      breaker.recordFailure();

      // Success resets count
      breaker.recordSuccess();

      // Now one failure shouldn't affect much
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
    });
  });

  describe('recordFailure()', () => {
    it('should stay CLOSED below threshold', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');

      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should transition to OPEN at threshold', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      breaker.recordFailure();
      breaker.recordFailure();
      breaker.recordFailure();

      expect(breaker.getState()).toBe('OPEN');
    });

    it('should transition HALF_OPEN to OPEN on failure', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();

      // Advance to HALF_OPEN
      vi.advanceTimersByTime(30000);
      breaker.canExecute();

      expect(breaker.getState()).toBe('HALF_OPEN');

      // Failure in HALF_OPEN should reopen
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('state transitions', () => {
    it('should complete full success cycle: CLOSED -> OPEN -> HALF_OPEN -> CLOSED', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Start CLOSED
      expect(breaker.getState()).toBe('CLOSED');

      // Failures open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Time passes, transition to HALF_OPEN
      vi.advanceTimersByTime(30000);
      breaker.canExecute();
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Success closes circuit
      breaker.recordSuccess();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should complete failure cycle: CLOSED -> OPEN -> HALF_OPEN -> OPEN', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Start CLOSED
      expect(breaker.getState()).toBe('CLOSED');

      // Failures open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Time passes
      vi.advanceTimersByTime(30000);
      breaker.canExecute();
      expect(breaker.getState()).toBe('HALF_OPEN');

      // Failure reopens circuit
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });
  });

  describe('timeout transitions', () => {
    it('should transition OPEN to HALF_OPEN after resetTimeoutMs', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 5000,
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
      expect(breaker.canExecute()).toBe(false);

      // Not enough time
      vi.advanceTimersByTime(4999);
      expect(breaker.canExecute()).toBe(false);

      // Now enough time
      vi.advanceTimersByTime(1);
      expect(breaker.canExecute()).toBe(true);
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });

  describe('reset()', () => {
    it('should return to CLOSED state', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');

      // Reset
      breaker.reset();
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should clear failure count', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });

      // Add some failures
      breaker.recordFailure();
      breaker.recordFailure();

      // Reset
      breaker.reset();

      // Need full threshold again to open
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
      breaker.recordFailure();
      expect(breaker.getState()).toBe('CLOSED');
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should allow execution after reset', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 2,
        resetTimeoutMs: 30000,
      });

      // Open circuit
      breaker.recordFailure();
      breaker.recordFailure();
      expect(breaker.canExecute()).toBe(false);

      // Reset
      breaker.reset();
      expect(breaker.canExecute()).toBe(true);
    });
  });

  describe('getState()', () => {
    it('should return CLOSED initially', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 3,
        resetTimeoutMs: 30000,
      });
      expect(breaker.getState()).toBe('CLOSED');
    });

    it('should return OPEN after threshold failures', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 30000,
      });
      breaker.recordFailure();
      expect(breaker.getState()).toBe('OPEN');
    });

    it('should return HALF_OPEN after timeout', () => {
      const breaker = new CircuitBreaker({
        failureThreshold: 1,
        resetTimeoutMs: 1000,
      });
      breaker.recordFailure();
      vi.advanceTimersByTime(1000);
      breaker.canExecute();
      expect(breaker.getState()).toBe('HALF_OPEN');
    });
  });
});
