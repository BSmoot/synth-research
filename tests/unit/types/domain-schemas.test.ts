/**
 * Unit tests for Domain Schema Enhancements
 * TDD Phase: RED - Tests written before implementation
 */

import { describe, it, expect } from 'vitest';
import {
  DomainTagSchema,
  DomainTag,
  SUPPORTED_DOMAINS,
  DOMAIN_METADATA,
  DOMAIN_ALIASES,
  normalizeDomain,
} from '../../../src/types/domains.js';

describe('Domain Schema Enhancements (ADR-009)', () => {
  describe('DomainTagSchema - New Domain Enums', () => {
    it('should accept "mathematics" as valid domain tag', () => {
      const result = DomainTagSchema.safeParse('mathematics');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('mathematics');
      }
    });

    it('should accept "law-governance" as valid domain tag', () => {
      const result = DomainTagSchema.safeParse('law-governance');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('law-governance');
      }
    });

    it('should accept "anthropology-history" as valid domain tag', () => {
      const result = DomainTagSchema.safeParse('anthropology-history');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('anthropology-history');
      }
    });

    it('should accept "philosophy-ethics" as valid domain tag', () => {
      const result = DomainTagSchema.safeParse('philosophy-ethics');
      expect(result.success).toBe(true);
      if (result.success) {
        expect(result.data).toBe('philosophy-ethics');
      }
    });
  });

  describe('SUPPORTED_DOMAINS - Domain List', () => {
    it('should include all four new domains in SUPPORTED_DOMAINS array', () => {
      expect(SUPPORTED_DOMAINS).toContain('mathematics');
      expect(SUPPORTED_DOMAINS).toContain('law-governance');
      expect(SUPPORTED_DOMAINS).toContain('anthropology-history');
      expect(SUPPORTED_DOMAINS).toContain('philosophy-ethics');
    });

    it('should have exactly 15 total domains (11 existing + 4 new)', () => {
      expect(SUPPORTED_DOMAINS).toHaveLength(15);
    });

    it('should still include all original 11 domains', () => {
      const originalDomains: DomainTag[] = [
        'computational-biology',
        'materials-science',
        'ml-ai',
        'economics-finance',
        'social-systems',
        'physics-engineering',
        'climate-environment',
        'healthcare-medicine',
        'cognitive-science',
        'information-systems',
        'other',
      ];

      originalDomains.forEach((domain) => {
        expect(SUPPORTED_DOMAINS).toContain(domain);
      });
    });
  });

  describe('DOMAIN_METADATA - New Domain Metadata', () => {
    it('should have metadata entry for mathematics domain', () => {
      expect(DOMAIN_METADATA['mathematics']).toBeDefined();
      const metadata = DOMAIN_METADATA['mathematics'];

      expect(metadata.tag).toBe('mathematics');
      expect(metadata.name).toBe('Mathematics');
      expect(metadata.description).toBeDefined();
      expect(Array.isArray(metadata.subDomains)).toBe(true);
      expect(metadata.subDomains).toContain('game-theory');
      expect(Array.isArray(metadata.keyJournals)).toBe(true);
      expect(Array.isArray(metadata.majorConferences)).toBe(true);
    });

    it('should have metadata entry for law-governance domain', () => {
      expect(DOMAIN_METADATA['law-governance']).toBeDefined();
      const metadata = DOMAIN_METADATA['law-governance'];

      expect(metadata.tag).toBe('law-governance');
      expect(metadata.name).toBe('Law and Governance');
      expect(metadata.description).toBeDefined();
      expect(Array.isArray(metadata.subDomains)).toBe(true);
      expect(metadata.subDomains).toContain('contract-theory');
    });

    it('should have metadata entry for anthropology-history domain', () => {
      expect(DOMAIN_METADATA['anthropology-history']).toBeDefined();
      const metadata = DOMAIN_METADATA['anthropology-history'];

      expect(metadata.tag).toBe('anthropology-history');
      expect(metadata.name).toBe('Anthropology and History');
      expect(metadata.description).toBeDefined();
      expect(Array.isArray(metadata.subDomains)).toBe(true);
      expect(metadata.subDomains).toContain('cultural-anthropology');
    });

    it('should have metadata entry for philosophy-ethics domain', () => {
      expect(DOMAIN_METADATA['philosophy-ethics']).toBeDefined();
      const metadata = DOMAIN_METADATA['philosophy-ethics'];

      expect(metadata.tag).toBe('philosophy-ethics');
      expect(metadata.name).toBe('Philosophy and Ethics');
      expect(metadata.description).toBeDefined();
      expect(Array.isArray(metadata.subDomains)).toBe(true);
      expect(metadata.subDomains).toContain('decision-theory');
      expect(metadata.subDomains).toContain('ethics');
    });
  });

  describe('DOMAIN_ALIASES - New Domain Aliases', () => {
    it('should map "math" alias to mathematics domain', () => {
      expect(DOMAIN_ALIASES['math']).toBe('mathematics');
    });

    it('should map "maths" alias to mathematics domain', () => {
      expect(DOMAIN_ALIASES['maths']).toBe('mathematics');
    });

    it('should map "law" alias to law-governance domain', () => {
      expect(DOMAIN_ALIASES['law']).toBe('law-governance');
    });

    it('should map "governance" alias to law-governance domain (MIGRATION)', () => {
      expect(DOMAIN_ALIASES['governance']).toBe('law-governance');
    });

    it('should map "anthropology" alias to anthropology-history domain', () => {
      expect(DOMAIN_ALIASES['anthropology']).toBe('anthropology-history');
    });

    it('should map "history" alias to anthropology-history domain', () => {
      expect(DOMAIN_ALIASES['history']).toBe('anthropology-history');
    });

    it('should map "philosophy" alias to philosophy-ethics domain', () => {
      expect(DOMAIN_ALIASES['philosophy']).toBe('philosophy-ethics');
    });

    it('should map "ethics" alias to philosophy-ethics domain', () => {
      expect(DOMAIN_ALIASES['ethics']).toBe('philosophy-ethics');
    });

    it('should map "decision-theory" alias to philosophy-ethics domain', () => {
      expect(DOMAIN_ALIASES['decision-theory']).toBe('philosophy-ethics');
    });
  });

  describe('normalizeDomain() - New Domain Alias Normalization', () => {
    it('should normalize "math" to mathematics domain', () => {
      const result = normalizeDomain('math', 'other');
      expect(result).toBe('mathematics');
    });

    it('should normalize "MATH" (uppercase) to mathematics domain', () => {
      const result = normalizeDomain('MATH', 'other');
      expect(result).toBe('mathematics');
    });

    it('should normalize "governance" to law-governance domain (MIGRATION)', () => {
      const result = normalizeDomain('governance', 'other');
      expect(result).toBe('law-governance');
    });

    it('should normalize "philosophy" to philosophy-ethics domain', () => {
      const result = normalizeDomain('philosophy', 'other');
      expect(result).toBe('philosophy-ethics');
    });

    it('should normalize "ethics" to philosophy-ethics domain', () => {
      const result = normalizeDomain('ethics', 'other');
      expect(result).toBe('philosophy-ethics');
    });

    it('should normalize "decision-theory" to philosophy-ethics domain', () => {
      const result = normalizeDomain('decision-theory', 'other');
      expect(result).toBe('philosophy-ethics');
    });
  });
});
