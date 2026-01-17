/**
 * Unit tests for custom error types
 * TDD Phase: RED - Tests written before implementation
 */

import { describe, it, expect } from 'vitest';
import { TimeoutError, CircuitOpenError } from '../../src/types/errors.js';

describe('TimeoutError', () => {
  describe('constructor', () => {
    it('should create an instance of Error', () => {
      const error = new TimeoutError('testOperation', 5000);
      expect(error).toBeInstanceOf(Error);
    });

    it('should have name set to TimeoutError', () => {
      const error = new TimeoutError('testOperation', 5000);
      expect(error.name).toBe('TimeoutError');
    });

    it('should include operation name and timeout in message', () => {
      const error = new TimeoutError('fetchData', 10000);
      expect(error.message).toContain('fetchData');
      expect(error.message).toContain('10000');
    });

    it('should expose operationName property', () => {
      const error = new TimeoutError('myOperation', 3000);
      expect(error.operationName).toBe('myOperation');
    });

    it('should expose timeoutMs property', () => {
      const error = new TimeoutError('myOperation', 3000);
      expect(error.timeoutMs).toBe(3000);
    });
  });

  describe('message format', () => {
    it('should format message correctly', () => {
      const error = new TimeoutError('llmCall', 120000);
      expect(error.message).toBe("Operation 'llmCall' timed out after 120000ms");
    });
  });
});

describe('CircuitOpenError', () => {
  describe('constructor', () => {
    it('should create an instance of Error', () => {
      const error = new CircuitOpenError('apiCircuit');
      expect(error).toBeInstanceOf(Error);
    });

    it('should have name set to CircuitOpenError', () => {
      const error = new CircuitOpenError('apiCircuit');
      expect(error.name).toBe('CircuitOpenError');
    });

    it('should include circuit name in message', () => {
      const error = new CircuitOpenError('anthropicApi');
      expect(error.message).toContain('anthropicApi');
    });

    it('should expose circuitName property', () => {
      const error = new CircuitOpenError('testCircuit');
      expect(error.circuitName).toBe('testCircuit');
    });
  });

  describe('message format', () => {
    it('should format message correctly', () => {
      const error = new CircuitOpenError('llmCircuit');
      expect(error.message).toBe("Circuit 'llmCircuit' is open - requests are being rejected");
    });
  });
});
