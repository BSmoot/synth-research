/**
 * Pipeline context management for Synthesis Labs
 */

import { randomUUID } from 'crypto';
import type {
  UserQuery,
  DomainAnalysis,
  CrossDomainConnection,
  Hypothesis,
  ScoredHypothesis,
  StageResult,
  DomainTag,
} from '../types/index.js';

export interface ContextSummary {
  query: string;
  domain: DomainTag;
  keyConceptsCount: number;
  connectionsCount: number;
  hypothesesCount: number;
  topConcepts: string[];
  topConnections: Array<{
    source: string;
    target: string;
    type: string;
  }>;
}

export class PipelineContext {
  public readonly traceId: string;
  public readonly startTime: Date;
  public readonly query: UserQuery;
  public readonly domain: DomainTag;

  private _analysis: DomainAnalysis | null = null;
  private _connections: CrossDomainConnection[] = [];
  private _hypotheses: Hypothesis[] = [];
  private _scoredHypotheses: ScoredHypothesis[] = [];
  private _stages: StageResult[] = [];
  private _warnings: string[] = [];

  constructor(query: UserQuery, domain: DomainTag) {
    this.traceId = randomUUID();
    this.startTime = new Date();
    this.query = query;
    this.domain = domain;
  }

  // ============================================================================
  // Setters
  // ============================================================================

  setAnalysis(analysis: DomainAnalysis): void {
    this._analysis = analysis;
  }

  addConnections(connections: CrossDomainConnection[]): void {
    this._connections.push(...connections);
  }

  addHypotheses(hypotheses: Hypothesis[]): void {
    this._hypotheses.push(...hypotheses);
  }

  setScoredHypotheses(hypotheses: ScoredHypothesis[]): void {
    this._scoredHypotheses = hypotheses;
  }

  addStage(stage: StageResult): void {
    this._stages.push(stage);
  }

  addWarning(warning: string): void {
    this._warnings.push(warning);
  }

  // ============================================================================
  // Getters
  // ============================================================================

  get analysis(): DomainAnalysis | null {
    return this._analysis;
  }

  get connections(): CrossDomainConnection[] {
    return this._connections;
  }

  get hypotheses(): Hypothesis[] {
    return this._hypotheses;
  }

  get scoredHypotheses(): ScoredHypothesis[] {
    return this._scoredHypotheses;
  }

  get stages(): StageResult[] {
    return this._stages;
  }

  get warnings(): string[] {
    return this._warnings;
  }

  get elapsedMs(): number {
    return Date.now() - this.startTime.getTime();
  }

  // ============================================================================
  // Summary for LLM context
  // ============================================================================

  getSummary(): ContextSummary {
    const topConcepts = this._analysis?.concepts
      .slice(0, 10)
      .map((c) => c.name) ?? [];

    const topConnections = this._connections
      .slice(0, 5)
      .map((c) => ({
        source: c.sourceConcept.name,
        target: c.targetConcept.name,
        type: c.connectionType,
      }));

    return {
      query: this.query.text,
      domain: this.domain,
      keyConceptsCount: this._analysis?.concepts.length ?? 0,
      connectionsCount: this._connections.length,
      hypothesesCount: this._hypotheses.length,
      topConcepts,
      topConnections,
    };
  }

  // ============================================================================
  // Logging
  // ============================================================================

  log(message: string): void {
    console.log(`[${this.traceId.slice(0, 8)}] ${message}`);
  }
}
