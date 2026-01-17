/**
 * Unit tests for DomainAnalystAgent
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import { DomainAnalystAgent } from '../../src/agents/domain-analyst.js';
import { normalizeDomain } from '../../src/types/index.js';
import type { DomainTag } from '../../src/types/index.js';

// Mock Anthropic client
const createMockClient = () =>
  ({
    messages: {
      create: vi.fn(),
    },
  }) as unknown as Anthropic;

describe('DomainAnalystAgent', () => {
  let agent: DomainAnalystAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = createMockClient();
    agent = new DomainAnalystAgent(mockClient);
  });

  describe('parseResponse normalization', () => {
    it('should normalize domain aliases to canonical tags', () => {
      const mockResponse = JSON.stringify({
        domain: 'machine-learning',
        query: 'test query',
        concepts: [],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.domain).toBe('ml-ai');
    });

    it('should inject missing domain field in concepts', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [
          {
            id: 'c1',
            name: 'Test Concept',
            description: 'A test',
            type: 'theory',
            relatedConcepts: [],
            sources: [],
          },
        ],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.concepts[0].domain).toBe('ml-ai');
    });

    it('should normalize string sources to Citation objects', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [
          {
            id: 'c1',
            name: 'Test Concept',
            domain: 'ml-ai',
            description: 'A test',
            type: 'theory',
            relatedConcepts: [],
            sources: ['Plain string source'],
          },
        ],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      const source = result.concepts[0].sources[0];
      expect(source.type).toBe('llm-knowledge');
      expect(source.title).toBe('Plain string source');
      expect(source.verified).toBe(false);
    });

    it('should flatten keyInsights to plain strings', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [],
        methods: [],
        openProblems: [],
        keyInsights: [
          'Plain string insight',
          { text: 'Object insight' },
          { content: 'Content insight' },
        ],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.keyInsights).toEqual([
        'Plain string insight',
        'Object insight',
        'Content insight',
      ]);
    });

    it('should flatten researchFrontiers to plain strings', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: [
          'Plain string frontier',
          { frontier: 'Object frontier' },
          { description: 'Desc frontier' },
        ],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.researchFrontiers).toEqual([
        'Plain string frontier',
        'Object frontier',
        'Desc frontier',
      ]);
    });

    it('should add analyzedAt if missing', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.analyzedAt).toBeDefined();
      expect(new Date(result.analyzedAt).toString()).not.toBe('Invalid Date');
    });

    it('should use fallback domain if LLM returns invalid domain', () => {
      const mockResponse = JSON.stringify({
        domain: 'invalid-domain',
        query: 'test query',
        concepts: [],
        methods: [],
        openProblems: [],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'computational-biology';
      const result = agent['parseResponse'](mockResponse);
      expect(result.domain).toBe('computational-biology');
    });

    it('should normalize all concept arrays (concepts, methods, openProblems)', () => {
      const mockResponse = JSON.stringify({
        domain: 'ml-ai',
        query: 'test query',
        concepts: [
          {
            id: 'c1',
            name: 'Concept 1',
            description: 'Test',
            type: 'theory',
            relatedConcepts: [],
            sources: [],
          },
        ],
        methods: [
          {
            id: 'm1',
            name: 'Method 1',
            description: 'Test',
            type: 'method',
            relatedConcepts: [],
            sources: [],
          },
        ],
        openProblems: [
          {
            id: 'p1',
            name: 'Problem 1',
            description: 'Test',
            type: 'problem',
            relatedConcepts: [],
            sources: [],
          },
        ],
        keyInsights: ['insight 1'],
        researchFrontiers: ['frontier 1'],
      });

      agent['currentInputDomain'] = 'ml-ai';
      const result = agent['parseResponse'](mockResponse);
      expect(result.concepts[0].domain).toBe('ml-ai');
      expect(result.methods[0].domain).toBe('ml-ai');
      expect(result.openProblems[0].domain).toBe('ml-ai');
    });
  });

  describe('domain alias normalization', () => {
    const testCases: Array<[string, DomainTag]> = [
      ['machine-learning', 'ml-ai'],
      ['machine learning', 'ml-ai'],
      ['ai', 'ml-ai'],
      ['ml', 'ml-ai'],
      ['computational-biology', 'computational-biology'],
      ['computational biology', 'computational-biology'],
      ['comp-bio', 'computational-biology'],
      ['bioinformatics', 'computational-biology'],
      ['materials-science', 'materials-science'],
      ['materials science', 'materials-science'],
      ['material-science', 'materials-science'],
      ['matsci', 'materials-science'],
      ['economics', 'economics-finance'],
      ['finance', 'economics-finance'],
      ['econ', 'economics-finance'],
      ['social', 'social-systems'],
      ['sociology', 'social-systems'],
      ['governance', 'social-systems'],
      ['physics', 'physics-engineering'],
      ['engineering', 'physics-engineering'],
      ['climate', 'climate-environment'],
      ['environment', 'climate-environment'],
      ['sustainability', 'climate-environment'],
      ['healthcare', 'healthcare-medicine'],
      ['medicine', 'healthcare-medicine'],
      ['clinical', 'healthcare-medicine'],
      ['cognitive', 'cognitive-science'],
      ['neuroscience', 'cognitive-science'],
      ['brain', 'cognitive-science'],
      ['information', 'information-systems'],
      ['computing', 'information-systems'],
      ['software', 'information-systems'],
      ['other', 'other'],
      ['general', 'other'],
      ['interdisciplinary', 'other'],
    ];

    // Tests now use the shared normalizeDomain function from types/domains.ts
    testCases.forEach(([input, expected]) => {
      it(`should normalize "${input}" to "${expected}"`, () => {
        const result = normalizeDomain(input, 'ml-ai');
        expect(result).toBe(expected);
      });
    });

    it('should return fallback for unknown domain strings', () => {
      const result = normalizeDomain('unknown-domain', 'computational-biology');
      expect(result).toBe('computational-biology');
    });

    it('should return fallback for non-string values', () => {
      expect(normalizeDomain(null, 'ml-ai')).toBe('ml-ai');
      expect(normalizeDomain(undefined, 'ml-ai')).toBe('ml-ai');
      expect(normalizeDomain(123, 'ml-ai')).toBe('ml-ai');
    });
  });
});
