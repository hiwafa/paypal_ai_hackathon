import { BadgeCheck, Brain, Cpu, Hand, ShieldCheck } from "lucide-react";
import Link from "next/link";
import type { ReactNode } from "react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { STORE } from "@/lib/domain/catalog";
import { ROBOTS } from "@/lib/domain/robots";
import type { RobotId } from "@/lib/domain/types";

function SectionTitle({ eyebrow, title, children }: { eyebrow: string; title: ReactNode; children?: ReactNode }) {
  return (
    <div className="max-w-2xl">
      <p className="text-[11px] uppercase tracking-[0.24em] text-gold-400/80">{eyebrow}</p>
      <h2 className="mt-3 font-display text-[36px] leading-[1.02] text-white sm:text-[46px]">{title}</h2>
      {children && <p className="mt-4 text-[15.5px] leading-relaxed text-white/55">{children}</p>}
    </div>
  );
}

// --- The crew ---------------------------------------------------------------

const POWERED_BY: Record<RobotId, string> = {
  lumi: "Claude · MediaPipe face mesh · PayPal Orders v2",
  penny: "PayPal webhooks · AG Grid ledger · Claude briefing",
  otto: "PayPal Payouts, sent only after your approval",
  kai: "Claude vision · care policy in code · PayPal Refunds",
};

const CREW: RobotId[] = ["lumi", "penny", "otto", "kai"];

export function CrewSection() {
  return (
    <section id="crew" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <SectionTitle eyebrow="Meet the crew" title="Four robots, one owner in charge.">
        Each robot has one job, a clear personality and a voice of its own. They talk to {STORE.owner} in plain
        language, and they act on PayPal only through narrow, audited tools.
      </SectionTitle>
      <div className="mt-12 grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
        {CREW.map((id) => {
          const robot = ROBOTS[id];
          return (
            <article
              key={id}
              className="glass group relative overflow-hidden rounded-[28px] p-5 transition hover:-translate-y-0.5"
            >
              <span
                aria-hidden
                className="absolute -right-10 -top-10 size-40 rounded-full opacity-30 blur-3xl transition group-hover:opacity-50"
                style={{ background: robot.accent }}
              />
              <RobotAvatar id={id} size={64} className="relative" />
              <h3 className="relative mt-4 flex items-baseline gap-2">
                <span className="font-display text-[28px] text-white">{robot.name}</span>
                <span className="text-[11px] uppercase tracking-[0.18em]" style={{ color: robot.accent }}>
                  {robot.role}
                </span>
              </h3>
              <p className="relative mt-2 text-[14px] leading-relaxed text-white/65">{robot.duty}</p>
              <p className="relative mt-4 border-t border-white/[0.07] pt-3 text-[12px] text-white/40">
                {POWERED_BY[id]}
              </p>
            </article>
          );
        })}
      </div>
    </section>
  );
}

// --- The story --------------------------------------------------------------

const STEPS: Array<{ robot: RobotId; title: string; body: string }> = [
  {
    robot: "lumi",
    title: "Sara steps up to the magic mirror",
    body: "The video never leaves her device. A face mesh reads her face shape, and Lumi pulls the frames that suit it off the wall.",
  },
  {
    robot: "lumi",
    title: "She pays with PayPal",
    body: "The server prices the bag from the catalog, never from the browser, then PayPal Orders v2 creates and captures the payment.",
  },
  {
    robot: "penny",
    title: "The back office lights up",
    body: "Penny books the capture with PayPal's real fee, a signed webhook confirms it, and the crew room reacts in real time.",
  },
  {
    robot: "otto",
    title: "Otto pays a supplier, on your word",
    body: "Maryam says “Pay Lens Lab”. Otto prepares a PayPal payout, and it waits until she approves with a click or out loud.",
  },
  {
    robot: "kai",
    title: "Kai settles a claim in seconds",
    body: "Sara sends a photo of a scratched lens. Kai checks it against the care policy and refunds at once, or asks Maryam above the limit.",
  },
];

export function StorySection() {
  return (
    <section id="story" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <SectionTitle eyebrow="How it works" title="From a smile in the mirror to a balanced ledger." />
      <ol className="mt-12 grid gap-4 md:grid-cols-2 lg:grid-cols-5">
        {STEPS.map((step, i) => {
          const robot = ROBOTS[step.robot];
          return (
            <li key={step.title} className="glass relative rounded-[24px] p-5">
              <div className="flex items-center justify-between">
                <span className="font-display text-[34px] leading-none text-white/25">{i + 1}</span>
                <RobotAvatar id={step.robot} size={30} />
              </div>
              <h3 className="mt-4 text-[15px] font-semibold leading-snug text-white">{step.title}</h3>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{step.body}</p>
              <span
                aria-hidden
                className="absolute inset-x-5 bottom-0 h-px"
                style={{ background: `linear-gradient(90deg, transparent, ${robot.accent}99, transparent)` }}
              />
            </li>
          );
        })}
      </ol>
    </section>
  );
}

// --- Trust ------------------------------------------------------------------

const PRINCIPLES: Array<{ icon: ReactNode; title: string; body: string }> = [
  {
    icon: <Brain className="size-5" />,
    title: "AI proposes",
    body: "Claude writes every reply and chooses tools, but its tools can only look things up or prepare a request. It cannot move money.",
  },
  {
    icon: <Cpu className="size-5" />,
    title: "Code decides",
    body: "Prices come from the catalog and refund limits from the care policy. Every call that moves money is idempotent, and webhook signatures are verified.",
  },
  {
    icon: <Hand className="size-5" />,
    title: "The owner approves",
    body: "Supplier payouts and large refunds wait in Maryam's tray. She approves with a click or by saying “approve”, matched by plain code in her browser, never by the AI.",
  },
];

export function TrustSection() {
  return (
    <section id="trust" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="glass-strong relative overflow-hidden rounded-[36px] px-6 py-12 sm:px-12">
        <span aria-hidden className="absolute -left-24 -top-24 size-80 rounded-full bg-gold-400/10 blur-3xl" />
        <SectionTitle
          eyebrow="Safety by design"
          title={
            <>
              AI proposes. Code decides. <span className="text-gradient-gold italic">You approve.</span>
            </>
          }
        />
        <div className="relative mt-10 grid gap-6 md:grid-cols-3">
          {PRINCIPLES.map((item) => (
            <div key={item.title}>
              <span className="grid size-10 place-items-center rounded-2xl bg-white/[0.06] text-gold-300">
                {item.icon}
              </span>
              <h3 className="mt-4 text-[16px] font-semibold text-white">{item.title}</h3>
              <p className="mt-2 text-[14px] leading-relaxed text-white/55">{item.body}</p>
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}

// --- PayPal -----------------------------------------------------------------

const PAYPAL_APIS: Array<{ name: string; body: string }> = [
  { name: "Orders v2", body: "Create and capture through the PayPal JS SDK buttons, priced on the server." },
  { name: "Payouts", body: "Supplier payments with a status check, settled when PayPal confirms the batch." },
  { name: "Refunds", body: "Partial refunds on a capture, instant under the policy limit or after approval." },
  { name: "Webhooks", body: "Signature-verified events reconcile captures, refunds, reversals and payouts." },
];

export function PayPalSection() {
  return (
    <section id="paypal" className="mx-auto max-w-6xl px-5 py-20 sm:px-8">
      <div className="grid items-start gap-10 lg:grid-cols-[0.9fr_1.1fr]">
        <SectionTitle eyebrow="PayPal, end to end" title="Real money flows, in the sandbox.">
          With sandbox keys the crew uses PayPal&apos;s REST APIs directly. Without keys, a built-in simulator runs the
          very same flows, so anyone can try the whole story in a minute.
        </SectionTitle>
        <ul className="grid gap-3 sm:grid-cols-2">
          {PAYPAL_APIS.map((api) => (
            <li key={api.name} className="glass rounded-[22px] p-5">
              <p className="flex items-center gap-2 text-[15px] font-semibold text-white">
                <BadgeCheck className="size-4 text-paypal" /> {api.name}
              </p>
              <p className="mt-2 text-[13.5px] leading-relaxed text-white/55">{api.body}</p>
            </li>
          ))}
        </ul>
      </div>
    </section>
  );
}

// --- Footer -----------------------------------------------------------------

export function LandingFooter() {
  return (
    <footer className="mx-auto max-w-6xl px-5 pb-12 pt-6 sm:px-8">
      <div className="glass flex flex-col gap-6 rounded-[28px] px-6 py-8 sm:flex-row sm:items-center sm:justify-between sm:px-8">
        <div>
          <p className="font-display text-[28px] leading-tight text-white">Ready to meet the crew?</p>
          <p className="mt-1 flex items-center gap-1.5 text-[13px] text-white/45">
            <ShieldCheck className="size-3.5" /> Sandbox money only. {STORE.name} is a fictional shop.
          </p>
        </div>
        <div className="flex flex-wrap gap-3">
          <Link
            href="/shop"
            className="inline-flex h-11 items-center rounded-full bg-gold-400 px-5 text-[14px] font-semibold text-ink-950 transition hover:bg-gold-300"
          >
            Enter the boutique
          </Link>
          <Link
            href="/office"
            className="inline-flex h-11 items-center rounded-full bg-white/[0.07] px-5 text-[14px] text-white/85 transition hover:bg-white/[0.12] hover:text-white"
          >
            Open the back office
          </Link>
        </div>
      </div>
      <p className="mt-6 text-center text-[12px] text-white/30">
        CrewOS · Built with Next.js, React Three Fiber, MediaPipe, Claude and PayPal for the PayPal AI Hackathon 2026.
      </p>
    </footer>
  );
}
