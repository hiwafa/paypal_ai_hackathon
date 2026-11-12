import { Hero } from "@/components/landing/Hero";
import { CrewSection, LandingFooter, PayPalSection, StorySection, TrustSection } from "@/components/landing/Sections";

export default function Home() {
  return (
    <main className="relative min-h-dvh overflow-x-clip bg-ink-950">
      <div
        aria-hidden
        className="pointer-events-none absolute inset-x-0 top-0 h-[900px] bg-[radial-gradient(50%_60%_at_75%_10%,rgb(94_234_212/0.09),transparent_70%),radial-gradient(45%_50%_at_10%_0%,rgb(232_201_142/0.08),transparent_70%)]"
      />
      <LandingNav />
      <Hero />
      <CrewSection />
      <StorySection />
      <TrustSection />
      <PayPalSection />
      <LandingFooter />
    </main>
  );
}

function LandingNav() {
  return (
    <header className="relative mx-auto flex max-w-6xl items-center justify-between px-5 pt-6 sm:px-8">
      <span className="flex items-center gap-3">
        <span className="grid size-9 place-items-center rounded-full bg-gold-400/15 font-display text-xl italic text-gold-300">
          C
        </span>
        <span className="font-display text-[22px] text-white">CrewOS</span>
      </span>
      <nav aria-label="Sections" className="hidden items-center gap-6 text-[13.5px] text-white/55 md:flex">
        <a href="#crew" className="transition hover:text-white">
          The crew
        </a>
        <a href="#story" className="transition hover:text-white">
          How it works
        </a>
        <a href="#trust" className="transition hover:text-white">
          Safety
        </a>
        <a href="#paypal" className="transition hover:text-white">
          PayPal
        </a>
      </nav>
    </header>
  );
}
