import "server-only";
import { HttpError } from "./http";

// Sliding-window limiter for the endpoints that cost money (AI calls) or move
// money. In-memory is fine for a single instance; it resets on restart.

const globalLimits = globalThis as typeof globalThis & { __crewosHits?: Map<string, number[]> };

function hits(): Map<string, number[]> {
  globalLimits.__crewosHits ??= new Map();
  return globalLimits.__crewosHits;
}

export function clientKey(request: Request): string {
  const forwarded = request.headers.get("x-forwarded-for");
  const ip = forwarded?.split(",")[0]?.trim() || request.headers.get("x-real-ip") || "local";
  return ip;
}

/** Throws a 429 when `key` has made `limit` calls within the last `windowMs`. */
export function enforceRateLimit(request: Request, bucket: string, limit: number, windowMs = 60_000) {
  const key = `${bucket}:${clientKey(request)}`;
  const now = Date.now();
  const recent = (hits().get(key) ?? []).filter((t) => now - t < windowMs);
  if (recent.length >= limit) {
    const retryAfter = Math.ceil((windowMs - (now - recent[0])) / 1000);
    throw new HttpError(429, `Too many requests. Try again in ${retryAfter}s.`);
  }
  recent.push(now);
  hits().set(key, recent);

  // Opportunistic cleanup so the map can't grow without bound.
  if (hits().size > 5000) {
    for (const [k, times] of hits()) {
      if (times.every((t) => now - t >= windowMs)) hits().delete(k);
    }
  }
}
