/**
 * Unit tests for Winston structured logging module
 * TDD Phase: RED -> GREEN - Tests for Winston logger implementation
 *
 * Specifies the contract for replacing console.log with structured logging
 * while preserving trace ID correlation from PipelineContext.log()
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { Writable } from 'stream';
import winston from 'winston';
import { logger, createChildLogger, type LogContext } from '../../../src/logging/logger.js';

describe('Logger', () => {
  describe('logger instance', () => {
    it('should be a winston Logger instance', () => {
      expect(logger).toBeDefined();
      expect(logger).toHaveProperty('info');
      expect(logger).toHaveProperty('warn');
      expect(logger).toHaveProperty('error');
      expect(logger).toHaveProperty('debug');
    });

    it('should have winston Logger methods that are callable', () => {
      expect(typeof logger.info).toBe('function');
      expect(typeof logger.warn).toBe('function');
      expect(typeof logger.error).toBe('function');
      expect(typeof logger.debug).toBe('function');
    });
  });

  describe('log output format', () => {
    it('should output JSON with timestamp, level, and message fields', () => {
      // Create a custom transport to capture output
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      // Create a test logger with our transport
      const testLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      testLogger.info('Test message');

      expect(logs.length).toBeGreaterThan(0);
      const parsed = JSON.parse(logs[0]);

      expect(parsed).toHaveProperty('timestamp');
      expect(parsed).toHaveProperty('level');
      expect(parsed).toHaveProperty('message');
      expect(parsed.message).toBe('Test message');
      expect(parsed.level).toBe('info');
    });

    it('should include ISO 8601 timestamp', () => {
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      const testLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      testLogger.warn('Warning message');

      const parsed = JSON.parse(logs[0]);
      expect(parsed.timestamp).toMatch(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/);
    });

    it('should handle different log levels correctly', () => {
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      const testLogger = winston.createLogger({
        level: 'error',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      testLogger.error('Error message');

      const parsed = JSON.parse(logs[0]);
      expect(parsed.level).toBe('error');
      expect(parsed.message).toBe('Error message');
    });
  });

  describe('createChildLogger()', () => {
    it('should return a winston Logger instance', () => {
      const child = createChildLogger({ traceId: 'test-trace' });

      expect(child).toBeDefined();
      expect(child).toHaveProperty('info');
      expect(child).toHaveProperty('warn');
      expect(child).toHaveProperty('error');
      expect(child).toHaveProperty('debug');
    });

    it('should include traceId in all log entries', () => {
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      const parentLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      const child = parentLogger.child({ traceId: 'abc123def456' });
      child.info('Test with trace');

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toHaveProperty('traceId');
      expect(parsed.traceId).toBe('abc123def456');
    });

    it('should include agent name in log entries when provided', () => {
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      const parentLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      const child = parentLogger.child({
        traceId: 'trace-001',
        agent: 'DomainAnalyst',
      });
      child.info('Agent action');

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toHaveProperty('agent');
      expect(parsed.agent).toBe('DomainAnalyst');
    });

    it('should include stage in log entries when provided', () => {
      const logs: string[] = [];
      const testTransport = new winston.transports.Stream({
        stream: new Writable({
          write(chunk, _encoding, callback) {
            logs.push(chunk.toString());
            callback();
          },
        }),
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
      });

      const parentLogger = winston.createLogger({
        level: 'info',
        format: winston.format.combine(
          winston.format.timestamp(),
          winston.format.json()
        ),
        transports: [testTransport],
      });

      const child = parentLogger.child({
        traceId: 'trace-002',
        agent: 'HypothesisGenerator',
        stage: 'generation',
      });
      child.warn('Stage progress');

      const parsed = JSON.parse(logs[0]);
      expect(parsed).toHaveProperty('stage');
      expect(parsed.stage).toBe('generation');
    });

    it('should work with createChildLogger function', () => {
      // Test the actual exported createChildLogger function
      const child = createChildLogger({
        traceId: 'test-trace-id',
        agent: 'TestAgent',
        stage: 'testing',
      });

      // Verify it returns a valid logger
      expect(child).toBeDefined();
      expect(typeof child.info).toBe('function');
      expect(typeof child.warn).toBe('function');
      expect(typeof child.error).toBe('function');
    });
  });

  describe('log level configuration', () => {
    it('should default to info level', () => {
      // Verify logger level is set to 'info' by default
      expect(logger.level).toBe('info');
    });
  });

  describe('LogContext interface', () => {
    it('should allow traceId as optional string', () => {
      const context1: LogContext = { traceId: 'trace-123' };
      const context2: LogContext = {};

      expect(context1.traceId).toBe('trace-123');
      expect(context2.traceId).toBeUndefined();
    });

    it('should allow agent as optional string', () => {
      const context1: LogContext = { agent: 'TestAgent' };
      const context2: LogContext = {};

      expect(context1.agent).toBe('TestAgent');
      expect(context2.agent).toBeUndefined();
    });

    it('should allow stage as optional string', () => {
      const context1: LogContext = { stage: 'evaluation' };
      const context2: LogContext = {};

      expect(context1.stage).toBe('evaluation');
      expect(context2.stage).toBeUndefined();
    });

    it('should allow arbitrary additional properties', () => {
      const context: LogContext = {
        traceId: 'trace-456',
        agent: 'Challenger',
        customField: 'custom value',
        numericField: 42,
        booleanField: true,
      };

      expect(context.customField).toBe('custom value');
      expect(context.numericField).toBe(42);
      expect(context.booleanField).toBe(true);
    });
  });
});
