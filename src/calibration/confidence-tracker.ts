/**
 * Confidence Calibration
 *
 * ADR-008 Phase 2.3: Track validation outcomes to calibrate LLM confidence.
 *
 * Features:
 * - Record hypothesis outcomes with LLM confidence
 * - Bucket-based calibration statistics
 * - Adjust raw confidence towards observed pass rates
 * - Calculate calibration error
 */

import { ScoredHypothesis, Verdict } from '../types/index.js';

export interface CalibrationRecord {
  hypothesisId: string;
  llmConfidence: number;
  predictedVerdict: Verdict;
  actualVerdict: Verdict;
  compositeScore: number;
  recordedAt: string;
}

export interface CalibrationBucket {
  range: string;
  count: number;
  passRate: number;
  calibrationError: number;
}

export interface CalibrationStats {
  totalRecords: number;
  buckets: CalibrationBucket[];
  overallCalibrationError: number;
}

export interface ConfidenceCalibratorOptions {
  minSamplesForAdjustment?: number;
}

export class ConfidenceCalibrator {
  private records: CalibrationRecord[] = [];
  private readonly minSamplesForAdjustment: number;

  constructor(options: ConfidenceCalibratorOptions = {}) {
    this.minSamplesForAdjustment = options.minSamplesForAdjustment ?? 50;
  }

  recordOutcome(hypothesis: ScoredHypothesis, llmConfidence: number): void {
    this.records.push({
      hypothesisId: hypothesis.id,
      llmConfidence,
      predictedVerdict: this.confidenceToVerdict(llmConfidence),
      actualVerdict: hypothesis.verdict,
      compositeScore: hypothesis.scores.composite,
      recordedAt: new Date().toISOString(),
    });
  }

  adjustConfidence(rawConfidence: number): number {
    if (this.records.length < this.minSamplesForAdjustment) {
      return rawConfidence;
    }

    const bucket = this.getBucket(rawConfidence);
    const bucketStats = this.getBucketStats(bucket);

    if (!bucketStats || bucketStats.count < 10) {
      return rawConfidence;
    }

    // Adjust confidence towards observed pass rate
    const adjustment = (bucketStats.passRate - rawConfidence) * 0.5;
    return Math.max(0, Math.min(1, rawConfidence + adjustment));
  }

  getCalibrationStats(): CalibrationStats {
    const bucketDefs = [
      { min: 0.0, max: 0.2, range: '0-20%' },
      { min: 0.2, max: 0.4, range: '20-40%' },
      { min: 0.4, max: 0.6, range: '40-60%' },
      { min: 0.6, max: 0.8, range: '60-80%' },
      { min: 0.8, max: 1.0, range: '80-100%' },
    ];

    const buckets = bucketDefs.map((bucket) => {
      const inBucket = this.records.filter(
        (r) => r.llmConfidence >= bucket.min && r.llmConfidence < bucket.max
      );

      // Handle edge case: 1.0 should be in the last bucket
      if (bucket.max === 1.0) {
        const atBoundary = this.records.filter((r) => r.llmConfidence === 1.0);
        inBucket.push(...atBoundary);
      }

      const passed = inBucket.filter((r) => r.actualVerdict === 'pass').length;
      const passRate = inBucket.length > 0 ? passed / inBucket.length : 0;
      const midpoint = (bucket.min + bucket.max) / 2;

      return {
        range: bucket.range,
        count: inBucket.length,
        passRate,
        calibrationError: inBucket.length > 0 ? Math.abs(passRate - midpoint) : 0,
      };
    });

    const totalWeightedError = buckets.reduce(
      (sum, b) => sum + b.calibrationError * b.count,
      0
    );
    const overallCalibrationError =
      this.records.length > 0 ? totalWeightedError / this.records.length : 0;

    return {
      totalRecords: this.records.length,
      buckets,
      overallCalibrationError,
    };
  }

  private confidenceToVerdict(confidence: number): Verdict {
    if (confidence >= 0.7) return 'pass';
    if (confidence >= 0.5) return 'borderline';
    return 'fail';
  }

  private getBucket(confidence: number): number {
    // Returns bucket index 0-4
    return Math.min(4, Math.floor(confidence * 5));
  }

  private getBucketStats(
    bucket: number
  ): { count: number; passRate: number } | null {
    const min = bucket / 5;
    const max = (bucket + 1) / 5;

    const inBucket = this.records.filter(
      (r) => r.llmConfidence >= min && r.llmConfidence < max
    );

    // Handle edge case for last bucket
    if (max >= 1.0) {
      const atBoundary = this.records.filter((r) => r.llmConfidence === 1.0);
      for (const r of atBoundary) {
        if (!inBucket.includes(r)) inBucket.push(r);
      }
    }

    if (inBucket.length === 0) return null;

    const passed = inBucket.filter((r) => r.actualVerdict === 'pass').length;
    return {
      count: inBucket.length,
      passRate: passed / inBucket.length,
    };
  }
}
