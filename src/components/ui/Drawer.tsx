"use client";

import { X } from "lucide-react";
import { useEffect, type ReactNode } from "react";

interface DrawerProps {
  title: string;
  subtitle?: string;
  icon?: ReactNode;
  onClose: () => void;
  footer?: ReactNode;
  wide?: boolean;
  children: ReactNode;
}

/** The frosted side panel used by the bag, the care desk and the mirror. */
export function Drawer({ title, subtitle, icon, onClose, footer, wide = false, children }: DrawerProps) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === "Escape") onClose();
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [onClose]);

  return (
    <aside
      role="dialog"
      aria-label={title}
      className={`glass-strong fixed bottom-4 right-4 top-[76px] z-40 flex animate-drawer flex-col overflow-hidden rounded-[28px] ${
        wide ? "w-[min(540px,calc(100vw-2rem))]" : "w-[min(440px,calc(100vw-2rem))]"
      }`}
    >
      <header className="flex items-center gap-3 border-b border-white/[0.06] px-5 py-4">
        {icon}
        <div className="min-w-0 flex-1">
          <h2 className="font-display text-[26px] leading-none text-white">{title}</h2>
          {subtitle && <p className="mt-1 truncate text-xs text-white/50">{subtitle}</p>}
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label={`Close ${title}`}
          className="grid size-9 place-items-center rounded-full text-white/60 transition hover:bg-white/10 hover:text-white"
        >
          <X className="size-4" />
        </button>
      </header>
      <div className="scrollbar-thin min-h-0 flex-1 overflow-y-auto px-5 py-4">{children}</div>
      {footer && <footer className="border-t border-white/[0.06] px-5 py-4">{footer}</footer>}
    </aside>
  );
}
