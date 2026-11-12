import "server-only";
import { randomBytes, randomUUID } from "node:crypto";

export function newId(): string {
  return randomUUID();
}

const ALPHABET = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";

/** IDs for simulated PayPal objects. The SIM- prefix keeps them unmistakable. */
export function simulatedId(): string {
  const bytes = randomBytes(13);
  let out = "SIM-";
  for (const byte of bytes) out += ALPHABET[byte % ALPHABET.length];
  return out;
}
