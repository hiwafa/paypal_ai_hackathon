import { ArrowRight, ArrowUpRight } from "lucide-react";
import Link from "next/link";
import type { CSSProperties, ReactNode } from "react";
import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { STORE } from "@/lib/domain/catalog";
import { ROBOTS } from "@/lib/domain/robots";
import type { RobotId } from "@/lib/domain/types";
import { RuntimeBadges } from "./RuntimeBadges";

export function Hero() {
  return (
    <section className="relative mx-auto grid max-w-6xl items-center gap-14 px-5 pb-20 pt-10 sm:px-8 lg:grid-cols-[1.05fr_1fr] lg:pb-28 lg:pt-16">
      <div className="animate-rise">
        <p className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/[0.04] px-3 py-1 text-[12px] text-white/70">
          <span className="size-1.5 rounded-full bg-paypal shadow-[0_0_10px_#7cb7ff]" />
          Built for the PayPal AI Hackathon
        </p>
        <h1 className="mt-6 font-display text-[46px] leading-[0.95] text-white sm:text-[64px] lg:text-[76px]">
          A robot crew for <span className="text-gradient-gold italic">one-person shops.</span>
        </h1>
        <p className="mt-6 max-w-xl text-[16.5px] leading-relaxed text-white/65">
          {STORE.owner} runs {STORE.name} in {STORE.city} on her own. CrewOS gives her four robots: Lumi sells in a 3D
          boutique with an AR magic mirror, while Penny, Otto and Kai keep the books, pay suppliers and refund customers
          through PayPal. Nothing leaves the account without her OK.
        </p>

        <div className="mt-8 flex flex-wrap items-center gap-3">
          <Link
            href="/shop"
            className="group inline-flex h-12 items-center gap-2 rounded-full bg-gold-400 px-6 text-[15px] font-semibold text-ink-950 shadow-[0_10px_40px_-10px_rgb(232_201_142/0.6)] transition hover:bg-gold-300"
          >
            Enter the boutique
            <ArrowRight className="size-4 transition group-hover:translate-x-0.5" />
          </Link>
          <Link
            href="/office"
            className="glass inline-flex h-12 items-center gap-2 rounded-full px-6 text-[15px] text-white/85 transition hover:text-white"
          >
            Open the back office
            <ArrowUpRight className="size-4" />
          </Link>
        </div>
        <p className="mt-4 max-w-md text-[13px] leading-relaxed text-white/45">
          Tip: open both side by side with sound on. Buy something in the boutique and watch the crew react in the back
          office as PayPal confirms it.
        </p>
        <RuntimeBadges className="mt-6 gap-1.5" />
      </div>

      <CrewStage />
    </section>
  );
}

/**
 * A still life of the crew at work, with the kind of events they handle floating around them.
 * Everything inside is sized in em, and 1em follows the stage width (16px at the full 520px),
 * so the scene keeps its proportions on any screen instead of crowding on smaller ones.
 */
function CrewStage() {
  return (
    <div aria-hidden className="@container relative mx-auto aspect-[1/1] w-full max-w-[520px] animate-fade">
      <div className="absolute inset-0 text-[length:clamp(12px,3.077cqw,16px)]">
        <div className="glass absolute inset-4 overflow-hidden rounded-[36px]">
          <div className="absolute inset-0 bg-[radial-gradient(55%_40%_at_50%_28%,rgb(94_234_212/0.18),transparent_70%),radial-gradient(60%_45%_at_50%_92%,rgb(232_201_142/0.12),transparent_70%)]" />
          <svg className="absolute inset-0 size-full" viewBox="0 0 100 100" preserveAspectRatio="none">
            <defs>
              <linearGradient id="flow" x1="0" x2="0" y1="0" y2="1">
                <stop offset="0" stopColor="#5eead4" stopOpacity="0.7" />
                <stop offset="1" stopColor="#e8c98e" stopOpacity="0.5" />
              </linearGradient>
            </defs>
            {[22, 50, 78].map((x) => (
              <path
                key={x}
                d={`M50 43 C 50 51, ${x} 49, ${x} 56`}
                fill="none"
                stroke="url(#flow)"
                strokeWidth="1.2"
                strokeDasharray="5 7"
                className="landing-flow"
                vectorEffect="non-scaling-stroke"
              />
            ))}
          </svg>
        </div>

        <Member id="lumi" size="7em" className="left-1/2 top-[9%] -translate-x-1/2" />
        <Member id="penny" size="5.125em" className="left-[22%] top-[57%] -translate-x-1/2" />
        <Member id="otto" size="5.125em" className="left-1/2 top-[57%] -translate-x-1/2" />
        <Member id="kai" size="5.125em" className="left-[78%] top-[57%] -translate-x-1/2" />

        <Chip className="left-[57%] top-[5%]" tone="#5eead4" delay={0}>
          Oval face · 3 frames picked
        </Chip>
        <Chip className="left-[-3%] top-[40%] hidden sm:block" tone="#86efac" delay={1.2}>
          Booked sale MIRA-1014 <span className="text-penny">+$132.00</span>
        </Chip>
        <Chip className="right-[-3%] top-[46%] hidden sm:block" tone="#fda4af" delay={2.4}>
          Refunded $17.70 · photo claim
        </Chip>
        <Chip className="bottom-[3%] left-1/2 -translate-x-1/2" tone="#fcd34d" delay={3.2}>
          &ldquo;Approve&rdquo; · $640.00 sent to Lens Lab
        </Chip>
      </div>
    </div>
  );
}

function Member({ id, size, className }: { id: RobotId; size: string; className: string }) {
  const { name, role, accent } = ROBOTS[id];
  return (
    <div className={`absolute flex flex-col items-center ${className}`}>
      <span className="relative">
        <span
          className="absolute inset-[-30%] rounded-full opacity-50 blur-2xl"
          style={{ background: `radial-gradient(circle, ${accent}88, transparent 65%)` }}
        />
        <RobotAvatar id={id} size={size} className="relative" />
      </span>
      <span className="mt-[0.6em] text-[0.8125em] font-semibold" style={{ color: accent }}>
        {name}
      </span>
      <span className="whitespace-nowrap text-[0.6875em] uppercase tracking-[0.18em] text-white/40">{role}</span>
    </div>
  );
}

function Chip({
  children,
  className,
  tone,
  delay,
}: {
  children: ReactNode;
  className: string;
  tone: string;
  delay: number;
}) {
  const style: CSSProperties = { animationDelay: `${delay}s`, borderColor: `${tone}55` };
  return (
    <div className={`absolute ${className}`}>
      <span
        className="glass-strong inline-flex animate-float items-center gap-[0.67em] whitespace-nowrap rounded-full border px-[1em] py-[0.5em] text-[0.75em] text-white/85"
        style={style}
      >
        <span className="size-[0.5em] rounded-full" style={{ background: tone, boxShadow: `0 0 8px ${tone}` }} />
        {children}
      </span>
    </div>
  );
}
