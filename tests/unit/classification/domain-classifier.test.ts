/**
 * Unit tests for DomainClassifier
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Keyword-based classification for clear queries
 * - LLM fallback for ambiguous queries
 * - Ambiguity threshold behavior
 * - ClassificationResult structure
 * - Domain normalization integration
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  DomainClassifier,
  ClassificationResult,
} from '../../../src/classification/domain-classifier.js';
import type Anthropic from '@anthropic-ai/sdk';

describe('DomainClassifier', () => {
  let mockClient: { messages: { create: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn(),
      },
    };
    vi.clearAllMocks();
  });

  afterEach(() => {
    vi.resetAllMocks();
  });

  describe('constructor', () => {
    it('should create classifier with Anthropic client', () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      expect(classifier).toBeDefined();
    });

    it('should accept custom ambiguity threshold', () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.8,
      });

      expect(classifier).toBeDefined();
    });
  });

  describe('classify() with clear queries', () => {
    it('should classify machine learning query without LLM', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify(
        'How can neural networks and deep learning improve model training?'
      );

      expect(result.usedLLM).toBe(false);
      expect(result.domain).toBe('ml-ai');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify biology query without LLM', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify(
        'Gene expression patterns in cancer cells using CRISPR techniques'
      );

      expect(result.usedLLM).toBe(false);
      expect(result.domain).toBe('computational-biology');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify materials science query without LLM', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify(
        'Novel alloys for high-temperature superconductor applications'
      );

      expect(result.usedLLM).toBe(false);
      expect(result.domain).toBe('materials-science');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });

    it('should classify economics query without LLM', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify(
        'Market dynamics and portfolio optimization strategies'
      );

      expect(result.usedLLM).toBe(false);
      expect(result.domain).toBe('economics-finance');
      expect(result.confidence).toBeGreaterThanOrEqual(0.7);
    });
  });

  describe('classify() with ambiguous queries', () => {
    it('should use LLM for ambiguous cross-domain query', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      // Mock LLM response
      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'computational-biology',
              confidence: 0.85,
              reasoning: 'Query combines AI with biological systems',
            }),
          },
        ],
      });

      const result = await classifier.classify(
        'Systems thinking for complex adaptive networks'
      );

      expect(result.usedLLM).toBe(true);
      expect(mockClient.messages.create).toHaveBeenCalledOnce();
    });

    it('should use LLM for vague query', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'social-systems',
              confidence: 0.7,
              reasoning: 'Query about general problem solving',
            }),
          },
        ],
      });

      const result = await classifier.classify('How to solve difficult problems?');

      expect(result.usedLLM).toBe(true);
    });

    it('should normalize LLM domain output using normalizeDomain', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      // LLM returns non-canonical domain name
      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'machine-learning',
              confidence: 0.9,
              reasoning: 'Clear ML focus',
            }),
          },
        ],
      });

      const result = await classifier.classify('Something vague about learning');

      // Should be normalized to 'ml-ai'
      expect(result.domain).toBe('ml-ai');
    });
  });

  describe('ClassificationResult structure', () => {
    it('should return complete ClassificationResult', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify('Deep learning for image recognition');

      expect(result).toHaveProperty('domain');
      expect(result).toHaveProperty('confidence');
      expect(result).toHaveProperty('reasoning');
      expect(result).toHaveProperty('alternatives');
      expect(result).toHaveProperty('usedLLM');
    });

    it('should include alternatives in result', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify('Quantum computing for drug discovery');

      expect(Array.isArray(result.alternatives)).toBe(true);
      result.alternatives.forEach((alt) => {
        expect(alt).toHaveProperty('domain');
        expect(alt).toHaveProperty('confidence');
      });
    });

    it('should return confidence as number between 0 and 1', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const result = await classifier.classify('Machine learning models');

      expect(typeof result.confidence).toBe('number');
      expect(result.confidence).toBeGreaterThanOrEqual(0);
      expect(result.confidence).toBeLessThanOrEqual(1);
    });
  });

  describe('ambiguity threshold', () => {
    it('should not use LLM when keyword confidence >= threshold', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.5,
      });

      const result = await classifier.classify('neural networks deep learning');

      expect(result.usedLLM).toBe(false);
      expect(mockClient.messages.create).not.toHaveBeenCalled();
    });

    it('should use LLM when keyword confidence < threshold', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.95, // Very high threshold
      });

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'ml-ai',
              confidence: 0.9,
              reasoning: 'ML query',
            }),
          },
        ],
      });

      const result = await classifier.classify('neural networks deep learning');

      expect(result.usedLLM).toBe(true);
    });
  });

  describe('keyword scoring', () => {
    it('should score higher for multiple keyword matches', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      const singleKeyword = await classifier.classify('machine learning');
      const multipleKeywords = await classifier.classify(
        'machine learning neural networks deep learning AI models'
      );

      expect(multipleKeywords.confidence).toBeGreaterThan(singleKeyword.confidence);
    });

    it('should return other domain for unrecognized queries', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic);

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'other',
              confidence: 0.4,
              reasoning: 'Cannot determine specific domain',
            }),
          },
        ],
      });

      const result = await classifier.classify('xyz abc def');

      // Low confidence should trigger LLM, which may return 'other'
      expect(result.usedLLM).toBe(true);
    });
  });

  describe('LLM response handling', () => {
    it('should handle LLM returning alternative domain format', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.99,
      });

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'bioinformatics',
              confidence: 0.8,
              reasoning: 'Biology and computation',
            }),
          },
        ],
      });

      const result = await classifier.classify('some query');

      // 'bioinformatics' should normalize to 'computational-biology'
      expect(result.domain).toBe('computational-biology');
    });

    it('should fall back to other for invalid LLM domain', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.99,
      });

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'invalid-domain-xyz',
              confidence: 0.8,
              reasoning: 'Some reason',
            }),
          },
        ],
      });

      const result = await classifier.classify('some query');

      expect(result.domain).toBe('other');
    });

    it('should use Sonnet model for classification', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.99,
      });

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              domain: 'ml-ai',
              confidence: 0.8,
              reasoning: 'ML',
            }),
          },
        ],
      });

      await classifier.classify('test');

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          model: 'claude-sonnet-4-20250514',
          temperature: 0,
          max_tokens: 256,
        })
      );
    });
  });

  describe('error handling', () => {
    it('should fall back to keyword result on LLM error', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.1, // Low threshold to force LLM
      });

      mockClient.messages.create.mockRejectedValue(
        new Error('API error')
      );

      // Even with LLM error, should return keyword result
      const result = await classifier.classify('machine learning research');

      expect(result.domain).toBe('ml-ai');
      expect(result.usedLLM).toBe(false);
    });

    it('should handle malformed LLM JSON response', async () => {
      const classifier = new DomainClassifier(mockClient as unknown as Anthropic, {
        ambiguityThreshold: 0.1,
      });

      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: 'not valid json',
          },
        ],
      });

      const result = await classifier.classify('machine learning');

      // Should fall back to keyword result
      expect(result.usedLLM).toBe(false);
    });
  });
});
