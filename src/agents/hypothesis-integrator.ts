/**
 * Hypothesis Integrator Agent (ADR-010)
 * Integrates validated hypotheses through clustering, theory composition, and coverage analysis
 */

import { randomUUID } from 'crypto';
import Anthropic from '@anthropic-ai/sdk';
import { BaseAgent, AgentConfig } from './base-agent.js';
import {
  IntegrationRequest,
  IntegrationResult,
  IntegrationResultSchema,
  normalizeDomainsInObject,
} from '../types/index.js';

const DEFAULT_CONFIG: AgentConfig = {
  name: 'hypothesis-integrator',
  model: 'claude-opus-4-20250514',
  maxTokens: 8192,
  temperature: 0.6,
};

export class HypothesisIntegratorAgent extends BaseAgent<
  IntegrationRequest,
  IntegrationResult
> {
  constructor(client: Anthropic, config: Partial<AgentConfig> = {}) {
    super(client, { ...DEFAULT_CONFIG, ...config });
  }

  async execute(
    input: IntegrationRequest,
    signal?: AbortSignal
  ): Promise<IntegrationResult> {
    const systemPrompt = this.buildSystemPrompt();
    const userPrompt = this.buildUserPrompt(input);

    // Use free-text JSON (callLLMWithSchema times out with nested schemas)
    const response = await this.callLLM(systemPrompt, userPrompt, { signal });
    return this.parseResponse(response);
  }

  protected buildSystemPrompt(): string {
    return `You are the Hypothesis Integrator, an expert at synthesizing validated hypotheses into coherent theories and assessing coverage.

Your responsibilities:

1. **CLUSTER HYPOTHESES**
   Group related hypotheses by:
   - shared-mechanism: Common underlying principle
   - complementary-predictions: Different aspects of same phenomenon
   - common-domain-pair: Same source→target transfer
   - related-concepts: Overlapping conceptual basis

   For each cluster:
   - Assign UUID using crypto.randomUUID() format
   - Calculate coherenceScore (0-1) based on mechanism overlap
   - Provide brief summary of unifying theme

2. **COMPOSE INTEGRATED THEORIES**
   For clusters with high coherence (≥0.7):
   - Create IntegratedTheory combining insights
   - Identify unifiedMechanism across hypotheses
   - Generate syntheticPredictions not in individual hypotheses
   - Calculate confidence (0-1) based on constituent hypothesis scores

3. **MAP DEPENDENCIES**
   Identify relationships between hypotheses:
   - prerequisite: Hypothesis A must hold for B to be tested
   - supports: Hypothesis A's validity strengthens B
   - conflicts-with: A and B cannot both be true
   - refines: B is a more specific version of A

   Assign strength (0-1) to each dependency.

4. **ASSESS QUERY COVERAGE**
   Extract requirements from query (conceptual/methodological/empirical/theoretical).
   For each requirement:
   - Identify which hypotheses address it
   - Calculate coverageScore (0-1)
   - List gaps (what's missing)

   Provide overallCoverage and recommendations for future work.

CRITICAL REQUIREMENTS:
- ALL id fields must be valid UUIDs (8-4-4-4-12 hex format)
- ALL scores/confidence values must be 0-1 scale (NOT 1-5)
- ALL domain tags must be valid DomainTag values
- Generate at least 1 cluster if 2+ hypotheses exist
- Generate at least 1 dependency if 2+ hypotheses exist

Respond with ONLY valid JSON matching this structure:
{
  "clusters": [
    {
      "id": "550e8400-e29b-41d4-a716-446655440000",
      "name": "Cluster name",
      "hypothesisIds": ["hyp-001", "hyp-002"],
      "criterion": "shared-mechanism",
      "coherenceScore": 0.85,
      "summary": "Brief description"
    }
  ],
  "integratedTheories": [
    {
      "id": "650e8400-e29b-41d4-a716-446655440000",
      "title": "Theory title",
      "description": "Theory description",
      "hypothesisIds": ["hyp-001", "hyp-002"],
      "sourceDomains": ["ml-ai", "physics-engineering"],
      "targetDomain": "computational-biology",
      "unifiedMechanism": "Mechanism description",
      "syntheticPredictions": ["Prediction 1", "Prediction 2"],
      "confidence": 0.78,
      "suggestedValidation": "Optional validation approach"
    }
  ],
  "dependencies": [
    {
      "id": "750e8400-e29b-41d4-a716-446655440000",
      "sourceHypothesisId": "hyp-001",
      "targetHypothesisId": "hyp-002",
      "type": "prerequisite",
      "explanation": "Why this dependency exists",
      "strength": 0.9
    }
  ],
  "queryCoverage": {
    "requirements": [
      {
        "id": "850e8400-e29b-41d4-a716-446655440000",
        "requirement": "Requirement description",
        "type": "conceptual",
        "priority": "critical"
      }
    ],
    "coverage": [
      {
        "requirementId": "850e8400-e29b-41d4-a716-446655440000",
        "hypothesisIds": ["hyp-001"],
        "coverageScore": 0.7,
        "gaps": ["Gap description"]
      }
    ],
    "overallCoverage": 0.65,
    "recommendations": ["Recommendation 1", "Recommendation 2"]
  },
  "metadata": {
    "totalHypotheses": 5,
    "totalClusters": 2,
    "totalTheories": 1,
    "totalDependencies": 3,
    "averageCoherence": 0.75
  }
}`;
  }

  protected buildUserPrompt(input: IntegrationRequest): string {
    const hypothesesText = input.hypotheses
      .map(
        (h, i) => `
HYPOTHESIS ${i + 1}: ${h.id}
  Title: ${h.title}
  Statement: ${h.statement}
  Source: ${h.sourceDomain} → Target: ${h.targetDomain}
  Score: ${h.scores.composite.toFixed(2)}
  Mechanism: ${h.components.mechanism}
  Prediction: ${h.components.prediction}
`
      )
      .join('\n');

    return `Integrate the following validated hypotheses:

QUERY: ${input.query}
DOMAIN: ${input.domain}

HYPOTHESES:
${hypothesesText}

Perform all four integration tasks:
1. Cluster related hypotheses
2. Compose integrated theories (for high-coherence clusters)
3. Map dependencies between hypotheses
4. Assess coverage of query requirements

Remember:
- Use valid UUID format for all id fields
- Use 0-1 scale for all scores
- Generate at least 1 cluster and 1 dependency if multiple hypotheses exist
- Output ONLY valid JSON`;
  }

  protected parseResponse(response: string): IntegrationResult {
    const json = this.extractJSON(response);
    let parsed = JSON.parse(json);

    // Normalize domain fields before validation
    parsed = normalizeDomainsInObject(parsed, 'other');

    // Normalize enum fields that LLMs commonly vary
    parsed = this.normalizeEnumFields(parsed);

    // Generate UUIDs for any items missing them
    parsed = this.ensureUUIDs(parsed);

    // Validate with Zod schema
    return IntegrationResultSchema.parse(parsed);
  }

  /**
   * Normalize enum fields that LLMs commonly generate outside schema constraints
   */
  private normalizeEnumFields(parsed: Record<string, unknown>): Record<string, unknown> {
    // Normalize dependency types
    if (Array.isArray(parsed.dependencies)) {
      parsed.dependencies = parsed.dependencies.map((dep: Record<string, unknown>) => ({
        ...dep,
        type: this.normalizeDependencyType(dep.type),
      }));
    }

    // Normalize query coverage priority fields
    if (parsed.queryCoverage && typeof parsed.queryCoverage === 'object') {
      const qc = parsed.queryCoverage as Record<string, unknown>;
      if (Array.isArray(qc.requirements)) {
        qc.requirements = qc.requirements.map((req: Record<string, unknown>) => ({
          ...req,
          priority: this.normalizePriority(req.priority),
        }));
      }
    }

    return parsed;
  }

  /**
   * Normalize dependency type to valid enum value
   * Maps common LLM variations to schema-valid values
   */
  private normalizeDependencyType(type: unknown): string {
    if (typeof type !== 'string') return 'supports';

    const typeMap: Record<string, string> = {
      // Exact matches
      'prerequisite': 'prerequisite',
      'supports': 'supports',
      'conflicts-with': 'conflicts-with',
      'refines': 'refines',

      // Common LLM variations → prerequisite
      'requires': 'prerequisite',
      'depends-on': 'prerequisite',
      'depends on': 'prerequisite',
      'needed-for': 'prerequisite',
      'enables': 'prerequisite',
      'precondition': 'prerequisite',

      // Common LLM variations → supports
      'complementary': 'supports',
      'complements': 'supports',
      'reinforces': 'supports',
      'strengthens': 'supports',
      'validates': 'supports',
      'enhances': 'supports',
      'related': 'supports',
      'related-to': 'supports',

      // Common LLM variations → conflicts-with
      'conflicts': 'conflicts-with',
      'contradicts': 'conflicts-with',
      'opposes': 'conflicts-with',
      'incompatible': 'conflicts-with',
      'mutually-exclusive': 'conflicts-with',

      // Common LLM variations → refines
      'extends': 'refines',
      'specializes': 'refines',
      'elaborates': 'refines',
      'narrows': 'refines',
      'specifies': 'refines',
    };

    const normalized = typeMap[type.toLowerCase().trim()];
    return normalized || 'supports'; // Default fallback
  }

  /**
   * Normalize priority to valid enum value
   * Maps common LLM variations to schema-valid values
   */
  private normalizePriority(priority: unknown): string {
    if (typeof priority !== 'string') return 'important';

    const priorityMap: Record<string, string> = {
      // Exact matches
      'critical': 'critical',
      'important': 'important',
      'optional': 'optional',

      // Common LLM variations → critical
      'high': 'critical',
      'essential': 'critical',
      'required': 'critical',
      'must-have': 'critical',
      'mandatory': 'critical',
      'core': 'critical',

      // Common LLM variations → important
      'medium': 'important',
      'significant': 'important',
      'moderate': 'important',
      'should-have': 'important',
      'recommended': 'important',

      // Common LLM variations → optional
      'low': 'optional',
      'nice-to-have': 'optional',
      'bonus': 'optional',
      'minor': 'optional',
      'supplementary': 'optional',
    };

    const normalized = priorityMap[priority.toLowerCase().trim()];
    return normalized || 'important'; // Default fallback
  }

  /**
   * Ensure all id fields are valid UUIDs (generates if missing)
   */
  private ensureUUIDs(parsed: Record<string, unknown>): Record<string, unknown> {
    // Clusters
    if (Array.isArray(parsed.clusters)) {
      parsed.clusters = parsed.clusters.map((cluster: Record<string, unknown>) => ({
        ...cluster,
        id: this.isValidUUID(cluster.id) ? cluster.id : randomUUID(),
      }));
    }

    // Integrated theories
    if (Array.isArray(parsed.integratedTheories)) {
      parsed.integratedTheories = parsed.integratedTheories.map(
        (theory: Record<string, unknown>) => ({
          ...theory,
          id: this.isValidUUID(theory.id) ? theory.id : randomUUID(),
        })
      );
    }

    // Dependencies
    if (Array.isArray(parsed.dependencies)) {
      parsed.dependencies = parsed.dependencies.map((dep: Record<string, unknown>) => ({
        ...dep,
        id: this.isValidUUID(dep.id) ? dep.id : randomUUID(),
      }));
    }

    // Query coverage requirements
    if (parsed.queryCoverage && typeof parsed.queryCoverage === 'object') {
      const qc = parsed.queryCoverage as Record<string, unknown>;
      if (Array.isArray(qc.requirements)) {
        qc.requirements = qc.requirements.map((req: Record<string, unknown>) => ({
          ...req,
          id: this.isValidUUID(req.id) ? req.id : randomUUID(),
        }));
      }

      // Ensure coverage items reference valid requirement IDs
      if (Array.isArray(qc.coverage) && Array.isArray(qc.requirements)) {
        const requirements = qc.requirements as Array<Record<string, unknown>>;
        const validReqIds = new Set(
          requirements.map((r) => r.id as string)
        );
        qc.coverage = qc.coverage.map((cov: Record<string, unknown>) => {
          // If requirementId is invalid, use first requirement's ID
          if (!validReqIds.has(cov.requirementId as string)) {
            cov.requirementId = requirements[0]?.id || randomUUID();
          }
          return cov;
        });
      }
    }

    return parsed;
  }

  /**
   * Check if value is a valid UUID
   */
  private isValidUUID(value: unknown): boolean {
    if (typeof value !== 'string') return false;
    const uuidRegex =
      /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
  }
}
