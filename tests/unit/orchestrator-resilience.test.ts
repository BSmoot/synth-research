/**
 * Unit tests for SynthesisOrchestrator resilience features
 * Tests circuit breaker and timeout integration per ADR-005
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { SynthesisOrchestrator } from '../../src/orchestrator/synthesis-orchestrator.js';
import { CircuitOpenError, TimeoutError } from '../../src/types/errors.js';

// Mock Anthropic client
const createMockClient = (options?: {
  shouldFail?: boolean;
  failCount?: number;
  delay?: number;
}) => {
  let callCount = 0;
  const failCount = options?.failCount ?? Infinity;

  return {
    messages: {
      create: vi.fn().mockImplementation(async (params: unknown, opts?: { signal?: AbortSignal }) => {
        callCount++;

        // Check if we should abort
        if (opts?.signal?.aborted) {
          const error = new Error('Request aborted');
          error.name = 'AbortError';
          throw error;
        }

        // Handle delay
        if (options?.delay) {
          await new Promise((resolve, reject) => {
            const timeout = setTimeout(resolve, options.delay);
            opts?.signal?.addEventListener('abort', () => {
              clearTimeout(timeout);
              const error = new Error('Request aborted');
              error.name = 'AbortError';
              reject(error);
            });
          });
        }

        // Handle failures
        if (options?.shouldFail && callCount <= failCount) {
          throw new Error('API Error');
        }

        return {
          content: [{ type: 'text', text: '{}' }],
          usage: { input_tokens: 100, output_tokens: 50 },
        };
      }),
    },
  };
};

describe('SynthesisOrchestrator Resilience', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });

  afterEach(() => {
    vi.useRealTimers();
  });

  describe('OrchestratorConfig circuitBreaker option', () => {
    it('should accept circuitBreaker config option', () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: {
          enabled: true,
          failureThreshold: 5,
          resetTimeoutMs: 60000,
        },
      });

      const config = (orchestrator as any).config;
      expect(config.circuitBreaker).toBeDefined();
      expect(config.circuitBreaker.enabled).toBe(true);
      expect(config.circuitBreaker.failureThreshold).toBe(5);
      expect(config.circuitBreaker.resetTimeoutMs).toBe(60000);
    });

    it('should default circuitBreaker.enabled to false', () => {
      const orchestrator = new SynthesisOrchestrator({});

      const config = (orchestrator as any).config;
      expect(config.circuitBreaker?.enabled).toBeFalsy();
    });

    it('should use default threshold of 5 when enabled', () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true },
      });

      const config = (orchestrator as any).config;
      expect(config.circuitBreaker.failureThreshold).toBe(5);
    });

    it('should use default resetTimeoutMs of 30000 when enabled', () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true },
      });

      const config = (orchestrator as any).config;
      expect(config.circuitBreaker.resetTimeoutMs).toBe(30000);
    });
  });

  describe('timeoutMs enforcement', () => {
    it('should configure timeoutMs in config', () => {
      const orchestrator = new SynthesisOrchestrator({
        timeoutMs: 100,
      });

      const config = (orchestrator as any).config;
      expect(config.timeoutMs).toBe(100);
    });

    it('should use default timeoutMs of 120000 when not provided', () => {
      const orchestrator = new SynthesisOrchestrator({});

      const config = (orchestrator as any).config;
      expect(config.timeoutMs).toBe(120000);
    });
  });

  describe('circuit breaker integration', () => {
    it('should not use circuit breaker when disabled', () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: false },
      });

      const circuitBreaker = (orchestrator as any).circuitBreaker;
      expect(circuitBreaker).toBeUndefined();
    });

    it('should create circuit breaker when enabled', () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true },
      });

      const circuitBreaker = (orchestrator as any).circuitBreaker;
      expect(circuitBreaker).toBeDefined();
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should throw CircuitOpenError when circuit is open', async () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true, failureThreshold: 1 },
      });

      // Manually open the circuit
      const circuitBreaker = (orchestrator as any).circuitBreaker;
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('OPEN');

      // withRetry should throw CircuitOpenError immediately
      const withRetry = (orchestrator as any).withRetry.bind(orchestrator);
      await expect(withRetry(() => Promise.resolve('test'))).rejects.toThrow(CircuitOpenError);
    });

    it('should record success when operation succeeds', async () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true, failureThreshold: 3 },
      });

      const circuitBreaker = (orchestrator as any).circuitBreaker;

      // Record some failures (but not enough to open)
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Successful operation should reset failure count
      const withRetry = (orchestrator as any).withRetry.bind(orchestrator);
      await withRetry(() => Promise.resolve('success'));

      // Now need 3 more failures to open (failure count was reset)
      circuitBreaker.recordFailure();
      circuitBreaker.recordFailure();
      expect(circuitBreaker.getState()).toBe('CLOSED');
    });

    it('should record failure when operation fails', async () => {
      const orchestrator = new SynthesisOrchestrator({
        circuitBreaker: { enabled: true, failureThreshold: 2 },
        maxRetries: 0, // No retries - fail immediately
      });

      const circuitBreaker = (orchestrator as any).circuitBreaker;
      const withRetry = (orchestrator as any).withRetry.bind(orchestrator);

      // First failure
      await expect(withRetry(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('CLOSED');

      // Second failure opens circuit
      await expect(withRetry(() => Promise.reject(new Error('fail')))).rejects.toThrow();
      expect(circuitBreaker.getState()).toBe('OPEN');
    });
  });

  describe('signal propagation (behavioral)', () => {
    it('withRetry should pass signal to callback function', async () => {
      const orchestrator = new SynthesisOrchestrator({
        timeoutMs: 5000,
      });

      const withRetry = (orchestrator as any).withRetry.bind(orchestrator);
      let receivedSignal: AbortSignal | undefined;

      await withRetry((signal: AbortSignal) => {
        receivedSignal = signal;
        return Promise.resolve('done');
      });

      expect(receivedSignal).toBeDefined();
      expect(receivedSignal).toBeInstanceOf(AbortSignal);
      expect(receivedSignal!.aborted).toBe(false);
    });

    it('should abort and throw TimeoutError when timeout exceeds', async () => {
      vi.useRealTimers(); // Need real timers for this test

      const orchestrator = new SynthesisOrchestrator({
        timeoutMs: 50, // Very short timeout
        maxRetries: 0,
      });

      const withRetry = (orchestrator as any).withRetry.bind(orchestrator);

      // Operation that takes longer than timeout
      const slowOperation = (signal: AbortSignal) => new Promise((resolve, reject) => {
        const timeout = setTimeout(() => resolve('done'), 200);
        signal.addEventListener('abort', () => {
          clearTimeout(timeout);
          const err = new Error('aborted');
          err.name = 'AbortError';
          reject(err);
        });
      });

      await expect(withRetry(slowOperation)).rejects.toThrow(TimeoutError);

      vi.useFakeTimers(); // Restore fake timers
    });
  });
});
