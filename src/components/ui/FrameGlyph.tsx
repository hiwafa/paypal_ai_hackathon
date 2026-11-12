import { useId } from "react";
import type { FrameStyle, Product } from "@/lib/domain/types";

// A small front-view drawing of a frame, coloured like the real product.
// Used wherever a 3D render would be overkill: bag lines, receipts, cards.

const LEFT = { cx: 28, cy: 20 };

function lensPath(style: FrameStyle): string {
  const { cx, cy } = LEFT;
  switch (style) {
    case "aviator":
      return `M${cx + 15} ${cy - 11} L${cx - 15} ${cy - 11} C${cx - 20} ${cy - 10} ${cx - 18} ${cy + 8} ${cx - 6} ${cy + 13} C${cx + 4} ${cy + 16} ${cx + 15} ${cy + 6} ${cx + 16} ${cy - 3} C${cx + 17} ${cy - 8} ${cx + 17} ${cy - 11} ${cx + 15} ${cy - 11}Z`;
    case "cat-eye":
      return `M${cx + 14} ${cy - 9} C${cx + 4} ${cy - 12} ${cx - 10} ${cy - 12} ${cx - 19} ${cy - 15} C${cx - 17} ${cy - 4} ${cx - 14} ${cy + 10} ${cx - 2} ${cy + 11} C${cx + 10} ${cy + 12} ${cx + 16} ${cy + 4} ${cx + 15} ${cy - 3} C${cx + 15} ${cy - 6} ${cx + 15} ${cy - 8} ${cx + 14} ${cy - 9}Z`;
    case "round":
    case "round-metal":
      return `M${cx - 14} ${cy} a14 14 0 1 0 28 0 a14 14 0 1 0 -28 0Z`;
    case "hexagon": {
      const points = Array.from({ length: 6 }, (_, i) => {
        const a = (i * Math.PI) / 3;
        return `${(cx + Math.cos(a) * 16).toFixed(2)} ${(cy + Math.sin(a) * 14).toFixed(2)}`;
      });
      return `M${points.join(" L")}Z`;
    }
    case "rectangle":
      return roundedRect(34, 21, 4);
    case "oversized":
      return roundedRect(36, 30, 11);
    case "browline":
      return roundedRect(32, 22, 7);
    case "soft-square":
      return roundedRect(32, 26, 9);
  }
}

function roundedRect(w: number, h: number, r: number): string {
  const x = LEFT.cx - w / 2;
  const y = LEFT.cy - h / 2;
  return `M${x + r} ${y} H${x + w - r} Q${x + w} ${y} ${x + w} ${y + r} V${y + h - r} Q${x + w} ${y + h} ${x + w - r} ${y + h} H${x + r} Q${x} ${y + h} ${x} ${y + h - r} V${y + r} Q${x} ${y} ${x + r} ${y}Z`;
}

interface FrameGlyphProps {
  product: Product;
  className?: string;
}

export function FrameGlyph({ product, className = "" }: FrameGlyphProps) {
  const id = useId();
  const { look, style } = product;
  const lens = lensPath(style);
  // Browlines have a fine metal rim under a bold acetate brow.
  const wire = look.material === "metal" || style === "browline";
  const stroke =
    style === "browline"
      ? (look.accentColor ?? look.frameColor)
      : look.pattern === "tortoise"
        ? `url(#${id}-tortoise)`
        : look.frameColor;
  const strokeWidth = wire ? 1.6 : 3.2;

  return (
    <svg viewBox="0 0 100 40" className={className} role="img" aria-label={`${product.name} frame`}>
      <defs>
        <linearGradient id={`${id}-tortoise`} x1="0" y1="0" x2="1" y2="1">
          <stop offset="0" stopColor="#3b1d0b" />
          <stop offset="0.35" stopColor="#b06a2c" />
          <stop offset="0.6" stopColor="#5a2e12" />
          <stop offset="1" stopColor="#c98a3e" />
        </linearGradient>
        {/* A faint light edge keeps black frames readable on the dark interface. */}
        <filter id={`${id}-rim`} x="-10%" y="-20%" width="120%" height="140%">
          <feDropShadow dx="0" dy="0" stdDeviation="0.9" floodColor="#ffffff" floodOpacity="0.4" />
        </filter>
      </defs>
      <g filter={`url(#${id}-rim)`}>
        <g
          fill={look.lensTint}
          fillOpacity={Math.max(0.18, look.lensOpacity)}
          stroke={stroke}
          strokeWidth={strokeWidth}
          strokeOpacity={look.finish === "crystal" ? 0.75 : 1}
          strokeLinejoin="round"
        >
          <path d={lens} />
          <path d={lens} transform="translate(100 0) scale(-1 1)" />
        </g>
        <g fill="none" stroke={stroke} strokeWidth={wire ? 1.5 : 2.6} strokeLinecap="round">
          <path d="M43.5 17.5 Q50 13.5 56.5 17.5" />
          {style === "aviator" && <path d="M38 9.4 Q50 7.6 62 9.4" />}
          <path d="M10.5 15 L4 13.6" />
          <path d="M89.5 15 L96 13.6" />
        </g>
        {style === "browline" && (
          <g fill="none" stroke={look.frameColor} strokeWidth="4.2" strokeLinecap="round">
            <path d="M12.5 11.5 Q28 6.8 43.6 11.2" />
            <path d="M56.4 11.2 Q72 6.8 87.5 11.5" />
          </g>
        )}
      </g>
    </svg>
  );
}
