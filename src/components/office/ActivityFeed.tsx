"use client";

import { RobotAvatar } from "@/components/ui/RobotAvatar";
import { useNow } from "@/hooks/useNow";
import { useOffice } from "@/lib/client/officeStore";
import { timeAgo } from "@/lib/client/time";
import { formatSigned } from "@/lib/domain/money";
import { actorAccent, actorName, isRobot } from "@/lib/domain/robots";
import type { ActivityItem } from "@/lib/domain/types";

const SHOWN = 30;

function ActorMark({ item }: { item: ActivityItem }) {
  if (isRobot(item.actor)) return <RobotAvatar id={item.actor} size={30} />;
  const accent = actorAccent(item.actor);
  return (
    <span
      className="grid size-[30px] shrink-0 place-items-center rounded-full text-[11px] font-semibold"
      style={{ color: accent, background: `${accent}1f`, boxShadow: `inset 0 0 0 1px ${accent}40` }}
      aria-label={actorName(item.actor)}
    >
      {item.actor === "paypal" ? "PP" : actorName(item.actor)[0]}
    </span>
  );
}

/** Everything the crew, PayPal and Maryam did, newest first, live. */
export function ActivityFeed() {
  const items = useOffice((s) => s.state?.activity);
  const live = useOffice((s) => s.live);
  const now = useNow();

  return (
    <section aria-labelledby="feed-title" className="glass flex min-h-[260px] flex-col overflow-hidden rounded-[26px]">
      <header className="flex items-center gap-2 px-4 pb-2 pt-4">
        <h2 id="feed-title" className="text-[13px] font-semibold text-white">
          Live activity
        </h2>
        <span className="ml-auto inline-flex items-center gap-1.5 text-[11px] text-white/45">
          <span className={`size-1.5 rounded-full ${live ? "bg-penny shadow-[0_0_8px_#86efac]" : "bg-white/25"}`} />
          {live ? "Live" : "Reconnecting…"}
        </span>
      </header>
      <ol className="scrollbar-thin min-h-0 flex-1 space-y-1 overflow-y-auto px-2 pb-3" aria-live="polite">
        {(items ?? []).slice(0, SHOWN).map((item) => (
          <li key={item.id} className="flex animate-rise gap-3 rounded-2xl px-2 py-2 transition hover:bg-white/[0.03]">
            <ActorMark item={item} />
            <div className="min-w-0 flex-1">
              <div className="flex items-baseline gap-2">
                <p className="min-w-0 flex-1 truncate text-[13px] text-white/90">{item.title}</p>
                {item.amountCents ? (
                  <span
                    className={`shrink-0 text-[12px] tabular-nums ${item.amountCents > 0 ? "text-penny" : "text-white/55"}`}
                  >
                    {formatSigned(item.amountCents)}
                  </span>
                ) : null}
              </div>
              <p className="truncate text-[11.5px] text-white/40">
                <span className="font-medium" style={{ color: actorAccent(item.actor) }}>
                  {actorName(item.actor)}
                </span>
                {item.detail ? ` · ${item.detail}` : ""}
              </p>
              <p className="text-[10.5px] text-white/30">{now ? timeAgo(item.at, now) : "\u00a0"}</p>
            </div>
          </li>
        ))}
        {!items && <li className="px-3 py-6 text-center text-sm text-white/40">Loading the feed…</li>}
      </ol>
    </section>
  );
}
