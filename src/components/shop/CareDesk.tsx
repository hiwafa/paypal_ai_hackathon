"use client";

import { Camera, ImagePlus, Loader2, RotateCcw, Sparkles } from "lucide-react";
import { useCallback, useEffect, useId, useRef, useState } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { ApiError, api } from "@/lib/client/api";
import { preparePhoto, sampleDamagePhoto, type PreparedPhoto } from "@/lib/client/photo";
import { useShop } from "@/lib/client/shopStore";
import { speak } from "@/lib/client/speech";
import { formatMoney } from "@/lib/domain/money";
import { CARE_POLICY, describeDamage } from "@/lib/domain/policy";
import type { Claim } from "@/lib/domain/types";

const SAMPLE_MESSAGE = "A light scratch appeared on the left lens in the first week.";

/** Kai's desk: a photo claim goes to the AI assessor, then the policy decides. */
export default function CareDesk() {
  const myOrders = useShop((s) => s.myOrders);
  const close = useCallback(() => useShop.getState().openPanel(null), []);
  const [claim, setClaim] = useState<Claim | null>(null);

  return (
    <Drawer
      title="Care desk"
      subtitle="Kai · customer care robot"
      icon={<RobotAvatar id="kai" size={38} />}
      onClose={close}
    >
      {claim ? (
        <ClaimResult claim={claim} onAgain={() => setClaim(null)} />
      ) : (
        <ClaimForm defaultOrder={myOrders[0]?.number ?? ""} onFiled={setClaim} />
      )}
    </Drawer>
  );
}

function ClaimForm({ defaultOrder, onFiled }: { defaultOrder: string; onFiled: (claim: Claim) => void }) {
  const myOrders = useShop((s) => s.myOrders);
  const formId = useId();
  const fileInput = useRef<HTMLInputElement>(null);
  const [orderNumber, setOrderNumber] = useState(defaultOrder);
  const [message, setMessage] = useState("");
  const [photo, setPhoto] = useState<PreparedPhoto | null>(null);
  const [preparing, setPreparing] = useState(false);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const loadPhoto = async (load: () => Promise<Blob>) => {
    setError(null);
    setPreparing(true);
    try {
      setPhoto(await preparePhoto(await load()));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "That photo couldn't be used.");
    } finally {
      setPreparing(false);
    }
  };

  const submit = async () => {
    if (!photo) return;
    setError(null);
    setSending(true);
    try {
      const { claim } = await api.fileClaim({
        orderNumber: orderNumber.trim(),
        message: message.trim(),
        photo: { mediaType: photo.mediaType, base64: photo.base64 },
        thumbnail: photo.thumbnail,
      });
      onFiled(claim);
    } catch (cause) {
      setError(cause instanceof ApiError ? cause.message : "Kai couldn't receive the claim. Please try again.");
    } finally {
      setSending(false);
    }
  };

  const ready = /^MIRA-\d{4,6}$/i.test(orderNumber.trim()) && message.trim().length >= 3 && photo !== null;

  return (
    <form
      className="space-y-4"
      onSubmit={(event) => {
        event.preventDefault();
        if (ready && !sending) void submit();
      }}
    >
      <p className="rounded-2xl bg-kai/[0.07] px-3.5 py-3 text-[13px] leading-relaxed text-white/75">
        Something wrong with your frames? Send me a photo and I&apos;ll check it against our care policy right away.
      </p>

      <div>
        <label htmlFor={`${formId}-order`} className="text-xs font-medium text-white/60">
          Order number
        </label>
        <input
          id={`${formId}-order`}
          list={`${formId}-orders`}
          value={orderNumber}
          onChange={(event) => setOrderNumber(event.target.value.toUpperCase())}
          placeholder="MIRA-1014"
          autoComplete="off"
          className="mt-1.5 h-11 w-full rounded-xl border border-white/10 bg-white/[0.04] px-3.5 font-mono text-sm text-white placeholder:text-white/30 focus:border-kai/50 focus:outline-none"
        />
        <datalist id={`${formId}-orders`}>
          {myOrders.map((order) => (
            <option key={order.number} value={order.number}>
              {order.summary}
            </option>
          ))}
        </datalist>
        {myOrders.length === 0 && (
          <p className="mt-1 text-[11.5px] text-white/40">
            It&apos;s on your receipt. Buy a pair first to try a claim.
          </p>
        )}
      </div>

      <div>
        <label htmlFor={`${formId}-message`} className="text-xs font-medium text-white/60">
          What happened?
        </label>
        <textarea
          id={`${formId}-message`}
          value={message}
          onChange={(event) => setMessage(event.target.value)}
          maxLength={600}
          rows={3}
          placeholder="e.g. A hinge snapped when I opened them."
          className="mt-1.5 w-full resize-none rounded-xl border border-white/10 bg-white/[0.04] px-3.5 py-2.5 text-sm text-white placeholder:text-white/30 focus:border-kai/50 focus:outline-none"
        />
      </div>

      <div>
        <span className="text-xs font-medium text-white/60">Photo of the damage</span>
        <input
          ref={fileInput}
          type="file"
          accept="image/*"
          capture="environment"
          className="sr-only"
          onChange={(event) => {
            const file = event.target.files?.[0];
            event.target.value = "";
            if (file) void loadPhoto(async () => file);
          }}
        />
        {photo ? (
          <div className="relative mt-1.5 overflow-hidden rounded-2xl border border-white/10">
            {/* eslint-disable-next-line @next/next/no-img-element -- a local data URL, not a remote image */}
            <img src={photo.preview} alt="Your photo of the frames" className="aspect-[4/3] w-full object-cover" />
            <button
              type="button"
              onClick={() => fileInput.current?.click()}
              className="glass absolute bottom-2 right-2 rounded-full px-3 py-1.5 text-xs text-white"
            >
              Change photo
            </button>
          </div>
        ) : (
          <div className="mt-1.5 grid grid-cols-2 gap-2">
            <button
              type="button"
              disabled={preparing}
              onClick={() => fileInput.current?.click()}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/15 px-3 py-5 text-xs text-white/70 transition hover:border-kai/50 hover:text-white"
            >
              {preparing ? <Loader2 className="size-5 animate-spin" /> : <ImagePlus className="size-5" />}
              Upload or take a photo
            </button>
            <button
              type="button"
              disabled={preparing}
              onClick={() => {
                if (!message.trim()) setMessage(SAMPLE_MESSAGE);
                void loadPhoto(sampleDamagePhoto);
              }}
              className="flex flex-col items-center gap-1.5 rounded-2xl border border-dashed border-white/15 px-3 py-5 text-xs text-white/70 transition hover:border-kai/50 hover:text-white"
            >
              <Camera className="size-5" />
              Use a sample photo
            </button>
          </div>
        )}
      </div>

      {error && (
        <p role="alert" className="rounded-2xl bg-kai/10 px-3 py-2 text-sm text-kai">
          {error}
        </p>
      )}

      <button
        type="submit"
        disabled={!ready || sending}
        className="inline-flex h-12 w-full items-center justify-center gap-2 rounded-full bg-kai font-semibold text-ink-950 transition hover:brightness-105 disabled:bg-white/10 disabled:text-white/35"
      >
        {sending ? <Loader2 className="size-4 animate-spin" /> : <Sparkles className="size-4" />}
        {sending ? "Kai is looking at your photo…" : "Send to Kai"}
      </button>

      <p className="text-[11.5px] leading-relaxed text-white/40">
        Policy: within {CARE_POLICY.windowDays} days of purchase. Cosmetic wear gets a{" "}
        {Math.round(CARE_POLICY.minorRefundRate * 100)}% goodwill refund; broken frames are refunded in full. Small
        refunds are instant; larger ones need Maryam&apos;s OK. The AI only describes the photo; the rules decide.
      </p>
    </form>
  );
}

const OUTCOME: Record<Claim["status"], { label: string; tone: string }> = {
  resolved: { label: "Refunded", tone: "#86efac" },
  awaiting_owner: { label: "Sent to Maryam", tone: "#c4b5fd" },
  needs_info: { label: "Clearer photo needed", tone: "#fcd34d" },
  declined: { label: "Not covered", tone: "#fda4af" },
  failed: { label: "Refund failed", tone: "#fda4af" },
};

function ClaimResult({ claim, onAgain }: { claim: Claim; onAgain: () => void }) {
  const { assessment, decision } = claim;
  const outcome = OUTCOME[claim.status];

  useEffect(() => {
    speak(claim.reply, "kai");
  }, [claim.reply]);

  const headline =
    claim.status === "resolved"
      ? `${formatMoney(decision.refundCents)} refunded to PayPal`
      : claim.status === "awaiting_owner"
        ? `${formatMoney(decision.refundCents)} refund awaiting approval`
        : outcome.label;

  return (
    <div className="space-y-3.5">
      <div className="flex gap-3">
        <RobotAvatar id="kai" size={34} />
        <p className="flex-1 rounded-2xl rounded-tl-md bg-white/[0.06] px-3.5 py-3 text-[14px] leading-relaxed text-white/90">
          {claim.reply}
        </p>
      </div>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <p className="text-[10.5px] uppercase tracking-[0.2em]" style={{ color: outcome.tone }}>
          {outcome.label}
        </p>
        <p className="mt-1 font-display text-[26px] leading-tight text-white">{headline}</p>
        <p className="mt-1.5 text-[13px] text-white/60">{decision.policyRule}</p>
        {claim.refundId && <p className="mt-2 font-mono text-[11px] text-white/45">Refund {claim.refundId}</p>}
      </section>

      <section className="rounded-2xl border border-white/[0.08] bg-white/[0.03] p-4">
        <div className="flex items-center justify-between">
          <p className="text-[10.5px] uppercase tracking-[0.2em] text-white/45">What Kai saw</p>
          <span className="rounded-full bg-white/[0.06] px-2 py-0.5 text-[10.5px] text-white/55">
            {claim.assessedBy === "claude" ? "Claude vision" : "Offline rules"}
          </span>
        </div>
        <p className="mt-2 text-sm text-white">
          <span className="inline-block first-letter:uppercase">{describeDamage(assessment.damageType)}</span> ·{" "}
          <span className="capitalize text-white/60">{assessment.severity}</span>
        </p>
        <p className="mt-1 text-[13px] leading-relaxed text-white/60">{assessment.summary}</p>
        <div className="mt-3 flex items-center gap-2 text-[11px] text-white/45">
          Confidence
          <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-white/10">
            <span
              className="block h-full rounded-full bg-kai"
              style={{ width: `${Math.round(assessment.confidence * 100)}%` }}
            />
          </span>
          {Math.round(assessment.confidence * 100)}%
        </div>
      </section>

      <button
        type="button"
        onClick={onAgain}
        className="inline-flex w-full items-center justify-center gap-2 rounded-full bg-white/[0.08] py-3 text-sm font-medium text-white transition hover:bg-white/15"
      >
        <RotateCcw className="size-4" /> File another claim
      </button>
    </div>
  );
}
