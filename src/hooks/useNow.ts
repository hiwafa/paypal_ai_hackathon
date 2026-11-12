"use client";

import { useSyncExternalStore } from "react";

// A shared clock for relative times such as "4 min ago". It ticks once a
// minute while something is listening and reads 0 while prerendering, so the
// server never bakes a stale "now" into the page.

const TICK_MS = 60_000;
const listeners = new Set<() => void>();
let now = 0;
let timer: number | undefined;

function subscribe(listener: () => void) {
  listeners.add(listener);
  if (listeners.size === 1) {
    now = Date.now();
    timer = window.setInterval(() => {
      now = Date.now();
      listeners.forEach((notify) => notify());
    }, TICK_MS);
  }
  return () => {
    listeners.delete(listener);
    if (listeners.size === 0) window.clearInterval(timer);
  };
}

const read = () => now;
const prerender = () => 0;

/** Milliseconds since the epoch, refreshed every minute; 0 until mounted. */
export function useNow(): number {
  return useSyncExternalStore(subscribe, read, prerender);
}
