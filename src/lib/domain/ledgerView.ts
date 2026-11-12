import { dayKey } from "./kpis";
import { formatMoney } from "./money";
import type { LedgerEntry, LedgerKind, RobotId } from "./types";

// A way of looking at the ledger, such as "this week's refunds". The crew
// builds one from the owner's words, the grid applies it as a filter, and the
// server uses the same matcher to say what is on screen. One definition keeps
// "what Penny says" and "what the table shows" from ever drifting apart.

export interface LedgerView {
  /** Short label shown above the grid, e.g. "Refunds · last 7 days". */
  title: string;
  /** Empty means every kind. */
  kinds: LedgerKind[];
  /** Empty means every robot. */
  handledBy: RobotId[];
  /** Calendar days including today (1 = today); null means all time. */
  days: number | null;
  /** Minimum absolute amount; null means any amount. */
  minAmountCents: number | null;
  /** Free text matched against description, counterparty, reference and order number. */
  search: string;
}

const KIND_LABELS: Record<LedgerKind, string> = { sale: "Sales", refund: "Refunds", payout: "Payouts" };

/** Clamps and tidies a view that came from a model or a parser. */
export function normalizeView(input: Partial<LedgerView>): LedgerView {
  const unique = <T>(items: T[] | undefined) => [...new Set(items ?? [])];
  const days = input.days && Number.isFinite(input.days) ? Math.min(366, Math.max(1, Math.round(input.days))) : null;
  const min =
    input.minAmountCents && Number.isFinite(input.minAmountCents) && input.minAmountCents > 0
      ? Math.round(input.minAmountCents)
      : null;
  const view: LedgerView = {
    title: "",
    kinds: unique(input.kinds),
    handledBy: unique(input.handledBy),
    days,
    minAmountCents: min,
    search: (input.search ?? "").trim().slice(0, 60),
  };
  view.title = (input.title ?? "").trim().slice(0, 60) || describeView(view);
  return view;
}

/** A readable title built from the filters, used when none was given. */
export function describeView(view: Omit<LedgerView, "title">): string {
  const what = view.kinds.length ? view.kinds.map((kind) => KIND_LABELS[kind]).join(" & ") : "All entries";
  const parts = [what];
  if (view.minAmountCents) parts[0] += ` over ${formatMoney(view.minAmountCents)}`;
  if (view.search) parts.push(`“${view.search}”`);
  if (view.days === 1) parts.push("today");
  else if (view.days) parts.push(`last ${view.days} days`);
  return parts.join(" · ");
}

/** Builds a fast predicate for one view. Day boundaries follow the owner's time zone. */
export function viewMatcher(view: LedgerView, now: Date, timeZone: string): (entry: LedgerEntry) => boolean {
  const days = view.days
    ? new Set(Array.from({ length: view.days }, (_, i) => dayKey(new Date(now.getTime() - i * 86_400_000), timeZone)))
    : null;
  const needle = view.search.toLowerCase();
  return (entry) =>
    (view.kinds.length === 0 || view.kinds.includes(entry.kind)) &&
    (view.handledBy.length === 0 || view.handledBy.includes(entry.handledBy)) &&
    (days === null || days.has(dayKey(entry.at, timeZone))) &&
    (view.minAmountCents === null || Math.abs(entry.amountCents) >= view.minAmountCents) &&
    (!needle ||
      [entry.description, entry.counterparty, entry.reference, entry.orderNumber ?? ""].some((field) =>
        field.toLowerCase().includes(needle),
      ));
}

export interface ViewSummary {
  count: number;
  /** Signed sum of the matching entries that didn't fail (money in minus money out). */
  totalCents: number;
}

export function summarizeView(
  entries: readonly LedgerEntry[],
  view: LedgerView,
  now: Date,
  timeZone: string,
): ViewSummary {
  const matches = entries.filter(viewMatcher(view, now, timeZone));
  const totalCents = matches.reduce((sum, entry) => (entry.status === "failed" ? sum : sum + entry.amountCents), 0);
  return { count: matches.length, totalCents };
}
