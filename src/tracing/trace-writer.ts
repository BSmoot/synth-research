/**
 * Atomic trace file writer for Synthesis Labs
 */

import { promises as fs } from 'fs';
import { resolve } from 'path';
import { randomUUID } from 'crypto';
import type { TraceEntry, TraceMetadata } from '../types/trace.js';

export class TraceWriter {
  private readonly traceDir: string;

  constructor(traceDir: string) {
    // Use path.resolve() for all paths
    this.traceDir = resolve(traceDir);
  }

  /**
   * Write trace metadata and entries to disk
   */
  async writeTrace(
    traceId: string,
    metadata: TraceMetadata,
    entries: TraceEntry[]
  ): Promise<void> {
    // Create trace directory: {traceDir}/{traceId}/
    const tracePath = resolve(this.traceDir, traceId);
    await fs.mkdir(tracePath, { recursive: true });

    // Write metadata.json
    await this.atomicWrite(
      resolve(tracePath, 'metadata.json'),
      JSON.stringify(metadata, null, 2)
    );

    // Write stage files: stage-{N}-{agent}.json
    for (let i = 0; i < entries.length; i++) {
      const entry = entries[i];
      const filename = `stage-${i + 1}-${this.sanitizeFilename(entry.agent)}.json`;
      await this.atomicWrite(
        resolve(tracePath, filename),
        JSON.stringify(entry, null, 2)
      );
    }
  }

  /**
   * Atomic file write: temp file + rename
   */
  private async atomicWrite(filePath: string, content: string): Promise<void> {
    // Create temp file with random UUID
    const tempPath = `${filePath}.tmp.${randomUUID()}`;

    try {
      // Write to temp file
      await fs.writeFile(tempPath, content, 'utf8');

      // Atomic rename
      await fs.rename(tempPath, filePath);
    } catch (error) {
      // Cleanup temp file on error
      try {
        await fs.unlink(tempPath);
      } catch {
        // Ignore cleanup errors
      }
      throw error;
    }
  }

  /**
   * Sanitize filename for cross-platform compatibility
   */
  private sanitizeFilename(name: string): string {
    return name.replace(/[^a-zA-Z0-9-_]/g, '-').toLowerCase();
  }
}
