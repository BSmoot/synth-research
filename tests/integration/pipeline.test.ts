/**
 * Integration tests for Synthesis Labs pipeline
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import { PipelineContext } from '../../src/context/pipeline-context.js';
import {
  DomainTag,
  SUPPORTED_DOMAINS,
  DOMAIN_METADATA,
  ConceptSchema,
  CitationSchema,
} from '../../src/types/index.js';

// ============================================================================
// Pipeline Context Tests
// ============================================================================

describe('PipelineContext', () => {
  let context: PipelineContext;

  beforeEach(() => {
    context = new PipelineContext(
      { text: 'Test query about CRISPR' },
      'computational-biology'
    );
  });

  it('should initialize with correct properties', () => {
    expect(context.traceId).toBeDefined();
    expect(context.traceId.length).toBe(36); // UUID length
    expect(context.query.text).toBe('Test query about CRISPR');
    expect(context.domain).toBe('computational-biology');
    expect(context.startTime).toBeInstanceOf(Date);
  });

  it('should track elapsed time', async () => {
    await new Promise((resolve) => setTimeout(resolve, 10));
    expect(context.elapsedMs).toBeGreaterThan(0);
  });

  it('should manage stages', () => {
    context.addStage({
      stage: 'domain-analysis',
      status: 'success',
      durationMs: 1000,
    });

    expect(context.stages).toHaveLength(1);
    expect(context.stages[0].stage).toBe('domain-analysis');
  });

  it('should manage warnings', () => {
    context.addWarning('Test warning');
    expect(context.warnings).toContain('Test warning');
  });

  it('should provide summary', () => {
    const summary = context.getSummary();

    expect(summary.query).toBe('Test query about CRISPR');
    expect(summary.domain).toBe('computational-biology');
    expect(summary.keyConceptsCount).toBe(0);
    expect(summary.connectionsCount).toBe(0);
  });
});

// ============================================================================
// Type Schema Tests
// ============================================================================

describe('Type Schemas', () => {
  describe('ConceptSchema', () => {
    it('should validate valid concept', () => {
      const concept = {
        id: 'c1',
        name: 'Test Concept',
        domain: 'computational-biology',
        description: 'A test concept',
        type: 'method',
        relatedConcepts: ['other'],
        sources: [
          {
            id: 'src1',
            type: 'llm-knowledge',
            title: 'LLM Knowledge',
            relevance: 'General knowledge',
            verified: false,
          },
        ],
      };

      const result = ConceptSchema.parse(concept);
      expect(result.name).toBe('Test Concept');
    });

    it('should reject invalid domain', () => {
      const concept = {
        id: 'c1',
        name: 'Test',
        domain: 'invalid-domain',
        description: 'Test',
        type: 'method',
        relatedConcepts: [],
        sources: [],
      };

      expect(() => ConceptSchema.parse(concept)).toThrow();
    });
  });

  describe('CitationSchema', () => {
    it('should validate paper citation', () => {
      const citation = {
        id: 'cite1',
        type: 'paper',
        title: 'A Research Paper',
        authors: ['Author One', 'Author Two'],
        year: 2024,
        venue: 'Nature',
        relevance: 'Foundational work',
        verified: true,
      };

      const result = CitationSchema.parse(citation);
      expect(result.type).toBe('paper');
      expect(result.verified).toBe(true);
    });

    it('should validate llm-knowledge citation', () => {
      const citation = {
        id: 'cite2',
        type: 'llm-knowledge',
        title: 'General knowledge about topic',
        relevance: 'From training data',
        verified: false,
      };

      const result = CitationSchema.parse(citation);
      expect(result.type).toBe('llm-knowledge');
    });
  });
});

// ============================================================================
// Domain Metadata Tests
// ============================================================================

describe('Domain Metadata', () => {
  it('should have all supported domains', () => {
    expect(SUPPORTED_DOMAINS).toContain('computational-biology');
    expect(SUPPORTED_DOMAINS).toContain('materials-science');
    expect(SUPPORTED_DOMAINS).toContain('ml-ai');
    expect(SUPPORTED_DOMAINS).toHaveLength(3);
  });

  it('should have metadata for each domain', () => {
    for (const domain of SUPPORTED_DOMAINS) {
      const meta = DOMAIN_METADATA[domain];
      expect(meta.tag).toBe(domain);
      expect(meta.name).toBeDefined();
      expect(meta.description).toBeDefined();
      expect(meta.subDomains.length).toBeGreaterThan(0);
    }
  });

  it('should have valid sub-domains', () => {
    expect(DOMAIN_METADATA['computational-biology'].subDomains).toContain('crispr');
    expect(DOMAIN_METADATA['ml-ai'].subDomains).toContain('deep-learning');
    expect(DOMAIN_METADATA['materials-science'].subDomains).toContain('nanomaterials');
  });
});
