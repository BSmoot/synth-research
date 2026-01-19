/**
 * Schema versioning for Synthesis Labs trace files
 *
 * ADR-008 Platform Enhancement Suite - Phase 1.2
 * Provides version tracking for schema evolution and compatibility checking.
 */

import { z } from 'zod';

/**
 * Current schema version following semver (major.minor.patch)
 */
export const SCHEMA_VERSION = '1.2.0' as const;

/**
 * Zod schema for validating schema version metadata
 * Enforces strict semver format (X.Y.Z) and ISO 8601 datetime
 */
export const SchemaVersionSchema = z.object({
  schemaVersion: z.string().regex(/^\d+\.\d+\.\d+$/),
  createdAt: z.string().datetime(),
});

/**
 * Type inferred from SchemaVersionSchema
 */
export type SchemaVersion = z.infer<typeof SchemaVersionSchema>;

/**
 * Check if a given version string is compatible with the current schema version
 * Compatible means same major version number (semver compatibility)
 *
 * @param version - Version string in semver format (X.Y.Z)
 * @returns true if major versions match, false otherwise
 */
export function isCompatibleSchema(version: string): boolean {
  const [major] = version.split('.').map(Number);
  const [currentMajor] = SCHEMA_VERSION.split('.').map(Number);
  return major === currentMajor;
}
