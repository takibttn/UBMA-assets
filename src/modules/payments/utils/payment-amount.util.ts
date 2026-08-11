import { BadRequestException } from '@nestjs/common';

function toPlainString(value: unknown): string {
  if (typeof value === 'string') return value;
  if (
    typeof value === 'number' ||
    typeof value === 'bigint' ||
    typeof value === 'boolean'
  ) {
    return String(value);
  }
  return JSON.stringify(value);
}

/**
 * Integer DZD amount for Chargily direct amount mode.
 * Returns null when formation is free (no payment).
 */
export function formationPriceToMinorDzd(price: unknown): number | null {
  const s = price == null || price === '' ? '0' : toPlainString(price).trim();
  const n = Number(s);
  if (!Number.isFinite(n)) {
    throw new BadRequestException('Prix de formation invalide');
  }
  if (n < 0) {
    throw new BadRequestException('Le prix ne peut pas être négatif');
  }
  if (n === 0) return null;
  return Math.round(n);
}

export function minorDzdToDecimalString(minor: number): string {
  return minor.toFixed(2);
}

export function isFormationFree(price: unknown): boolean {
  const s = price == null || price === '' ? '0' : toPlainString(price).trim();
  const n = Number(s);
  return Number.isFinite(n) && n <= 0;
}
