"use client";

import { useEffect, useState } from "react";
import type { RuntimeConfig } from "@/lib/domain/api";
import { api } from "./api";

let pending: Promise<RuntimeConfig> | null = null;

/** Fetches the runtime configuration once per page load. */
export function loadRuntimeConfig(): Promise<RuntimeConfig> {
  pending ??= api.config().catch((error) => {
    pending = null;
    throw error;
  });
  return pending;
}

export function useRuntimeConfig(): RuntimeConfig | null {
  const [config, setConfig] = useState<RuntimeConfig | null>(null);
  useEffect(() => {
    let alive = true;
    loadRuntimeConfig()
      .then((value) => alive && setConfig(value))
      .catch(() => undefined);
    return () => {
      alive = false;
    };
  }, []);
  return config;
}
