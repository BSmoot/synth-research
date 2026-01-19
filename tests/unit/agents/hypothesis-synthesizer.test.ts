/**
 * Unit tests for HypothesisSynthesizerAgent
 * TDD Phase: RED - Tests written before normalizer updates
 *
 * Tests verify:
 * - normalizeExperiment returns requirements object (not resourceEstimate)
 * - normalizeResearchSuggestion handles LLM field variations
 * - normalizeResearchSuggestions handles arrays and wrapping
 * - normalizeHypothesis includes suggestedResearch
 * - parseResponse integration with all normalizers
 */

import { describe, it, expect, vi, beforeEach } from 'vitest';
import Anthropic from '@anthropic-ai/sdk';
import {
  HypothesisSynthesizerAgent,
  SynthesisResult,
} from '../../../src/agents/hypothesis-synthesizer.js';

// Test-friendly subclass to expose private normalizers
class TestableHypothesisSynthesizerAgent extends HypothesisSynthesizerAgent {
  public testNormalizeExperiment(exp: unknown): Record<string, unknown> | undefined {
    return (this as any).normalizeExperiment(exp);
  }

  public testNormalizeHypothesis(h: Record<string, unknown>, index: number): Record<string, unknown> {
    return (this as any).normalizeHypothesis(h, index);
  }

  public testNormalizeResearchSuggestion(suggestion: unknown): Record<string, unknown> | undefined {
    return (this as any).normalizeResearchSuggestion(suggestion);
  }

  public testNormalizeResearchSuggestions(suggestions: unknown): Record<string, unknown>[] | undefined {
    return (this as any).normalizeResearchSuggestions(suggestions);
  }

  public testParseResponse(response: string): SynthesisResult {
    return (this as any).parseResponse(response);
  }
}

describe('HypothesisSynthesizerAgent - Normalizers', () => {
  let agent: TestableHypothesisSynthesizerAgent;
  let mockClient: Anthropic;

  beforeEach(() => {
    mockClient = {} as Anthropic;
    agent = new TestableHypothesisSynthesizerAgent(mockClient);
  });

  describe('normalizeExperiment', () => {
    it('should return requirements object instead of resourceEstimate', () => {
      const input = {
        title: 'Test binding assay',
        objective: 'Validate attention mechanism hypothesis',
        methodology: 'In vitro binding assay',
        expectedOutcome: 'Measure binding affinity',
        requirements: {
          dataSources: ['PDB', 'UniProt'],
          expertise: ['Biochemist', 'Computational biologist'],
          infrastructure: ['HPC cluster', 'Laboratory'],
          dependencies: ['Protein purification', 'Assay development'],
          risks: ['False positives', 'Scaling challenges'],
        },
        successCriteria: ['p < 0.05', 'Effect size > 0.3'],
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.requirements).toBeDefined();
      expect(result?.requirements).toMatchObject({
        dataSources: ['PDB', 'UniProt'],
        expertise: ['Biochemist', 'Computational biologist'],
        infrastructure: ['HPC cluster', 'Laboratory'],
        dependencies: ['Protein purification', 'Assay development'],
        risks: ['False positives', 'Scaling challenges'],
      });
      expect(result?.resourceEstimate).toBeUndefined();
    });

    it('should handle LLM field variations (method -> methodology)', () => {
      const input = {
        method: 'Perform systematic binding assays',
        metrics: ['Kd values', 'Binding specificity'],
        timeline: '12 months',
        requirements: 'Access to protein expression facility',
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.methodology).toBe('Perform systematic binding assays');
      expect(result?.title).toContain('Perform systematic binding assays');
    });

    it('should convert requirements string to requirements object', () => {
      const input = {
        title: 'Test experiment',
        methodology: 'Test method',
        requirements: 'Need HPC cluster and expertise in ML',
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.requirements).toBeDefined();
      expect(typeof result?.requirements).toBe('object');
      expect((result?.requirements as any).dataSources).toBeDefined();
      expect((result?.requirements as any).expertise).toBeDefined();
      expect((result?.requirements as any).infrastructure).toBeDefined();
    });

    it('should map metrics to successCriteria', () => {
      const input = {
        method: 'Test method',
        metrics: ['Accuracy > 0.9', 'Precision > 0.85'],
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.successCriteria).toEqual(['Accuracy > 0.9', 'Precision > 0.85']);
    });

    it('should provide default requirements when missing', () => {
      const input = {
        title: 'Minimal experiment',
        methodology: 'Basic approach',
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.requirements).toBeDefined();
      expect((result?.requirements as any).dataSources).toEqual(['TBD']);
      expect((result?.requirements as any).expertise).toEqual(['Research']);
      expect((result?.requirements as any).infrastructure).toEqual(['TBD']);
      expect((result?.requirements as any).dependencies).toEqual([]);
      expect((result?.requirements as any).risks).toEqual(['TBD']);
    });

    it('should return undefined for non-object input', () => {
      expect(agent.testNormalizeExperiment(null)).toBeUndefined();
      expect(agent.testNormalizeExperiment(undefined)).toBeUndefined();
      expect(agent.testNormalizeExperiment('string')).toBeUndefined();
      expect(agent.testNormalizeExperiment(123)).toBeUndefined();
    });

    it('should extract title from method when title missing', () => {
      const input = {
        method: 'Perform a comprehensive binding assay using fluorescence-based detection, with controls',
      };

      const result = agent.testNormalizeExperiment(input);

      expect(result).toBeDefined();
      expect(result?.title).toBeDefined();
      expect(result?.title?.length).toBeLessThanOrEqual(63); // 60 + '...'
    });
  });

  describe('normalizeResearchSuggestion', () => {
    it('should handle valid research suggestion with all fields', () => {
      const input = {
        type: 'literature-review',
        scope: 'Review attention mechanisms in protein binding',
        questions: [
          'What attention variants exist?',
          'How applicable to protein binding?',
        ],
        sources: ['Google Scholar', 'PubMed'],
        estimatedEffort: 'moderate',
      };

      const result = agent.testNormalizeResearchSuggestion(input);

      expect(result).toMatchObject({
        type: 'literature-review',
        scope: 'Review attention mechanisms in protein binding',
        questions: [
          'What attention variants exist?',
          'How applicable to protein binding?',
        ],
        sources: ['Google Scholar', 'PubMed'],
        estimatedEffort: 'moderate',
      });
    });

    it('should normalize type field variations', () => {
      const variations = [
        { researchType: 'data-gathering', type: undefined },
        { kind: 'expert-consultation', type: undefined },
        { category: 'preliminary-modeling', type: undefined },
      ];

      variations.forEach((input) => {
        const result = agent.testNormalizeResearchSuggestion(input);
        expect(result).toBeDefined();
        expect(result?.type).toBeDefined();
        expect(['literature-review', 'data-gathering', 'expert-consultation', 'preliminary-modeling']).toContain(result?.type);
      });
    });

    it('should provide defaults for missing required fields', () => {
      const input = {
        type: 'literature-review',
      };

      const result = agent.testNormalizeResearchSuggestion(input);

      expect(result).toBeDefined();
      expect(result?.scope).toBe('TBD');
      expect(result?.questions).toEqual([]);
      expect(result?.sources).toEqual([]);
      expect(result?.estimatedEffort).toBe('moderate');
    });

    it('should normalize effort field variations', () => {
      const variations = [
        { type: 'literature-review', effort: 'minimal' },
        { type: 'literature-review', timeRequired: 'substantial' },
        { type: 'literature-review', duration: 'moderate' },
      ];

      variations.forEach((input) => {
        const result = agent.testNormalizeResearchSuggestion(input);
        expect(result).toBeDefined();
        expect(['minimal', 'moderate', 'substantial']).toContain(result?.estimatedEffort);
      });
    });

    it('should handle string sources and convert to array', () => {
      const input = {
        type: 'literature-review',
        sources: 'Google Scholar, PubMed, arXiv',
      };

      const result = agent.testNormalizeResearchSuggestion(input);

      expect(result).toBeDefined();
      expect(Array.isArray(result?.sources)).toBe(true);
      expect(result?.sources?.length).toBeGreaterThan(0);
    });

    it('should handle string questions and convert to array', () => {
      const input = {
        type: 'literature-review',
        questions: 'What are the key mechanisms? How do they scale?',
      };

      const result = agent.testNormalizeResearchSuggestion(input);

      expect(result).toBeDefined();
      expect(Array.isArray(result?.questions)).toBe(true);
      expect(result?.questions?.length).toBeGreaterThan(0);
    });

    it('should return undefined for non-object input', () => {
      expect(agent.testNormalizeResearchSuggestion(null)).toBeUndefined();
      expect(agent.testNormalizeResearchSuggestion(undefined)).toBeUndefined();
      expect(agent.testNormalizeResearchSuggestion('string')).toBeUndefined();
    });
  });

  describe('normalizeResearchSuggestions', () => {
    it('should handle array of research suggestions', () => {
      const input = [
        {
          type: 'literature-review',
          scope: 'Review attention mechanisms',
          questions: ['Q1'],
          sources: ['S1'],
          estimatedEffort: 'minimal',
        },
        {
          type: 'data-gathering',
          scope: 'Collect protein data',
          questions: ['Q2'],
          sources: ['S2'],
          estimatedEffort: 'moderate',
        },
      ];

      const result = agent.testNormalizeResearchSuggestions(input);

      expect(result).toHaveLength(2);
      expect(result?.[0]?.type).toBe('literature-review');
      expect(result?.[1]?.type).toBe('data-gathering');
    });

    it('should wrap single object in array', () => {
      const input = {
        type: 'literature-review',
        scope: 'Review mechanisms',
        questions: ['Q1'],
        sources: ['S1'],
        estimatedEffort: 'minimal',
      };

      const result = agent.testNormalizeResearchSuggestions(input);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(1);
      expect(result?.[0]?.type).toBe('literature-review');
    });

    it('should filter out invalid suggestions', () => {
      const input = [
        {
          type: 'literature-review',
          scope: 'Valid',
          questions: [],
          sources: [],
          estimatedEffort: 'minimal',
        },
        null,
        undefined,
        'invalid',
        123,
        {
          type: 'data-gathering',
          scope: 'Also valid',
          questions: [],
          sources: [],
          estimatedEffort: 'moderate',
        },
      ];

      const result = agent.testNormalizeResearchSuggestions(input);

      expect(result).toHaveLength(2);
      expect(result?.[0]?.type).toBe('literature-review');
      expect(result?.[1]?.type).toBe('data-gathering');
    });

    it('should return undefined for non-array/non-object input', () => {
      expect(agent.testNormalizeResearchSuggestions(null)).toBeUndefined();
      expect(agent.testNormalizeResearchSuggestions(undefined)).toBeUndefined();
      expect(agent.testNormalizeResearchSuggestions('string')).toBeUndefined();
      expect(agent.testNormalizeResearchSuggestions(123)).toBeUndefined();
    });

    it('should return empty array for empty input array', () => {
      const result = agent.testNormalizeResearchSuggestions([]);

      expect(Array.isArray(result)).toBe(true);
      expect(result).toHaveLength(0);
    });
  });

  describe('normalizeHypothesis', () => {
    it('should include suggestedResearch in normalized hypothesis', () => {
      const input = {
        id: 'hyp-001',
        title: 'Test Hypothesis',
        statement: 'Test statement',
        sourceDomain: 'ml-ai',
        targetDomain: 'computational-biology',
        connection: {},
        components: {
          insight: 'Test insight',
          application: 'Test application',
          mechanism: 'Test mechanism',
          prediction: 'Test prediction',
        },
        confidence: 'high',
        citations: [],
        suggestedResearch: [
          {
            type: 'literature-review',
            scope: 'Review relevant literature',
            questions: ['Q1'],
            sources: ['S1'],
            estimatedEffort: 'minimal',
          },
        ],
      };

      const result = agent.testNormalizeHypothesis(input, 0);

      expect(result.suggestedResearch).toBeDefined();
      expect(Array.isArray(result.suggestedResearch)).toBe(true);
      expect(result.suggestedResearch).toHaveLength(1);
      expect((result.suggestedResearch as any[])[0].type).toBe('literature-review');
    });

    it('should normalize suggestedResearch using normalizeResearchSuggestions', () => {
      const input = {
        id: 'hyp-001',
        title: 'Test',
        statement: 'Test',
        connection: {},
        citations: [],
        suggestedResearch: {
          type: 'data-gathering',
          scope: 'Single research suggestion',
          questions: [],
          sources: [],
          estimatedEffort: 'moderate',
        },
      };

      const result = agent.testNormalizeHypothesis(input, 0);

      expect(result.suggestedResearch).toBeDefined();
      expect(Array.isArray(result.suggestedResearch)).toBe(true);
      expect(result.suggestedResearch).toHaveLength(1);
    });

    it('should handle missing suggestedResearch gracefully', () => {
      const input = {
        id: 'hyp-001',
        title: 'Test',
        statement: 'Test',
        connection: {},
        citations: [],
      };

      const result = agent.testNormalizeHypothesis(input, 0);

      // Should still include the field, either as undefined or empty array
      expect(result.suggestedResearch === undefined || Array.isArray(result.suggestedResearch)).toBe(true);
    });

    it('should preserve existing suggestedExperiment', () => {
      const input = {
        id: 'hyp-001',
        title: 'Test',
        statement: 'Test',
        connection: {},
        citations: [],
        suggestedExperiment: {
          title: 'Test Experiment',
          methodology: 'Test method',
        },
      };

      const result = agent.testNormalizeHypothesis(input, 0);

      expect(result.suggestedExperiment).toBeDefined();
    });
  });

  describe('parseResponse - Integration', () => {
    it('should parse complete response with suggestedResearch', () => {
      const response = `
{
  "hypotheses": [
    {
      "id": "hyp-001",
      "title": "Attention Mechanisms for Protein Binding",
      "statement": "Attention mechanisms from transformers can model protein binding specificity",
      "sourceDomain": "ml-ai",
      "targetDomain": "computational-biology",
      "connection": {
        "id": "conn-1",
        "sourceConcept": {
          "id": "src-1",
          "name": "Attention Mechanism",
          "domain": "ml-ai",
          "description": "Neural attention",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "targetConcept": {
          "id": "tgt-1",
          "name": "Protein Binding",
          "domain": "computational-biology",
          "description": "Protein interactions",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "connectionType": "shared-structure",
        "similarityScore": 4,
        "explanation": "Both involve selective attention",
        "confidence": "high"
      },
      "components": {
        "insight": "Attention weights select relevant inputs",
        "application": "Model binding site selectivity",
        "mechanism": "Weighted scoring of binding sites",
        "prediction": "Improved binding affinity prediction"
      },
      "confidence": "high",
      "citations": [
        {
          "id": "cit-1",
          "type": "llm-knowledge",
          "title": "Attention Is All You Need",
          "relevance": "Related",
          "verified": false
        }
      ],
      "suggestedExperiment": {
        "method": "Implement attention-based binding predictor",
        "metrics": ["AUC-ROC", "Precision"],
        "timeline": "6 months",
        "requirements": "GPU cluster"
      },
      "suggestedResearch": [
        {
          "type": "literature-review",
          "scope": "Review attention mechanisms and protein binding models",
          "questions": ["What attention variants exist?"],
          "sources": ["Google Scholar"],
          "estimatedEffort": "moderate"
        }
      ],
      "generatedAt": "2025-01-19T00:00:00Z",
      "status": "raw"
    }
  ],
  "metadata": {
    "totalGenerated": 1,
    "connectionsCovered": 1,
    "averageConfidence": "high"
  }
}
`;

      const result = agent.testParseResponse(response);

      expect(result.hypotheses).toHaveLength(1);

      const hyp = result.hypotheses[0];
      expect(hyp.suggestedResearch).toBeDefined();
      expect(Array.isArray(hyp.suggestedResearch)).toBe(true);
      expect(hyp.suggestedResearch).toHaveLength(1);
      expect(hyp.suggestedResearch?.[0]?.type).toBe('literature-review');

      expect(hyp.suggestedExperiment).toBeDefined();
      expect(hyp.suggestedExperiment?.requirements).toBeDefined();
      expect(hyp.suggestedExperiment?.resourceEstimate).toBeUndefined();
    });

    it('should handle response with single suggestedResearch object', () => {
      const response = `
{
  "hypotheses": [
    {
      "id": "hyp-001",
      "title": "Test",
      "statement": "Test statement",
      "sourceDomain": "ml-ai",
      "targetDomain": "computational-biology",
      "connection": {
        "id": "conn-1",
        "sourceConcept": {
          "id": "src-1",
          "name": "Test",
          "domain": "ml-ai",
          "description": "Test",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "targetConcept": {
          "id": "tgt-1",
          "name": "Test",
          "domain": "computational-biology",
          "description": "Test",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "connectionType": "shared-structure",
        "similarityScore": 3,
        "explanation": "Test",
        "confidence": "medium"
      },
      "components": {
        "insight": "Test",
        "application": "Test",
        "mechanism": "Test",
        "prediction": "Test"
      },
      "confidence": "medium",
      "citations": [],
      "suggestedResearch": {
        "type": "data-gathering",
        "scope": "Single research item",
        "questions": [],
        "sources": [],
        "estimatedEffort": "minimal"
      },
      "generatedAt": "2025-01-19T00:00:00Z",
      "status": "raw"
    }
  ],
  "metadata": {
    "totalGenerated": 1,
    "connectionsCovered": 1,
    "averageConfidence": "medium"
  }
}
`;

      const result = agent.testParseResponse(response);

      expect(result.hypotheses).toHaveLength(1);
      expect(result.hypotheses[0].suggestedResearch).toBeDefined();
      expect(Array.isArray(result.hypotheses[0].suggestedResearch)).toBe(true);
      expect(result.hypotheses[0].suggestedResearch).toHaveLength(1);
    });

    it('should handle response without suggestedResearch', () => {
      const response = `
{
  "hypotheses": [
    {
      "id": "hyp-001",
      "title": "Test",
      "statement": "Test statement",
      "sourceDomain": "ml-ai",
      "targetDomain": "computational-biology",
      "connection": {
        "id": "conn-1",
        "sourceConcept": {
          "id": "src-1",
          "name": "Test",
          "domain": "ml-ai",
          "description": "Test",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "targetConcept": {
          "id": "tgt-1",
          "name": "Test",
          "domain": "computational-biology",
          "description": "Test",
          "type": "method",
          "relatedConcepts": [],
          "sources": []
        },
        "connectionType": "shared-structure",
        "similarityScore": 3,
        "explanation": "Test",
        "confidence": "medium"
      },
      "components": {
        "insight": "Test",
        "application": "Test",
        "mechanism": "Test",
        "prediction": "Test"
      },
      "confidence": "medium",
      "citations": [],
      "generatedAt": "2025-01-19T00:00:00Z",
      "status": "raw"
    }
  ],
  "metadata": {
    "totalGenerated": 1,
    "connectionsCovered": 1,
    "averageConfidence": "medium"
  }
}
`;

      const result = agent.testParseResponse(response);

      expect(result.hypotheses).toHaveLength(1);
      // Should not throw - suggestedResearch is optional
    });
  });
});
