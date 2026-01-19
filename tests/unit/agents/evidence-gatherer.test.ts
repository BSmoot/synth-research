/**
 * Unit tests for EvidenceGathererAgent
 * TDD Phase: RED - Tests written before implementation
 *
 * Tests verify:
 * - Agent extends BaseAgent
 * - Evidence schema validation
 * - Citation handling
 * - Evidence strength classification
 * - Summary calculation
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import {
  EvidenceGathererAgent,
  EvidenceRequest,
  EvidenceResult,
  Evidence,
  EvidencedHypothesis,
} from '../../../src/agents/evidence-gatherer.js';
import { ScoredHypothesis } from '../../../src/types/index.js';

// Helper to create minimal test scored hypotheses
function createScoredHypothesis(id: string, statement: string): ScoredHypothesis {
  return {
    id,
    title: 'Test Hypothesis',
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
    citations: [
      {
        id: 'cit-1',
        type: 'llm-knowledge' as const,
        title: 'Existing Citation',
        relevance: 'Related work',
        verified: false,
      },
    ],
    generatedAt: new Date(),
    status: 'validated' as const,
    scores: {
      plausibility: 0.8,
      novelty: 0.7,
      testability: 0.9,
      impact: 0.75,
      composite: 0.8,
    },
    verdict: 'pass' as const,
    challengeNotes: ['Test note'],
  };
}

describe('EvidenceGathererAgent', () => {
  let mockClient: { messages: { create: ReturnType<typeof vi.fn> } };

  beforeEach(() => {
    mockClient = {
      messages: {
        create: vi.fn().mockResolvedValue({
          content: [
            {
              type: 'text',
              text: JSON.stringify({
                verifiedCitations: [
                  {
                    id: 'new-cit-1',
                    type: 'paper',
                    title: 'New Supporting Paper',
                    authors: ['Author A', 'Author B'],
                    year: 2024,
                    venue: 'Nature',
                    doi: '10.1234/test',
                    relevance: 'Directly supports hypothesis',
                    verified: true,
                  },
                ],
                newCitations: [],
                evidenceStrength: 'moderate',
                verificationSummary: 'Found one verified paper supporting the hypothesis.',
              }),
            },
          ],
          usage: { input_tokens: 100, output_tokens: 200 },
        }),
      },
    };
  });

  describe('constructor', () => {
    it('should create agent with Anthropic client', () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      expect(agent).toBeDefined();
    });

    it('should accept custom config options', () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic,
        { name: 'custom-evidence-agent' }
      );

      expect(agent).toBeDefined();
    });
  });

  describe('execute()', () => {
    it('should process single hypothesis', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test hypothesis statement')],
      };

      const result = await agent.execute(request);

      expect(result.evidencedHypotheses).toHaveLength(1);
      expect(result.evidencedHypotheses[0].evidence).toBeDefined();
    });

    it('should process multiple hypotheses', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [
          createScoredHypothesis('h1', 'First hypothesis'),
          createScoredHypothesis('h2', 'Second hypothesis'),
        ],
      };

      const result = await agent.execute(request);

      expect(result.evidencedHypotheses).toHaveLength(2);
      expect(mockClient.messages.create).toHaveBeenCalledTimes(2);
    });

    it('should accept optional citationsPerHypothesis', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test hypothesis')],
        citationsPerHypothesis: 5,
      };

      await agent.execute(request);

      expect(mockClient.messages.create).toHaveBeenCalledWith(
        expect.objectContaining({
          messages: expect.arrayContaining([
            expect.objectContaining({
              content: expect.stringContaining('5'),
            }),
          ]),
        }),
        undefined
      );
    });

    it('should accept optional AbortSignal', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const controller = new AbortController();
      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test hypothesis')],
      };

      const result = await agent.execute(request, controller.signal);

      expect(result.evidencedHypotheses).toHaveLength(1);
    });
  });

  describe('EvidenceResult structure', () => {
    it('should include evidencedHypotheses array', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);

      expect(result).toHaveProperty('evidencedHypotheses');
      expect(Array.isArray(result.evidencedHypotheses)).toBe(true);
    });

    it('should include summary with counts', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);

      expect(result).toHaveProperty('summary');
      expect(result.summary).toHaveProperty('totalHypotheses');
      expect(result.summary).toHaveProperty('strong');
      expect(result.summary).toHaveProperty('moderate');
      expect(result.summary).toHaveProperty('weak');
      expect(result.summary).toHaveProperty('none');
    });
  });

  describe('Evidence structure', () => {
    it('should include verifiedCitations array', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);
      const evidence = result.evidencedHypotheses[0].evidence;

      expect(evidence).toHaveProperty('verifiedCitations');
      expect(Array.isArray(evidence.verifiedCitations)).toBe(true);
    });

    it('should include evidenceStrength', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);
      const evidence = result.evidencedHypotheses[0].evidence;

      expect(evidence.evidenceStrength).toMatch(/strong|moderate|weak|none/);
    });

    it('should include verificationSummary', async () => {
      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);
      const evidence = result.evidencedHypotheses[0].evidence;

      expect(typeof evidence.verificationSummary).toBe('string');
    });
  });

  describe('evidence strength calculation', () => {
    it('should categorize strong evidence correctly', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verifiedCitations: [
                { id: 'c1', type: 'paper', title: 'P1', relevance: 'R', verified: true },
                { id: 'c2', type: 'paper', title: 'P2', relevance: 'R', verified: true },
                { id: 'c3', type: 'paper', title: 'P3', relevance: 'R', verified: true },
              ],
              newCitations: [],
              evidenceStrength: 'strong',
              verificationSummary: 'Strong evidence',
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);

      expect(result.summary.strong).toBe(1);
      expect(result.summary.moderate).toBe(0);
    });

    it('should calculate summary counts correctly', async () => {
      // First call returns moderate
      mockClient.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verifiedCitations: [],
              newCitations: [],
              evidenceStrength: 'moderate',
              verificationSummary: 'Moderate',
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      // Second call returns weak
      mockClient.messages.create.mockResolvedValueOnce({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verifiedCitations: [],
              newCitations: [],
              evidenceStrength: 'weak',
              verificationSummary: 'Weak',
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [
          createScoredHypothesis('h1', 'First'),
          createScoredHypothesis('h2', 'Second'),
        ],
      };

      const result = await agent.execute(request);

      expect(result.summary.totalHypotheses).toBe(2);
      expect(result.summary.moderate).toBe(1);
      expect(result.summary.weak).toBe(1);
    });
  });

  describe('citation defaults', () => {
    it('should default all new citations to verified: false', async () => {
      mockClient.messages.create.mockResolvedValue({
        content: [
          {
            type: 'text',
            text: JSON.stringify({
              verifiedCitations: [],
              newCitations: [
                { id: 'new1', type: 'paper', title: 'New Paper', relevance: 'R' },
              ],
              evidenceStrength: 'weak',
              verificationSummary: 'New citation found',
            }),
          },
        ],
        usage: { input_tokens: 100, output_tokens: 200 },
      });

      const agent = new EvidenceGathererAgent(
        mockClient as unknown as Anthropic
      );

      const request: EvidenceRequest = {
        hypotheses: [createScoredHypothesis('h1', 'Test')],
      };

      const result = await agent.execute(request);
      const newCitations = result.evidencedHypotheses[0].evidence.newCitations;

      for (const citation of newCitations) {
        expect(citation.verified).toBe(false);
      }
    });
  });
});
