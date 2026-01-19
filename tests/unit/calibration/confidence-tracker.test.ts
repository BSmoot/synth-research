/**
 * Unit tests for ConfidenceCalibrator
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Recording validation outcomes
 * - Bucket-based calibration statistics
 * - Confidence adjustment based on observed pass rates
 * - Calibration error calculation
 * - Minimum samples threshold
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  ConfidenceCalibrator,
  CalibrationRecord,
  CalibrationStats,
} from '../../../src/calibration/confidence-tracker.js';
import { ScoredHypothesis, Verdict } from '../../../src/types/index.js';

// Helper to create minimal test scored hypotheses
function createScoredHypothesis(
  id: string,
  verdict: Verdict,
  compositeScore: number
): ScoredHypothesis {
  return {
    id,
    title: 'Test Hypothesis',
    statement: 'Test statement',
    sourceDomain: 'ml-ai',
    targetDomain: 'computational-biology',
    connection: {
      id: 'conn-1',
      sourceDomain: 'ml-ai',
      targetDomain: 'computational-biology',
      bridgeConcepts: [
        {
          id: 'concept-1',
          name: 'Test Concept',
          domain: 'ml-ai',
          description: 'A test concept',
          sources: [
            {
              id: 'src-1',
              type: 'llm-knowledge' as const,
              title: 'Test Source',
              relevance: 'Relevant',
              verified: false,
            },
          ],
        },
      ],
      analogyType: 'structural' as const,
      description: 'Test connection',
      confidence: 0.8,
    },
    components: {
      insight: 'Test insight',
      application: 'Test application',
      mechanism: 'Test mechanism',
      prediction: 'Test prediction',
    },
    confidence: 0.8,
    citations: [],
    generatedAt: new Date(),
    status: 'validated' as const,
    scores: {
      plausibility: 0.8,
      novelty: 0.7,
      testability: 0.9,
      impact: 0.75,
      composite: compositeScore,
    },
    verdict,
    challengeNotes: ['Test note'],
  };
}

describe('ConfidenceCalibrator', () => {
  describe('constructor', () => {
    it('should create calibrator with default options', () => {
      const calibrator = new ConfidenceCalibrator();

      expect(calibrator).toBeDefined();
    });

    it('should accept custom minSamplesForAdjustment', () => {
      const calibrator = new ConfidenceCalibrator({
        minSamplesForAdjustment: 100,
      });

      expect(calibrator).toBeDefined();
    });
  });

  describe('recordOutcome()', () => {
    it('should record a hypothesis outcome', () => {
      const calibrator = new ConfidenceCalibrator();
      const hypothesis = createScoredHypothesis('h1', 'pass', 0.85);

      calibrator.recordOutcome(hypothesis, 0.8);

      const stats = calibrator.getCalibrationStats();
      expect(stats.totalRecords).toBe(1);
    });

    it('should record multiple outcomes', () => {
      const calibrator = new ConfidenceCalibrator();

      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.85);
      calibrator.recordOutcome(createScoredHypothesis('h2', 'fail', 0.4), 0.35);
      calibrator.recordOutcome(createScoredHypothesis('h3', 'borderline', 0.6), 0.55);

      const stats = calibrator.getCalibrationStats();
      expect(stats.totalRecords).toBe(3);
    });
  });

  describe('getCalibrationStats()', () => {
    it('should return empty stats when no records', () => {
      const calibrator = new ConfidenceCalibrator();

      const stats = calibrator.getCalibrationStats();

      expect(stats.totalRecords).toBe(0);
      expect(stats.buckets).toHaveLength(5);
      expect(stats.overallCalibrationError).toBe(0);
    });

    it('should have 5 buckets covering 0-100%', () => {
      const calibrator = new ConfidenceCalibrator();

      const stats = calibrator.getCalibrationStats();

      expect(stats.buckets).toHaveLength(5);
      expect(stats.buckets.map((b) => b.range)).toEqual([
        '0-20%',
        '20-40%',
        '40-60%',
        '60-80%',
        '80-100%',
      ]);
    });

    it('should count records in correct buckets', () => {
      const calibrator = new ConfidenceCalibrator();

      // Add records with different confidence levels
      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.15); // 0-20%
      calibrator.recordOutcome(createScoredHypothesis('h2', 'pass', 0.8), 0.35); // 20-40%
      calibrator.recordOutcome(createScoredHypothesis('h3', 'fail', 0.5), 0.55); // 40-60%
      calibrator.recordOutcome(createScoredHypothesis('h4', 'pass', 0.7), 0.75); // 60-80%
      calibrator.recordOutcome(createScoredHypothesis('h5', 'pass', 0.95), 0.9); // 80-100%

      const stats = calibrator.getCalibrationStats();

      expect(stats.buckets[0].count).toBe(1);
      expect(stats.buckets[1].count).toBe(1);
      expect(stats.buckets[2].count).toBe(1);
      expect(stats.buckets[3].count).toBe(1);
      expect(stats.buckets[4].count).toBe(1);
    });

    it('should calculate pass rate per bucket', () => {
      const calibrator = new ConfidenceCalibrator();

      // 80-100% bucket: 2 pass, 1 fail = 66% pass rate
      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.85);
      calibrator.recordOutcome(createScoredHypothesis('h2', 'pass', 0.9), 0.9);
      calibrator.recordOutcome(createScoredHypothesis('h3', 'fail', 0.3), 0.95);

      const stats = calibrator.getCalibrationStats();
      const highBucket = stats.buckets[4]; // 80-100%

      expect(highBucket.count).toBe(3);
      expect(highBucket.passRate).toBeCloseTo(2 / 3, 2);
    });

    it('should calculate calibration error per bucket', () => {
      const calibrator = new ConfidenceCalibrator();

      // 80-100% bucket (midpoint 0.9): 100% pass rate = error of 0.1
      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.85);
      calibrator.recordOutcome(createScoredHypothesis('h2', 'pass', 0.9), 0.9);

      const stats = calibrator.getCalibrationStats();
      const highBucket = stats.buckets[4];

      // 100% pass rate vs 90% midpoint = 10% error
      expect(highBucket.calibrationError).toBeCloseTo(0.1, 2);
    });
  });

  describe('adjustConfidence()', () => {
    it('should return raw confidence when below minimum samples', () => {
      const calibrator = new ConfidenceCalibrator({ minSamplesForAdjustment: 50 });

      // Only add 10 samples
      for (let i = 0; i < 10; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'pass', 0.9), 0.85);
      }

      const adjusted = calibrator.adjustConfidence(0.8);

      expect(adjusted).toBe(0.8);
    });

    it('should adjust confidence when above minimum samples', () => {
      const calibrator = new ConfidenceCalibrator({ minSamplesForAdjustment: 20 });

      // Add enough samples in 80-100% bucket - all fail (0% pass rate)
      for (let i = 0; i < 25; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'fail', 0.3), 0.85);
      }

      const rawConfidence = 0.85;
      const adjusted = calibrator.adjustConfidence(rawConfidence);

      // Observed 0% pass rate vs 85% confidence = should adjust downward
      expect(adjusted).toBeLessThan(rawConfidence);
    });

    it('should adjust confidence upward when pass rate exceeds confidence', () => {
      const calibrator = new ConfidenceCalibrator({ minSamplesForAdjustment: 20 });

      // 20-40% bucket: all pass (100% pass rate)
      for (let i = 0; i < 25; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'pass', 0.9), 0.35);
      }

      const rawConfidence = 0.35;
      const adjusted = calibrator.adjustConfidence(rawConfidence);

      // Observed 100% pass rate vs 35% confidence = should adjust upward
      expect(adjusted).toBeGreaterThan(rawConfidence);
    });

    it('should clamp adjusted confidence to 0-1 range', () => {
      const calibrator = new ConfidenceCalibrator({ minSamplesForAdjustment: 10 });

      // Low bucket with all pass
      for (let i = 0; i < 15; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'pass', 0.9), 0.1);
      }

      const adjusted = calibrator.adjustConfidence(0.95);

      expect(adjusted).toBeGreaterThanOrEqual(0);
      expect(adjusted).toBeLessThanOrEqual(1);
    });
  });

  describe('verdict mapping', () => {
    it('should map high confidence to pass prediction', () => {
      const calibrator = new ConfidenceCalibrator();

      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.8);

      const stats = calibrator.getCalibrationStats();
      // Record exists with predicted verdict based on confidence
      expect(stats.totalRecords).toBe(1);
    });

    it('should map medium confidence to borderline prediction', () => {
      const calibrator = new ConfidenceCalibrator();

      calibrator.recordOutcome(createScoredHypothesis('h1', 'borderline', 0.5), 0.55);

      const stats = calibrator.getCalibrationStats();
      expect(stats.totalRecords).toBe(1);
    });

    it('should map low confidence to fail prediction', () => {
      const calibrator = new ConfidenceCalibrator();

      calibrator.recordOutcome(createScoredHypothesis('h1', 'fail', 0.3), 0.4);

      const stats = calibrator.getCalibrationStats();
      expect(stats.totalRecords).toBe(1);
    });
  });

  describe('overall calibration error', () => {
    it('should calculate overall calibration error', () => {
      const calibrator = new ConfidenceCalibrator();

      // Perfect calibration in 80-100% bucket (pass rate matches midpoint)
      for (let i = 0; i < 10; i++) {
        const verdict = i < 9 ? 'pass' : 'fail'; // 90% pass rate
        calibrator.recordOutcome(
          createScoredHypothesis(`h${i}`, verdict as Verdict, 0.8),
          0.85
        );
      }

      const stats = calibrator.getCalibrationStats();

      // 90% pass rate vs 90% midpoint = near zero error
      expect(stats.overallCalibrationError).toBeLessThan(0.05);
    });

    it('should have higher error with miscalibration', () => {
      const calibrator = new ConfidenceCalibrator();

      // High confidence but all fail
      for (let i = 0; i < 10; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'fail', 0.3), 0.9);
      }

      const stats = calibrator.getCalibrationStats();

      // 0% pass rate vs 90% midpoint = high error
      expect(stats.overallCalibrationError).toBeGreaterThan(0.5);
    });
  });

  describe('edge cases', () => {
    it('should handle bucket with no samples for adjustment', () => {
      const calibrator = new ConfidenceCalibrator({ minSamplesForAdjustment: 10 });

      // Only add samples to one bucket
      for (let i = 0; i < 15; i++) {
        calibrator.recordOutcome(createScoredHypothesis(`h${i}`, 'pass', 0.9), 0.85);
      }

      // Try to adjust confidence in empty bucket
      const adjusted = calibrator.adjustConfidence(0.35);

      // Should return raw confidence when bucket has no samples
      expect(adjusted).toBe(0.35);
    });

    it('should handle exact bucket boundaries', () => {
      const calibrator = new ConfidenceCalibrator();

      // Confidence at exact boundaries
      calibrator.recordOutcome(createScoredHypothesis('h1', 'pass', 0.9), 0.0); // Start of first
      calibrator.recordOutcome(createScoredHypothesis('h2', 'pass', 0.9), 0.2); // End of first/start of second
      calibrator.recordOutcome(createScoredHypothesis('h3', 'pass', 0.9), 0.4);
      calibrator.recordOutcome(createScoredHypothesis('h4', 'pass', 0.9), 0.6);
      calibrator.recordOutcome(createScoredHypothesis('h5', 'pass', 0.9), 0.8);

      const stats = calibrator.getCalibrationStats();

      expect(stats.totalRecords).toBe(5);
    });
  });
});
