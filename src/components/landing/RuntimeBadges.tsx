"use client";

import { ModeBadges } from "@/components/ui/ModeBadges";
import { useRuntimeConfig } from "@/lib/client/config";

/** Shows whether this deployment runs real PayPal sandbox and Claude, or the offline stand-ins. */
export function RuntimeBadges({ className = "" }: { className?: string }) {
  const config = useRuntimeConfig();
  return <ModeBadges config={config} className={`inline-flex flex-wrap ${className}`} />;
}
