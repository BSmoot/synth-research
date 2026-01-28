/**
 * Unit tests for Hypothesis Integrator Agent (ADR-010)
 */

import { describe, it, expect, beforeEach, vi } from 'vitest';
import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { HypothesisIntegratorAgent } from '../../src/agents/hypothesis-integrator.js';
import type {
  IntegrationRequest,
  IntegrationResult,
  ScoredHypothesis,
} from '../../src/types/index.js';

// Testable subclass that exposes protected methods
class TestableHypothesisIntegratorAgent extends HypothesisIntegratorAgent {
  public testParseResponse(response: string): IntegrationResult {
    return this.parseResponse(response);
  }

  public testExtractJSON(response: string): string {
    return this.extractJSON(response);
  }
}

describe('HypothesisIntegratorAgent', () => {
  let mockClient: Anthropic;
  let agent: TestableHypothesisIntegratorAgent;

  beforeEach(() => {
    mockClient = {} as Anthropic;
    agent = new TestableHypothesisIntegratorAgent(mockClient);
  });

  describe('parseResponse', () => {
    it('should parse valid integration result', () => {
      const mockResponse = `
\`\`\`json
{
  "clusters": [
    {
      "id": "${randomUUID()}",
      "name": "Test Cluster",
      "hypothesisIds": ["hyp-001", "hyp-002"],
      "criterion": "shared-mechanism",
      "coherenceScore": 0.85,
      "summary": "Cluster summary"
    }
  ],
  "integratedTheories": [
    {
      "id": "${randomUUID()}",
      "title": "Test Theory",
      "description": "Theory description",
      "hypothesisIds": ["hyp-001", "hyp-002"],
      "sourceDomains": ["ml-ai"],
      "targetDomain": "computational-biology",
      "unifiedMechanism": "Mechanism",
      "syntheticPredictions": ["Prediction 1"],
      "confidence": 0.78
    }
  ],
  "dependencies": [
    {
      "id": "${randomUUID()}",
      "sourceHypothesisId": "hyp-001",
      "targetHypothesisId": "hyp-002",
      "type": "prerequisite",
      "explanation": "Dependency explanation",
      "strength": 0.9
    }
  ],
  "queryCoverage": {
    "requirements": [
      {
        "id": "${randomUUID()}",
        "requirement": "Test requirement",
        "type": "conceptual",
        "priority": "critical"
      }
    ],
    "coverage": [
      {
        "requirementId": "${randomUUID()}",
        "hypothesisIds": ["hyp-001"],
        "coverageScore": 0.7,
        "gaps": ["Gap 1"]
      }
    ],
    "overallCoverage": 0.65,
    "recommendations": ["Recommendation 1"]
  },
  "metadata": {
    "totalHypotheses": 2,
    "totalClusters": 1,
    "totalTheories": 1,
    "totalDependencies": 1,
    "averageCoherence": 0.85
  }
}
\`\`\`
      `;

      const result = agent.testParseResponse(mockResponse);

      expect(result.clusters).toHaveLength(1);
      expect(result.clusters[0].name).toBe('Test Cluster');
      expect(result.clusters[0].coherenceScore).toBe(0.85);
      expect(result.integratedTheories).toHaveLength(1);
      expect(result.dependencies).toHaveLength(1);
      expect(result.queryCoverage.overallCoverage).toBe(0.65);
      expect(result.metadata.totalHypotheses).toBe(2);
    });

    it('should generate UUIDs for items missing them', () => {
      const mockResponse = `
{
  "clusters": [
    {
      "id": "not-a-uuid",
      "name": "Test Cluster",
      "hypothesisIds": ["hyp-001"],
      "criterion": "shared-mechanism",
      "coherenceScore": 0.85,
      "summary": "Summary"
    }
  ],
  "integratedTheories": [],
  "dependencies": [],
  "queryCoverage": {
    "requirements": [
      {
        "id": "also-not-uuid",
        "requirement": "Req",
        "type": "conceptual",
        "priority": "critical"
      }
    ],
    "coverage": [],
    "overallCoverage": 0.5,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 1,
    "totalClusters": 1,
    "totalTheories": 0,
    "totalDependencies": 0,
    "averageCoherence": 0.85
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);

      // Should generate valid UUIDs
      expect(result.clusters[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
      expect(result.queryCoverage.requirements[0].id).toMatch(
        /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i
      );
    });

    it('should normalize domain fields', () => {
      const mockResponse = `
{
  "clusters": [],
  "integratedTheories": [
    {
      "id": "${randomUUID()}",
      "title": "Theory",
      "description": "Desc",
      "hypothesisIds": ["hyp-001"],
      "sourceDomains": ["machine-learning", "AI"],
      "targetDomain": "comp-bio",
      "unifiedMechanism": "Mech",
      "syntheticPredictions": ["Pred"],
      "confidence": 0.7
    }
  ],
  "dependencies": [],
  "queryCoverage": {
    "requirements": [],
    "coverage": [],
    "overallCoverage": 0.5,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 1,
    "totalClusters": 0,
    "totalTheories": 1,
    "totalDependencies": 0,
    "averageCoherence": 0.7
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);

      // Should normalize to valid domain tags
      expect(result.integratedTheories[0].sourceDomains).toContain('ml-ai');
      expect(result.integratedTheories[0].targetDomain).toBe('computational-biology');
    });

    it('should handle empty arrays gracefully', () => {
      const mockResponse = `
{
  "clusters": [],
  "integratedTheories": [],
  "dependencies": [],
  "queryCoverage": {
    "requirements": [],
    "coverage": [],
    "overallCoverage": 0.0,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 0,
    "totalClusters": 0,
    "totalTheories": 0,
    "totalDependencies": 0,
    "averageCoherence": 0.0
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);

      expect(result.clusters).toEqual([]);
      expect(result.integratedTheories).toEqual([]);
      expect(result.dependencies).toEqual([]);
      expect(result.queryCoverage.requirements).toEqual([]);
    });

    it('should validate clustering criteria', () => {
      const mockResponse = `
{
  "clusters": [
    {
      "id": "${randomUUID()}",
      "name": "Test",
      "hypothesisIds": ["hyp-001"],
      "criterion": "shared-mechanism",
      "coherenceScore": 0.8,
      "summary": "Summary"
    }
  ],
  "integratedTheories": [],
  "dependencies": [],
  "queryCoverage": {
    "requirements": [],
    "coverage": [],
    "overallCoverage": 0.5,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 1,
    "totalClusters": 1,
    "totalTheories": 0,
    "totalDependencies": 0,
    "averageCoherence": 0.8
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);
      expect(result.clusters[0].criterion).toBe('shared-mechanism');
    });

    it('should validate dependency types', () => {
      const mockResponse = `
{
  "clusters": [],
  "integratedTheories": [],
  "dependencies": [
    {
      "id": "${randomUUID()}",
      "sourceHypothesisId": "hyp-001",
      "targetHypothesisId": "hyp-002",
      "type": "prerequisite",
      "explanation": "Explanation",
      "strength": 0.9
    },
    {
      "id": "${randomUUID()}",
      "sourceHypothesisId": "hyp-002",
      "targetHypothesisId": "hyp-003",
      "type": "supports",
      "explanation": "Explanation",
      "strength": 0.7
    }
  ],
  "queryCoverage": {
    "requirements": [],
    "coverage": [],
    "overallCoverage": 0.5,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 3,
    "totalClusters": 0,
    "totalTheories": 0,
    "totalDependencies": 2,
    "averageCoherence": 0.0
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);
      expect(result.dependencies[0].type).toBe('prerequisite');
      expect(result.dependencies[1].type).toBe('supports');
    });

    it('should validate query coverage requirement types', () => {
      const mockResponse = `
{
  "clusters": [],
  "integratedTheories": [],
  "dependencies": [],
  "queryCoverage": {
    "requirements": [
      {
        "id": "${randomUUID()}",
        "requirement": "Req 1",
        "type": "conceptual",
        "priority": "critical"
      },
      {
        "id": "${randomUUID()}",
        "requirement": "Req 2",
        "type": "methodological",
        "priority": "important"
      }
    ],
    "coverage": [],
    "overallCoverage": 0.5,
    "recommendations": []
  },
  "metadata": {
    "totalHypotheses": 0,
    "totalClusters": 0,
    "totalTheories": 0,
    "totalDependencies": 0,
    "averageCoherence": 0.0
  }
}
      `;

      const result = agent.testParseResponse(mockResponse);
      expect(result.queryCoverage.requirements[0].type).toBe('conceptual');
      expect(result.queryCoverage.requirements[1].type).toBe('methodological');
      expect(result.queryCoverage.requirements[0].priority).toBe('critical');
      expect(result.queryCoverage.requirements[1].priority).toBe('important');
    });
  });

  describe('extractJSON', () => {
    it('should extract JSON from markdown code blocks', () => {
      const response = '```json\n{"test": "value"}\n```';
      const json = agent.testExtractJSON(response);
      expect(json).toBe('{"test": "value"}');
    });

    it('should extract JSON without code block markers', () => {
      const response = 'Some text before\n{"test": "value"}\nSome text after';
      const json = agent.testExtractJSON(response);
      expect(json).toBe('{"test": "value"}');
    });
  });
});
