"use client";

import { Check, Loader2, Mic, MousePointerClick, ShieldCheck, X } from "lucide-react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { useNow } from "@/hooks/useNow";
import { decide, sayToCrew } from "@/lib/client/office";
import { useOffice } from "@/lib/client/officeStore";
import { timeAgo } from "@/lib/client/time";
import { formatMoney } from "@/lib/domain/money";
import { ROBOTS } from "@/lib/domain/robots";
import type { Approval, SupplierBill } from "@/lib/domain/types";

/** The only door money leaves through: robots prepare, Maryam decides. */
export function ApprovalsTray() {
  const approvals = useOffice((s) => s.state?.approvals);
  const bills = useOffice((s) => s.state?.bills);
  const error = useOffice((s) => s.approvalError);

  const pending = approvals?.filter((a) => a.status === "pending") ?? [];
  const decided = approvals?.filter((a) => a.status !== "pending").slice(0, 3) ?? [];
  const openBills = bills?.filter((b) => b.status !== "paid") ?? [];

  return (
    <section aria-labelledby="approvals-title" className="glass rounded-[26px] p-4">
      <header className="flex items-center gap-2">
        <h2 id="approvals-title" className="text-[13px] font-semibold text-white">
          Waiting for you
        </h2>
        {pending.length > 0 && (
          <span className="grid min-w-5 place-items-center rounded-full bg-owner px-1.5 text-[11px] font-semibold text-ink-950">
            {pending.length}
          </span>
        )}
        <span className="ml-auto inline-flex items-center gap-1 text-[11px] text-white/40">
          <ShieldCheck className="size-3.5" /> No money moves without you
        </span>
      </header>

      {error && (
        <p role="alert" className="mt-3 rounded-xl bg-kai/10 px-3 py-2 text-[12.5px] text-kai">
          {error}
        </p>
      )}

      <div className="mt-3 space-y-2.5">
        {pending.length === 0 && (
          <p className="rounded-2xl border border-dashed border-white/10 px-3.5 py-3 text-[12.5px] leading-relaxed text-white/45">
            Nothing to approve. When Otto prepares a supplier payout or Kai suggests a large refund, it waits here for
            you.
          </p>
        )}
        {pending.map((approval) => (
          <PendingCard key={approval.id} approval={approval} />
        ))}
      </div>

      {decided.length > 0 && (
        <ul className="mt-3 space-y-1.5 border-t border-white/[0.06] pt-3">
          {decided.map((approval) => (
            <DecidedLine key={approval.id} approval={approval} />
          ))}
        </ul>
      )}

      {openBills.length > 0 && (
        <div className="mt-3 border-t border-white/[0.06] pt-3">
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/40">Supplier bills</p>
          <ul className="mt-2 space-y-1.5">
            {openBills.map((bill) => (
              <BillLine key={bill.id} bill={bill} />
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}

function PendingCard({ approval }: { approval: Approval }) {
  const busy = useOffice((s) => s.deciding.includes(approval.id));
  const now = useNow();
  const robot = ROBOTS[approval.requestedBy];
  return (
    <article
      className="animate-rise rounded-2xl border p-3.5"
      style={{
        borderColor: `${robot.accent}40`,
        background: `linear-gradient(135deg, ${robot.accent}12, transparent 60%)`,
      }}
    >
      <div className="flex items-start gap-3">
        <RobotAvatar id={approval.requestedBy} size={34} active />
        <div className="min-w-0 flex-1">
          <div className="flex items-baseline justify-between gap-3">
            <h3 className="truncate text-[13.5px] font-semibold text-white">{approval.title}</h3>
            <span className="shrink-0 font-display text-[22px] leading-none tabular-nums text-white">
              {formatMoney(approval.amountCents)}
            </span>
          </div>
          <p className="mt-1 text-[12.5px] leading-snug text-white/60">{approval.reason}</p>
          <p className="mt-1 text-[11px] text-white/35">
            {robot.name} · {timeAgo(approval.createdAt, now)} ·{" "}
            {approval.kind === "supplier_payout" ? "PayPal Payouts" : "PayPal refund"}
          </p>
        </div>
      </div>
      <div className="mt-3 flex items-center gap-2">
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(approval.id, "reject", "click")}
          className="inline-flex h-9 items-center gap-1.5 rounded-full bg-white/[0.07] px-3.5 text-[13px] text-white/75 transition hover:bg-white/[0.12] hover:text-white disabled:opacity-50"
        >
          <X className="size-3.5" /> Decline
        </button>
        <button
          type="button"
          disabled={busy}
          onClick={() => void decide(approval.id, "approve", "click")}
          className="inline-flex h-9 flex-1 items-center justify-center gap-1.5 rounded-full bg-owner text-[13px] font-semibold text-ink-950 transition hover:brightness-110 disabled:opacity-60"
        >
          {busy ? <Loader2 className="size-3.5 animate-spin" /> : <Check className="size-3.5" />}
          {busy ? "Sending…" : approval.kind === "supplier_payout" ? "Approve & pay" : "Approve refund"}
        </button>
      </div>
      <p className="mt-2 flex items-center gap-1.5 text-[11px] text-white/35">
        <Mic className="size-3" /> Or just say &ldquo;approve&rdquo;.
      </p>
    </article>
  );
}

const OUTCOME: Record<Exclude<Approval["status"], "pending">, { label: string; tone: string }> = {
  executed: { label: "Done", tone: "#86efac" },
  rejected: { label: "Declined", tone: "#9ca3af" },
  failed: { label: "Failed", tone: "#fda4af" },
};

function DecidedLine({ approval }: { approval: Approval }) {
  const outcome = OUTCOME[approval.status as keyof typeof OUTCOME];
  const Via = approval.decidedVia === "voice" ? Mic : MousePointerClick;
  return (
    <li className="flex items-center gap-2 text-[12px]">
      <span className="size-1.5 shrink-0 rounded-full" style={{ background: outcome.tone }} />
      <span className="truncate text-white/60">{approval.title}</span>
      <span className="ml-auto inline-flex shrink-0 items-center gap-1 text-white/40" title={approval.error}>
        <Via
          className="size-3"
          aria-label={approval.decidedVia === "voice" ? "Decided by voice" : "Decided by click"}
        />
        <span style={{ color: outcome.tone }}>{outcome.label}</span>
      </span>
    </li>
  );
}

const BILL_STATUS: Record<SupplierBill["status"], string> = {
  open: "Open",
  awaiting_approval: "Waiting for you",
  processing: "Paying…",
  paid: "Paid",
  failed: "Payment failed",
};

function BillLine({ bill }: { bill: SupplierBill }) {
  const thinking = useOffice((s) => s.thinking !== null);
  const payable = bill.status === "open" || bill.status === "failed";
  const due = new Date(`${bill.dueDate}T12:00:00`).toLocaleDateString("en-GB", { day: "numeric", month: "short" });
  return (
    <li className="flex items-center gap-2 text-[12.5px]">
      <span className="min-w-0 flex-1">
        <span className="block truncate text-white/80">{bill.supplierName}</span>
        <span className="block truncate text-[11px] text-white/40">
          INV {bill.invoiceNumber} · due {due} · {BILL_STATUS[bill.status]}
        </span>
      </span>
      <span className="shrink-0 tabular-nums text-white/75">{formatMoney(bill.amountCents)}</span>
      {payable && (
        <button
          type="button"
          disabled={thinking}
          onClick={() => void sayToCrew(`Otto, pay ${bill.supplierName} invoice ${bill.invoiceNumber}`, "typed")}
          className="shrink-0 rounded-full bg-otto/15 px-2.5 py-1 text-[11.5px] font-medium text-otto transition hover:bg-otto/25 disabled:opacity-50"
        >
          Ask Otto
        </button>
      )}
    </li>
  );
}
