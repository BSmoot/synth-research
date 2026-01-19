/**
 * Hypothesis Deduplication
 *
 * ADR-008 Phase 2.2: Embedding-based similarity detection across runs.
 *
 * Features:
 * - Hash-based pseudo-embedding generation (placeholder for real embeddings)
 * - Cosine similarity calculation
 * - Configurable similarity threshold
 * - FIFO eviction for storage limits
 */

import { Hypothesis } from '../types/index.js';

export interface HypothesisEmbedding {
  hypothesisId: string;
  embedding: number[];
  statement: string;
  createdAt: string;
}

export interface DeduplicationResult {
  unique: Hypothesis[];
  duplicates: Array<{
    hypothesis: Hypothesis;
    similarTo: string;
    similarity: number;
  }>;
}

export interface HypothesisDeduplicatorOptions {
  similarityThreshold?: number;
  maxStoredEmbeddings?: number;
}

export class HypothesisDeduplicator {
  private readonly similarityThreshold: number;
  private readonly maxStoredEmbeddings: number;
  private embeddings: HypothesisEmbedding[] = [];

  constructor(options: HypothesisDeduplicatorOptions = {}) {
    this.similarityThreshold = options.similarityThreshold ?? 0.85;
    this.maxStoredEmbeddings = options.maxStoredEmbeddings ?? 10000;
  }

  async deduplicate(hypotheses: Hypothesis[]): Promise<DeduplicationResult> {
    const unique: Hypothesis[] = [];
    const duplicates: Array<{
      hypothesis: Hypothesis;
      similarTo: string;
      similarity: number;
    }> = [];

    for (const hypothesis of hypotheses) {
      const embedding = this.generateEmbedding(hypothesis.statement);
      const similar = this.findMostSimilar(embedding);

      if (similar && similar.similarity >= this.similarityThreshold) {
        duplicates.push({
          hypothesis,
          similarTo: similar.hypothesisId,
          similarity: similar.similarity,
        });
      } else {
        unique.push(hypothesis);
        this.storeEmbedding({
          hypothesisId: hypothesis.id,
          embedding,
          statement: hypothesis.statement,
          createdAt: new Date().toISOString(),
        });
      }
    }

    return { unique, duplicates };
  }

  /**
   * Generate a pseudo-embedding using hash-based approach.
   * This is a placeholder - replace with real embedding API when available.
   */
  private generateEmbedding(text: string): number[] {
    const normalized = text.toLowerCase().trim();
    const hash = this.simpleHash(normalized);

    // Generate deterministic pseudo-embedding
    const embeddingSize = 256;
    const embedding: number[] = new Array(embeddingSize);

    for (let i = 0; i < embeddingSize; i++) {
      embedding[i] = Math.sin(hash * (i + 1) * 0.01);
    }

    // Add word-based features for better similarity detection
    const words = normalized.split(/\s+/);
    for (let i = 0; i < words.length && i < embeddingSize; i++) {
      const wordHash = this.simpleHash(words[i]);
      embedding[(wordHash >>> 0) % embeddingSize] += 0.5;
    }

    // Normalize the embedding
    return this.normalizeVector(embedding);
  }

  private simpleHash(text: string): number {
    let hash = 0;
    for (let i = 0; i < text.length; i++) {
      hash = (hash << 5) - hash + text.charCodeAt(i);
      hash |= 0;
    }
    return hash;
  }

  private normalizeVector(v: number[]): number[] {
    const magnitude = Math.sqrt(v.reduce((sum, x) => sum + x * x, 0));
    if (magnitude === 0) return v;
    return v.map((x) => x / magnitude);
  }

  private findMostSimilar(
    embedding: number[]
  ): { hypothesisId: string; similarity: number } | null {
    let best: { hypothesisId: string; similarity: number } | null = null;

    for (const stored of this.embeddings) {
      const similarity = this.cosineSimilarity(embedding, stored.embedding);
      if (!best || similarity > best.similarity) {
        best = { hypothesisId: stored.hypothesisId, similarity };
      }
    }

    return best;
  }

  private storeEmbedding(entry: HypothesisEmbedding): void {
    this.embeddings.push(entry);

    // FIFO eviction
    while (this.embeddings.length > this.maxStoredEmbeddings) {
      this.embeddings.shift();
    }
  }

  private cosineSimilarity(a: number[], b: number[]): number {
    if (a.length !== b.length) return 0;

    let dot = 0;
    let magA = 0;
    let magB = 0;

    for (let i = 0; i < a.length; i++) {
      dot += a[i] * b[i];
      magA += a[i] * a[i];
      magB += b[i] * b[i];
    }

    const denominator = Math.sqrt(magA) * Math.sqrt(magB);
    return denominator === 0 ? 0 : dot / denominator;
  }
}
