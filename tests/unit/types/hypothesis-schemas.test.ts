/**
 * Unit tests for ADR-009 Hypothesis Enhancement Schema Changes
 * TDD Phase: RED - Tests written before implementation
 */

import { describe, it, expect } from 'vitest';
import {
  ExperimentRequirementsSchema,
  ResearchSuggestionTypeSchema,
  ResearchEffortSchema,
  ResearchSuggestionSchema,
  ExperimentSuggestionSchema,
  HypothesisSchema,
} from '../../../src/types/hypothesis.js';

describe('ADR-009: Hypothesis Enhancement Schemas', () => {
  describe('ExperimentRequirementsSchema', () => {
    it('should validate complete requirements object with all required fields', () => {
      const validRequirements = {
        dataSources: ['protein-structure-database', 'gene-expression-data'],
        expertise: ['structural-biology', 'machine-learning'],
        infrastructure: ['gpu-cluster', 'protein-folding-software'],
        dependencies: ['validated-dataset', 'baseline-model'],
        risks: ['data-quality-uncertainty', 'computational-cost'],
      };

      const result = ExperimentRequirementsSchema.parse(validRequirements);

      expect(result.dataSources).toEqual(validRequirements.dataSources);
      expect(result.expertise).toEqual(validRequirements.expertise);
      expect(result.infrastructure).toEqual(validRequirements.infrastructure);
      expect(result.dependencies).toEqual(validRequirements.dependencies);
      expect(result.risks).toEqual(validRequirements.risks);
    });

    it('should require dataSources array field', () => {
      const missingDataSources = {
        expertise: ['structural-biology'],
        infrastructure: ['gpu-cluster'],
        dependencies: ['validated-dataset'],
        risks: ['data-quality-uncertainty'],
      };

      expect(() => ExperimentRequirementsSchema.parse(missingDataSources)).toThrow();
    });

    it('should require expertise array field', () => {
      const missingExpertise = {
        dataSources: ['protein-structure-database'],
        infrastructure: ['gpu-cluster'],
        dependencies: ['validated-dataset'],
        risks: ['data-quality-uncertainty'],
      };

      expect(() => ExperimentRequirementsSchema.parse(missingExpertise)).toThrow();
    });

    it('should require infrastructure array field', () => {
      const missingInfrastructure = {
        dataSources: ['protein-structure-database'],
        expertise: ['structural-biology'],
        dependencies: ['validated-dataset'],
        risks: ['data-quality-uncertainty'],
      };

      expect(() => ExperimentRequirementsSchema.parse(missingInfrastructure)).toThrow();
    });

    it('should require dependencies array field', () => {
      const missingDependencies = {
        dataSources: ['protein-structure-database'],
        expertise: ['structural-biology'],
        infrastructure: ['gpu-cluster'],
        risks: ['data-quality-uncertainty'],
      };

      expect(() => ExperimentRequirementsSchema.parse(missingDependencies)).toThrow();
    });

    it('should require risks array field', () => {
      const missingRisks = {
        dataSources: ['protein-structure-database'],
        expertise: ['structural-biology'],
        infrastructure: ['gpu-cluster'],
        dependencies: ['validated-dataset'],
      };

      expect(() => ExperimentRequirementsSchema.parse(missingRisks)).toThrow();
    });

    it('should accept empty arrays for all fields', () => {
      const emptyArrays = {
        dataSources: [],
        expertise: [],
        infrastructure: [],
        dependencies: [],
        risks: [],
      };

      const result = ExperimentRequirementsSchema.parse(emptyArrays);

      expect(result.dataSources).toHaveLength(0);
      expect(result.expertise).toHaveLength(0);
      expect(result.infrastructure).toHaveLength(0);
      expect(result.dependencies).toHaveLength(0);
      expect(result.risks).toHaveLength(0);
    });

    it('should reject non-array values for any field', () => {
      const invalidTypes = {
        dataSources: 'not-an-array',
        expertise: ['structural-biology'],
        infrastructure: ['gpu-cluster'],
        dependencies: ['validated-dataset'],
        risks: ['data-quality-uncertainty'],
      };

      expect(() => ExperimentRequirementsSchema.parse(invalidTypes)).toThrow();
    });
  });

  describe('ResearchSuggestionTypeSchema', () => {
    it('should accept all valid research suggestion types', () => {
      const validTypes = [
        'literature-review',
        'data-gathering',
        'expert-consultation',
        'preliminary-modeling',
      ];

      validTypes.forEach((type) => {
        const result = ResearchSuggestionTypeSchema.parse(type);
        expect(result).toBe(type);
      });
    });

    it('should reject invalid research suggestion types', () => {
      const invalidTypes = [
        'full-experiment',
        'literature_review',
        'data-collection',
        'expert-interview',
        'modeling',
        '',
      ];

      invalidTypes.forEach((type) => {
        expect(() => ResearchSuggestionTypeSchema.parse(type)).toThrow();
      });
    });
  });

  describe('ResearchEffortSchema', () => {
    it('should accept all valid effort levels', () => {
      const validEfforts = ['minimal', 'moderate', 'substantial'];

      validEfforts.forEach((effort) => {
        const result = ResearchEffortSchema.parse(effort);
        expect(result).toBe(effort);
      });
    });

    it('should reject invalid effort levels', () => {
      const invalidEfforts = ['low', 'medium', 'high', 'small', 'large', ''];

      invalidEfforts.forEach((effort) => {
        expect(() => ResearchEffortSchema.parse(effort)).toThrow();
      });
    });
  });

  describe('ResearchSuggestionSchema', () => {
    it('should validate complete research suggestion', () => {
      const validSuggestion = {
        type: 'literature-review' as const,
        scope: 'Survey existing protein folding prediction methods',
        questions: ['What accuracy levels have been achieved?', 'What datasets are commonly used?'],
        sources: ['AlphaFold paper and citations', 'Protein Data Bank documentation'],
        estimatedEffort: 'moderate' as const,
      };

      const result = ResearchSuggestionSchema.parse(validSuggestion);

      expect(result.type).toBe('literature-review');
      expect(result.scope).toBe(validSuggestion.scope);
      expect(result.questions).toEqual(validSuggestion.questions);
      expect(result.sources).toEqual(validSuggestion.sources);
      expect(result.estimatedEffort).toBe('moderate');
    });

    it('should require type field', () => {
      const missingType = {
        scope: 'Survey existing methods',
        questions: ['What accuracy levels?'],
        sources: ['AlphaFold paper'],
        estimatedEffort: 'moderate',
      };

      expect(() => ResearchSuggestionSchema.parse(missingType)).toThrow();
    });

    it('should require scope field', () => {
      const missingScope = {
        type: 'literature-review',
        questions: ['What accuracy levels?'],
        sources: ['AlphaFold paper'],
        estimatedEffort: 'moderate',
      };

      expect(() => ResearchSuggestionSchema.parse(missingScope)).toThrow();
    });

    it('should require questions array field', () => {
      const missingQuestions = {
        type: 'literature-review',
        scope: 'Survey existing methods',
        sources: ['AlphaFold paper'],
        estimatedEffort: 'moderate',
      };

      expect(() => ResearchSuggestionSchema.parse(missingQuestions)).toThrow();
    });

    it('should require sources array field', () => {
      const missingSources = {
        type: 'literature-review',
        scope: 'Survey existing methods',
        questions: ['What accuracy levels?'],
        estimatedEffort: 'moderate',
      };

      expect(() => ResearchSuggestionSchema.parse(missingSources)).toThrow();
    });

    it('should require estimatedEffort field', () => {
      const missingEffort = {
        type: 'literature-review',
        scope: 'Survey existing methods',
        questions: ['What accuracy levels?'],
        sources: ['AlphaFold paper'],
      };

      expect(() => ResearchSuggestionSchema.parse(missingEffort)).toThrow();
    });
  });

  describe('Updated ExperimentSuggestionSchema', () => {
    it('should have requirements field instead of resourceEstimate', () => {
      const validExperiment = {
        title: 'Test Protein Folding Prediction',
        objective: 'Validate transformer architecture for protein folding',
        methodology: 'Train transformer model on PDB dataset',
        expectedOutcome: 'Improved prediction accuracy',
        requirements: {
          dataSources: ['protein-structure-database'],
          expertise: ['structural-biology', 'machine-learning'],
          infrastructure: ['gpu-cluster'],
          dependencies: ['validated-dataset'],
          risks: ['data-quality-uncertainty'],
        },
        successCriteria: ['Accuracy > 90%', 'Computational cost < baseline'],
      };

      const result = ExperimentSuggestionSchema.parse(validExperiment);

      expect(result.requirements).toBeDefined();
      expect(result.requirements.dataSources).toEqual(['protein-structure-database']);
      expect(result.requirements.expertise).toEqual(['structural-biology', 'machine-learning']);
    });

    it('should not accept old resourceEstimate field', () => {
      const oldFormat = {
        title: 'Test Experiment',
        objective: 'Test objective',
        methodology: 'Test methodology',
        expectedOutcome: 'Test outcome',
        resourceEstimate: {
          timeMonths: 12,
          budgetUSD: '$100K-$500K',
          expertise: ['structural-biology'],
        },
        successCriteria: ['Success criterion'],
      };

      expect(() => ExperimentSuggestionSchema.parse(oldFormat)).toThrow();
    });
  });

  describe('Updated HypothesisSchema with suggestedResearch', () => {
    const baseHypothesis = {
      id: 'hyp-001',
      title: 'Test Hypothesis',
      statement: 'This is a test hypothesis statement',
      sourceDomain: 'ml-ai',
      targetDomain: 'computational-biology',
      connection: {
        id: 'conn-001',
        sourceConcept: {
          id: 'concept-source',
          domain: 'ml-ai',
          name: 'Source Concept',
          description: 'Test description',
          type: 'method',
          relatedConcepts: [],
          sources: [],
        },
        targetConcept: {
          id: 'concept-target',
          domain: 'computational-biology',
          name: 'Target Concept',
          description: 'Test description',
          type: 'problem',
          relatedConcepts: [],
          sources: [],
        },
        connectionType: 'shared-structure',
        similarityScore: 4,
        explanation: 'Test connection',
        confidence: 'medium',
      },
      components: {
        insight: 'Test insight',
        application: 'Test application',
        mechanism: 'Test mechanism',
        prediction: 'Test prediction',
      },
      confidence: 'medium',
      citations: [],
      generatedAt: '2026-01-19T10:00:00.000Z',
      status: 'raw',
    };

    it('should accept optional suggestedResearch array field', () => {
      const hypothesisWithResearch = {
        ...baseHypothesis,
        suggestedResearch: [
          {
            type: 'literature-review',
            scope: 'Review existing work',
            questions: ['What has been done?'],
            sources: ['Academic databases'],
            estimatedEffort: 'minimal',
          },
        ],
      };

      const result = HypothesisSchema.parse(hypothesisWithResearch);

      expect(result.suggestedResearch).toBeDefined();
      expect(result.suggestedResearch).toHaveLength(1);
      expect(result.suggestedResearch![0].type).toBe('literature-review');
    });

    it('should accept hypothesis without suggestedResearch field', () => {
      const result = HypothesisSchema.parse(baseHypothesis);
      expect(result.suggestedResearch).toBeUndefined();
    });

    it('should accept hypothesis with both suggestedExperiment and suggestedResearch', () => {
      const hypothesisWithBoth = {
        ...baseHypothesis,
        suggestedExperiment: {
          title: 'Full Scale Experiment',
          objective: 'Test the hypothesis',
          methodology: 'Controlled trial',
          expectedOutcome: 'Positive results',
          requirements: {
            dataSources: ['dataset-A'],
            expertise: ['expert-type-1'],
            infrastructure: ['tool-1'],
            dependencies: ['prerequisite-1'],
            risks: ['risk-1'],
          },
          successCriteria: ['Metric improves'],
        },
        suggestedResearch: [
          {
            type: 'preliminary-modeling',
            scope: 'Build initial model',
            questions: ['Can we prototype this?'],
            sources: ['Existing tools'],
            estimatedEffort: 'substantial',
          },
        ],
      };

      const result = HypothesisSchema.parse(hypothesisWithBoth);

      expect(result.suggestedExperiment).toBeDefined();
      expect(result.suggestedResearch).toBeDefined();
      expect(result.suggestedResearch).toHaveLength(1);
    });
  });
});
