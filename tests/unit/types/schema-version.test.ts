/**
 * Unit tests for Schema Versioning module
 * TDD Phase: RED - Tests written before implementation
 *
 * Module location: src/types/schema-version.ts
 * Specification: ADR-008 Platform Enhancement Suite, Phase 1.2
 */

import { describe, it, expect } from 'vitest';
import {
  SCHEMA_VERSION,
  SchemaVersionSchema,
  isCompatibleSchema,
} from '../../../src/types/schema-version.js';

describe('Schema Versioning', () => {
  describe('SCHEMA_VERSION constant', () => {
    it('should be exported and accessible', () => {
      expect(SCHEMA_VERSION).toBeDefined();
      expect(typeof SCHEMA_VERSION).toBe('string');
    });

    it('should match valid semver format X.Y.Z', () => {
      const semverPattern = /^\d+\.\d+\.\d+$/;
      expect(semverPattern.test(SCHEMA_VERSION)).toBe(true);
    });

    it('should equal "1.3.0" as specified in ADR-010', () => {
      expect(SCHEMA_VERSION).toBe('1.3.0');
    });
  });

  describe('SchemaVersionSchema Zod validation', () => {
    it('should be exported and be a Zod schema', () => {
      expect(SchemaVersionSchema).toBeDefined();
      expect(SchemaVersionSchema.parse).toBeDefined();
      expect(typeof SchemaVersionSchema.parse).toBe('function');
    });

    it('should validate object with schemaVersion and createdAt', () => {
      const validInput = {
        schemaVersion: '1.1.0',
        createdAt: '2026-01-17T10:00:00.000Z',
      };

      const result = SchemaVersionSchema.parse(validInput);

      expect(result.schemaVersion).toBe('1.1.0');
      expect(result.createdAt).toBe('2026-01-17T10:00:00.000Z');
    });

    it('should reject invalid schemaVersion format', () => {
      const invalidFormats = [
        { schemaVersion: 'v1.1.0', createdAt: '2026-01-17T10:00:00.000Z' },
        { schemaVersion: '1.1', createdAt: '2026-01-17T10:00:00.000Z' },
        { schemaVersion: '1', createdAt: '2026-01-17T10:00:00.000Z' },
        { schemaVersion: '1.1.0-beta', createdAt: '2026-01-17T10:00:00.000Z' },
        { schemaVersion: 'invalid', createdAt: '2026-01-17T10:00:00.000Z' },
      ];

      invalidFormats.forEach((input) => {
        expect(() => SchemaVersionSchema.parse(input)).toThrow();
      });
    });

    it('should reject missing or invalid createdAt', () => {
      const invalidInputs = [
        { schemaVersion: '1.1.0' },
        { schemaVersion: '1.1.0', createdAt: 'not-a-date' },
        { schemaVersion: '1.1.0', createdAt: '2026-01-17' },
        { schemaVersion: '1.1.0', createdAt: 1705484400000 },
      ];

      invalidInputs.forEach((input) => {
        expect(() => SchemaVersionSchema.parse(input)).toThrow();
      });
    });
  });

  describe('isCompatibleSchema() function', () => {
    it('should be exported as a function', () => {
      expect(isCompatibleSchema).toBeDefined();
      expect(typeof isCompatibleSchema).toBe('function');
    });

    it('should return true for same major version with different minor (1.0.0 vs 1.1.0)', () => {
      const result = isCompatibleSchema('1.0.0');
      expect(result).toBe(true);
    });

    it('should return true for exact same version (1.1.0 vs 1.1.0)', () => {
      const result = isCompatibleSchema('1.1.0');
      expect(result).toBe(true);
    });

    it('should return false for different major version (2.0.0 vs 1.1.0)', () => {
      const result = isCompatibleSchema('2.0.0');
      expect(result).toBe(false);
    });

    it('should return false when current is 1.x.x but checked version is 0.x.x', () => {
      const result = isCompatibleSchema('0.9.5');
      expect(result).toBe(false);
    });

    it('should handle version strings with higher minor and patch numbers', () => {
      const testCases = [
        { version: '1.2.0', expected: true },
        { version: '1.1.1', expected: true },
        { version: '1.99.99', expected: true },
        { version: '0.1.0', expected: false },
        { version: '2.0.0', expected: false },
      ];

      testCases.forEach(({ version, expected }) => {
        const result = isCompatibleSchema(version);
        expect(result).toBe(expected);
      });
    });
  });
});
