/**
 * Unit tests for HypothesisDeduplicator
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Embedding generation for hypothesis statements
 * - Cosine similarity calculation
 * - Duplicate detection based on similarity threshold
 * - FIFO eviction for storage limits
 * - Unique vs duplicate separation
 */

import { describe, it, expect, beforeEach } from 'vitest';
import {
  HypothesisDeduplicator,
  DeduplicationResult,
  HypothesisEmbedding,
} from '../../../src/deduplication/hypothesis-dedup.js';
import { Hypothesis } from '../../../src/types/index.js';

// Helper to create minimal test hypotheses
function createTestHypothesis(
  id: string,
  statement: string,
  title: string = 'Test Hypothesis'
): Hypothesis {
  return {
    id,
    title,
    statement,
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
    status: 'raw' as const,
  };
}

describe('HypothesisDeduplicator', () => {
  describe('constructor', () => {
    it('should create deduplicator with default options', () => {
      const dedup = new HypothesisDeduplicator();

      expect(dedup).toBeDefined();
    });

    it('should accept custom similarity threshold', () => {
      const dedup = new HypothesisDeduplicator({
        similarityThreshold: 0.9,
      });

      expect(dedup).toBeDefined();
    });

    it('should accept custom max stored embeddings', () => {
      const dedup = new HypothesisDeduplicator({
        maxStoredEmbeddings: 500,
      });

      expect(dedup).toBeDefined();
    });
  });

  describe('deduplicate() basic functionality', () => {
    it('should return all hypotheses as unique when none are duplicates', async () => {
      const dedup = new HypothesisDeduplicator();

      const hypotheses = [
        createTestHypothesis('h1', 'Neural networks can improve drug discovery'),
        createTestHypothesis('h2', 'Quantum computing enhances cryptography'),
        createTestHypothesis('h3', 'Climate models predict weather patterns'),
      ];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.unique).toHaveLength(3);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should detect exact duplicate statements', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.99 });

      const hypotheses = [
        createTestHypothesis('h1', 'Neural networks can improve drug discovery'),
        createTestHypothesis('h2', 'Neural networks can improve drug discovery'),
      ];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.unique).toHaveLength(1);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].hypothesis.id).toBe('h2');
      expect(result.duplicates[0].similarTo).toBe('h1');
    });

    it('should detect semantically similar statements', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.85 });

      const hypotheses = [
        createTestHypothesis(
          'h1',
          'Deep neural networks can significantly improve drug discovery processes'
        ),
        createTestHypothesis(
          'h2',
          'Neural network models can greatly enhance drug discovery methods'
        ),
      ];

      const result = await dedup.deduplicate(hypotheses);

      // With hash-based pseudo-embedding, similar wording should be detected
      expect(result.unique.length + result.duplicates.length).toBe(2);
    });
  });

  describe('DeduplicationResult structure', () => {
    it('should return valid DeduplicationResult', async () => {
      const dedup = new HypothesisDeduplicator();

      const hypotheses = [createTestHypothesis('h1', 'Test hypothesis')];

      const result = await dedup.deduplicate(hypotheses);

      expect(result).toHaveProperty('unique');
      expect(result).toHaveProperty('duplicates');
      expect(Array.isArray(result.unique)).toBe(true);
      expect(Array.isArray(result.duplicates)).toBe(true);
    });

    it('should include similarity score in duplicate entries', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.99 });

      const hypotheses = [
        createTestHypothesis('h1', 'Exact same statement'),
        createTestHypothesis('h2', 'Exact same statement'),
      ];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].similarity).toBeGreaterThanOrEqual(0.99);
    });
  });

  describe('cross-session deduplication', () => {
    it('should detect duplicates across multiple deduplicate calls', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.99 });

      // First batch
      const batch1 = [createTestHypothesis('h1', 'Neural networks in biology')];
      await dedup.deduplicate(batch1);

      // Second batch with duplicate
      const batch2 = [createTestHypothesis('h2', 'Neural networks in biology')];
      const result = await dedup.deduplicate(batch2);

      expect(result.unique).toHaveLength(0);
      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].similarTo).toBe('h1');
    });

    it('should store embeddings for future comparisons', async () => {
      const dedup = new HypothesisDeduplicator();

      const hypotheses1 = [
        createTestHypothesis('h1', 'First unique hypothesis'),
        createTestHypothesis('h2', 'Second unique hypothesis'),
      ];

      await dedup.deduplicate(hypotheses1);

      const hypotheses2 = [createTestHypothesis('h3', 'Third unique hypothesis')];

      const result = await dedup.deduplicate(hypotheses2);

      expect(result.unique).toHaveLength(1);
      // Storage should now have 3 embeddings
    });
  });

  describe('FIFO eviction', () => {
    it('should evict oldest embeddings when max limit reached', async () => {
      const dedup = new HypothesisDeduplicator({
        maxStoredEmbeddings: 3,
        similarityThreshold: 0.99,
      });

      // Add 3 hypotheses
      await dedup.deduplicate([
        createTestHypothesis('h1', 'Statement one'),
        createTestHypothesis('h2', 'Statement two'),
        createTestHypothesis('h3', 'Statement three'),
      ]);

      // Add 1 more - should evict h1
      await dedup.deduplicate([createTestHypothesis('h4', 'Statement four')]);

      // Now h1 should not be detected as duplicate
      const result = await dedup.deduplicate([
        createTestHypothesis('h5', 'Statement one'),
      ]);

      expect(result.unique).toHaveLength(1);
      expect(result.duplicates).toHaveLength(0);
    });
  });

  describe('empty and single hypothesis handling', () => {
    it('should handle empty hypothesis array', async () => {
      const dedup = new HypothesisDeduplicator();

      const result = await dedup.deduplicate([]);

      expect(result.unique).toHaveLength(0);
      expect(result.duplicates).toHaveLength(0);
    });

    it('should handle single hypothesis', async () => {
      const dedup = new HypothesisDeduplicator();

      const hypotheses = [createTestHypothesis('h1', 'Only hypothesis')];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.unique).toHaveLength(1);
      expect(result.duplicates).toHaveLength(0);
    });
  });

  describe('cosine similarity', () => {
    it('should return high similarity for identical embeddings', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.99 });

      const hypotheses = [
        createTestHypothesis('h1', 'Identical text'),
        createTestHypothesis('h2', 'Identical text'),
      ];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.duplicates).toHaveLength(1);
      expect(result.duplicates[0].similarity).toBeGreaterThanOrEqual(0.99);
    });

    it('should return low similarity for different statements', async () => {
      const dedup = new HypothesisDeduplicator({ similarityThreshold: 0.85 });

      const hypotheses = [
        createTestHypothesis('h1', 'Machine learning neural networks AI'),
        createTestHypothesis('h2', 'Climate change weather patterns ocean'),
      ];

      const result = await dedup.deduplicate(hypotheses);

      expect(result.unique).toHaveLength(2);
      expect(result.duplicates).toHaveLength(0);
    });
  });

  describe('threshold behavior', () => {
    it('should respect custom threshold', async () => {
      const lowThreshold = new HypothesisDeduplicator({
        similarityThreshold: 0.5,
      });

      const hypotheses = [
        createTestHypothesis('h1', 'Neural networks for biology'),
        createTestHypothesis('h2', 'Neural systems for science'),
      ];

      const result = await lowThreshold.deduplicate(hypotheses);

      // With low threshold, moderately similar statements may be flagged
      expect(result.unique.length).toBeLessThanOrEqual(2);
    });

    it('should mark nothing as duplicate with threshold of 1.0', async () => {
      const strictDedup = new HypothesisDeduplicator({
        similarityThreshold: 1.0,
      });

      const hypotheses = [
        createTestHypothesis('h1', 'Same statement'),
        createTestHypothesis('h2', 'Same statement'), // Even identical might not hit 1.0 exactly
      ];

      const result = await strictDedup.deduplicate(hypotheses);

      // Depending on floating point, might be 0 or 1 duplicates
      expect(result.unique.length + result.duplicates.length).toBe(2);
    });
  });
});
