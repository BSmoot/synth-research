/**
 * Unit tests for SynthesisOrchestrator configuration
 * Specifically testing enableEvidenceGatherer config option
 */

import { describe, it, expect } from 'vitest';
import { SynthesisOrchestrator } from '../../src/orchestrator/synthesis-orchestrator.js';

describe('SynthesisOrchestrator Config - enableEvidenceGatherer', () => {
  describe('default configuration behavior', () => {
    it('should default enableEvidenceGatherer to false when no config provided', () => {
      const orchestrator = new SynthesisOrchestrator();

      const config = orchestrator.getConfig();

      expect(config.enableEvidenceGatherer).toBe(false);
    });

    it('should default enableEvidenceGatherer to false when empty config object provided', () => {
      const orchestrator = new SynthesisOrchestrator({});

      const config = orchestrator.getConfig();

      expect(config.enableEvidenceGatherer).toBe(false);
    });
  });

  describe('explicit configuration', () => {
    it('should respect enableEvidenceGatherer: false when explicitly set', () => {
      const orchestrator = new SynthesisOrchestrator({
        enableEvidenceGatherer: false,
      });

      const config = orchestrator.getConfig();

      expect(config.enableEvidenceGatherer).toBe(false);
    });

    it('should respect enableEvidenceGatherer: true when explicitly set', () => {
      const orchestrator = new SynthesisOrchestrator({
        enableEvidenceGatherer: true,
      });

      const config = orchestrator.getConfig();

      expect(config.enableEvidenceGatherer).toBe(true);
    });
  });

  describe('config object spreading', () => {
    it('should preserve enableEvidenceGatherer when merged with other config options', () => {
      const orchestrator = new SynthesisOrchestrator({
        apiKey: 'test-key',
        maxRetries: 3,
        timeoutMs: 5000,
        enableEvidenceGatherer: true,
        traceEnabled: false,
      });

      const config = orchestrator.getConfig();

      expect(config.enableEvidenceGatherer).toBe(true);
      expect(config.apiKey).toBe('test-key');
      expect(config.maxRetries).toBe(3);
      expect(config.timeoutMs).toBe(5000);
      expect(config.traceEnabled).toBe(false);
    });
  });
});
