import type { ReactNode } from "react";
import type { RuntimeConfig } from "@/lib/domain/api";

/** "claude-opus-5-5" → "Opus 5.5"; anything unexpected is shown as is. */
export function modelLabel(model: string | null): string {
  if (!model) return "Claude";
  const match = /^claude-([a-z]+)-(\d+)(?:-(\d+))?/.exec(model);
  if (!match) return model;
  const family = match[1][0].toUpperCase() + match[1].slice(1);
  return `${family} ${match[2]}${match[3] ? `.${match[3]}` : ""}`;
}

function Badge({ tone, title, children }: { tone: string; title: string; children: ReactNode }) {
  return (
    <span
      title={title}
      className="inline-flex items-center gap-1.5 rounded-full border border-white/10 bg-white/[0.04] px-2.5 py-1 text-[11px] font-medium text-white/75"
    >
      <span className="size-1.5 rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
      {children}
    </span>
  );
}

/** Shows at a glance whether real PayPal and Claude are wired in. */
export function ModeBadges({ config, className = "" }: { config: RuntimeConfig | null; className?: string }) {
  if (!config) return <span className={`h-6 w-48 animate-pulse rounded-full bg-white/5 ${className}`} />;
  const sandbox = config.paypal.mode === "sandbox";
  const claude = config.ai.mode === "claude";
  return (
    <span className={`items-center gap-1.5 ${className}`}>
      <Badge
        tone={sandbox ? "#7cb7ff" : "#fcd34d"}
        title={
          sandbox
            ? "Live PayPal sandbox: Orders v2, Payouts, Refunds and webhooks."
            : "No PayPal keys set, so a local simulator runs the same flows."
        }
      >
        {sandbox ? "PayPal sandbox" : "PayPal simulator"}
      </Badge>
      <Badge
        tone={claude ? "#5eead4" : "#9ca3af"}
        title={
          claude
            ? "Claude writes the words and proposes actions; code enforces prices and policy."
            : "No Anthropic key set, so a rule-based brain stands in."
        }
      >
        {claude ? `Claude ${modelLabel(config.ai.model)}` : "Offline brain"}
      </Badge>
    </span>
  );
}
