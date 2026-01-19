/**
 * LLM-Powered Domain Classification
 *
 * ADR-008 Phase 2.1: Replace keyword matching with Claude-powered classification
 * for ambiguous queries while preserving fast keyword matching for clear cases.
 *
 * Features:
 * - Keyword-based scoring for high-confidence queries
 * - LLM fallback for ambiguous cases
 * - Configurable ambiguity threshold
 * - Domain normalization integration
 */

import Anthropic from '@anthropic-ai/sdk';
import { DomainTag, SUPPORTED_DOMAINS, normalizeDomain } from '../types/index.js';
import { logger } from '../logging/logger.js';

export interface ClassificationResult {
  domain: DomainTag;
  confidence: number;
  reasoning: string;
  alternatives: Array<{ domain: DomainTag; confidence: number }>;
  usedLLM: boolean;
}

export interface DomainClassifierOptions {
  ambiguityThreshold?: number;
}

// Keyword weights for each domain
const DOMAIN_KEYWORDS: Record<DomainTag, { keywords: string[]; weight: number }[]> = {
  'ml-ai': [
    { keywords: ['neural network', 'deep learning', 'machine learning'], weight: 0.4 },
    { keywords: ['ai', 'artificial intelligence', 'model', 'training'], weight: 0.3 },
    { keywords: ['transformer', 'gpt', 'llm', 'embedding', 'classifier'], weight: 0.35 },
    { keywords: ['reinforcement learning', 'supervised', 'unsupervised'], weight: 0.35 },
    { keywords: ['gradient', 'backpropagation', 'optimization'], weight: 0.25 },
  ],
  'computational-biology': [
    { keywords: ['gene', 'genome', 'genomic', 'genetic'], weight: 0.4 },
    { keywords: ['protein', 'dna', 'rna', 'crispr'], weight: 0.4 },
    { keywords: ['cell', 'cellular', 'molecular', 'biology'], weight: 0.3 },
    { keywords: ['drug', 'pharmaceutical', 'biomarker'], weight: 0.3 },
    { keywords: ['sequencing', 'mutation', 'expression'], weight: 0.35 },
  ],
  'materials-science': [
    { keywords: ['material', 'materials', 'alloy', 'alloys'], weight: 0.4 },
    { keywords: ['polymer', 'ceramic', 'composite'], weight: 0.35 },
    { keywords: ['nano', 'nanoparticle', 'nanoscale'], weight: 0.35 },
    { keywords: ['semiconductor', 'superconductor'], weight: 0.4 },
    { keywords: ['crystal', 'lattice', 'metallurgy'], weight: 0.3 },
  ],
  'economics-finance': [
    { keywords: ['economy', 'economic', 'economics'], weight: 0.4 },
    { keywords: ['market', 'financial', 'finance'], weight: 0.35 },
    { keywords: ['trade', 'investment', 'portfolio'], weight: 0.35 },
    { keywords: ['monetary', 'fiscal', 'inflation'], weight: 0.35 },
    { keywords: ['stock', 'bond', 'derivative'], weight: 0.3 },
  ],
  'social-systems': [
    { keywords: ['social', 'society', 'societal'], weight: 0.35 },
    { keywords: ['community', 'governance', 'institution'], weight: 0.3 },
    { keywords: ['culture', 'cultural', 'political'], weight: 0.3 },
    { keywords: ['democracy', 'policy', 'citizen'], weight: 0.25 },
  ],
  'physics-engineering': [
    { keywords: ['physics', 'quantum', 'thermodynamic'], weight: 0.4 },
    { keywords: ['mechanical', 'electrical', 'engineering'], weight: 0.35 },
    { keywords: ['energy', 'force', 'momentum'], weight: 0.3 },
    { keywords: ['electromagnetic', 'optics', 'acoustics'], weight: 0.3 },
  ],
  'climate-environment': [
    { keywords: ['climate', 'environmental', 'environment'], weight: 0.4 },
    { keywords: ['weather', 'carbon', 'emission'], weight: 0.35 },
    { keywords: ['ecosystem', 'biodiversity', 'conservation'], weight: 0.35 },
    { keywords: ['pollution', 'renewable', 'sustainability'], weight: 0.3 },
  ],
  'healthcare-medicine': [
    { keywords: ['patient', 'treatment', 'therapy'], weight: 0.4 },
    { keywords: ['disease', 'diagnosis', 'clinical'], weight: 0.4 },
    { keywords: ['hospital', 'healthcare', 'medical'], weight: 0.35 },
    { keywords: ['surgery', 'physician', 'symptom'], weight: 0.3 },
  ],
  'cognitive-science': [
    { keywords: ['brain', 'cognition', 'cognitive'], weight: 0.4 },
    { keywords: ['perception', 'memory', 'attention'], weight: 0.35 },
    { keywords: ['consciousness', 'behavior', 'psychology'], weight: 0.35 },
    { keywords: ['neuroscience', 'neural', 'mental'], weight: 0.3 },
  ],
  'information-systems': [
    { keywords: ['database', 'software', 'system'], weight: 0.3 },
    { keywords: ['cyber', 'security', 'network'], weight: 0.3 },
    { keywords: ['algorithm', 'server', 'cloud'], weight: 0.25 },
    { keywords: ['api', 'infrastructure', 'distributed'], weight: 0.25 },
  ],
  other: [{ keywords: [], weight: 0 }],
};

export class DomainClassifier {
  private readonly client: Anthropic;
  private readonly ambiguityThreshold: number;

  constructor(client: Anthropic, options: DomainClassifierOptions = {}) {
    this.client = client;
    this.ambiguityThreshold = options.ambiguityThreshold ?? 0.7;
  }

  async classify(query: string): Promise<ClassificationResult> {
    const keywordResult = this.classifyByKeywords(query);

    if (keywordResult.confidence >= this.ambiguityThreshold) {
      return { ...keywordResult, usedLLM: false };
    }

    logger.info('Using LLM for ambiguous domain classification', {
      query: query.slice(0, 100),
      keywordConfidence: keywordResult.confidence,
    });

    try {
      return await this.classifyByLLM(query, keywordResult);
    } catch (error) {
      logger.warn('LLM classification failed, using keyword result', {
        error: error instanceof Error ? error.message : String(error),
      });
      // Fall back to keyword result on error
      return { ...keywordResult, usedLLM: false };
    }
  }

  private classifyByKeywords(query: string): Omit<ClassificationResult, 'usedLLM'> {
    const lowerQuery = query.toLowerCase();
    const scores: Array<{ domain: DomainTag; score: number }> = [];

    for (const domain of SUPPORTED_DOMAINS) {
      if (domain === 'other') continue;

      const keywordGroups = DOMAIN_KEYWORDS[domain];
      let domainScore = 0;
      let matchCount = 0;

      for (const group of keywordGroups) {
        for (const keyword of group.keywords) {
          if (lowerQuery.includes(keyword)) {
            domainScore += group.weight;
            matchCount++;
          }
        }
      }

      // Boost score for multiple matches (diminishing returns)
      if (matchCount > 1) {
        domainScore *= 1 + Math.log2(matchCount) * 0.1;
      }

      // Normalize score to 0-1 range (cap at 1.0)
      const normalizedScore = Math.min(1.0, domainScore);
      scores.push({ domain, score: normalizedScore });
    }

    // Sort by score descending
    const sorted = scores.sort((a, b) => b.score - a.score);
    const top = sorted[0] || { domain: 'other' as DomainTag, score: 0.3 };

    // If top score is 0, return 'other'
    if (top.score === 0) {
      return {
        domain: 'other',
        confidence: 0.3,
        reasoning: 'No keyword matches found',
        alternatives: [],
      };
    }

    return {
      domain: top.domain,
      confidence: top.score,
      reasoning: 'Keyword-based classification',
      alternatives: sorted.slice(1, 4).map((s) => ({
        domain: s.domain,
        confidence: s.score,
      })),
    };
  }

  private async classifyByLLM(
    query: string,
    keywordHint: Omit<ClassificationResult, 'usedLLM'>
  ): Promise<ClassificationResult> {
    const systemPrompt = `You are a domain classifier for research queries.
Classify into exactly one of: ${SUPPORTED_DOMAINS.join(', ')}

Respond with JSON only:
{"domain": "exact-domain-tag", "confidence": 0.0-1.0, "reasoning": "brief explanation"}`;

    const response = await this.client.messages.create({
      model: 'claude-sonnet-4-20250514',
      max_tokens: 256,
      temperature: 0,
      system: systemPrompt,
      messages: [{ role: 'user', content: `Classify this research query: "${query}"` }],
    });

    const text = response.content[0].type === 'text' ? response.content[0].text : '';

    try {
      const parsed = JSON.parse(text);
      const normalizedDomain = normalizeDomain(parsed.domain, 'other');

      return {
        domain: normalizedDomain,
        confidence: typeof parsed.confidence === 'number' ? parsed.confidence : 0.7,
        reasoning: parsed.reasoning || 'LLM classification',
        alternatives: keywordHint.alternatives,
        usedLLM: true,
      };
    } catch {
      // JSON parsing failed, fall back to keyword result
      logger.warn('Failed to parse LLM response', { text: text.slice(0, 200) });
      return { ...keywordHint, usedLLM: false };
    }
  }
}
