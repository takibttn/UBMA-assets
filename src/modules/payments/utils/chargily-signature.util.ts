import { createHmac, timingSafeEqual } from 'crypto';

/** Test helper / client signing — same algorithm as Chargily webhook verification. */
export function signChargilyPayload(
  rawBody: string,
  secretKey: string,
): string {
  return createHmac('sha256', secretKey).update(rawBody, 'utf8').digest('hex');
}

export function verifyChargilySignature(args: {
  rawBody: string;
  signature: string;
  secretKey: string;
}): boolean {
  const computed = createHmac('sha256', args.secretKey)
    .update(args.rawBody, 'utf8')
    .digest('hex');
  try {
    const a = Buffer.from(computed, 'utf8');
    const b = Buffer.from(args.signature.trim(), 'utf8');
    if (a.length !== b.length) return false;
    return timingSafeEqual(a, b);
  } catch {
    return false;
  }
}
