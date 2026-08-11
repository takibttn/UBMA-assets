import type { Database } from '@/database/database.types';
import { emptyCounters, SeedCounters } from './types';

export type AcademicSeedContext = {
  db: Database;
  hashedPassword: string;
  counters: SeedCounters;
};

export function createAcademicSeedContext(
  db: Database,
  hashedPassword: string,
): AcademicSeedContext {
  return {
    db,
    hashedPassword,
    counters: emptyCounters(),
  };
}

export function addDays(d: Date, days: number): Date {
  const out = new Date(d);
  out.setUTCDate(out.getUTCDate() + days);
  return out;
}

export function addHours(d: Date, hours: number): Date {
  const o = new Date(d);
  o.setUTCHours(o.getUTCHours() + hours);
  return o;
}

export function buildCertificateNumber(enrollmentId: string): string {
  return `CEIL-CERT-${enrollmentId.replace(/-/g, '').slice(0, 12).toUpperCase()}`;
}

export function buildVerificationCode(enrollmentId: string): string {
  const normalized = enrollmentId.replace(/-/g, '').toLowerCase();
  return `${normalized}${normalized}`.slice(0, 64);
}
