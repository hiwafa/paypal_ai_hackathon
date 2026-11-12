import "server-only";
import type { ActivityItem } from "@/lib/domain/types";

// In-process pub/sub that feeds the back office's live stream (SSE).
// Kept on globalThis so hot reloads in development don't orphan listeners.

type Listener = (item: ActivityItem) => void;

const globalBus = globalThis as typeof globalThis & { __crewosListeners?: Set<Listener> };

function listeners(): Set<Listener> {
  globalBus.__crewosListeners ??= new Set();
  return globalBus.__crewosListeners;
}

export function subscribe(listener: Listener): () => void {
  listeners().add(listener);
  return () => listeners().delete(listener);
}

export function publish(item: ActivityItem): void {
  for (const listener of listeners()) {
    try {
      listener(item);
    } catch (error) {
      console.error("[events] Listener failed", error);
    }
  }
}
