"use client";

import { useFrame } from "@react-three/fiber";
import { useCallback, useRef } from "react";
import * as THREE from "three";
import { useSpeaker } from "@/hooks/useSpeaker";
import { useOffice, type Stage } from "@/lib/client/officeStore";
import { formatMoney, formatSigned } from "@/lib/domain/money";
import { ROBOTS } from "@/lib/domain/robots";
import type { ActivityKind } from "@/lib/domain/types";
import { CREW, DESK_FRONT_Z, HEAD_Y, ROBOT, STATION_X, type CrewId } from "./layout";

// Nameplates and speech bubbles over the crew room. They are plain DOM in the
// page's own React tree; a projector inside the canvas pins each one to its
// point in the room every frame by writing its transform directly.

type LabelKind = "plate" | "bubble";

interface Pin {
  element: HTMLElement;
  anchor: THREE.Vector3;
  x: number;
  y: number;
}

const pins = new Map<string, Pin>();

function anchorOf(id: CrewId, kind: LabelKind): THREE.Vector3 {
  return kind === "plate"
    ? new THREE.Vector3(STATION_X[id], 0.42, DESK_FRONT_Z + 0.02)
    : new THREE.Vector3(STATION_X[id], HEAD_Y + 0.5, ROBOT.z);
}

/** A ref that registers the element with the projector while it is mounted. */
function usePin(id: CrewId, kind: LabelKind) {
  return useCallback(
    (element: HTMLElement | null) => {
      if (!element) return;
      const key = `${id}:${kind}`;
      pins.set(key, { element, anchor: anchorOf(id, kind), x: NaN, y: NaN });
      return () => {
        pins.delete(key);
      };
    },
    [id, kind],
  );
}

/** Lives inside the canvas: moves every pinned label to its anchor's screen position. */
export function LabelProjector() {
  const point = useRef(new THREE.Vector3());
  useFrame(({ camera, size }) => {
    for (const pin of pins.values()) {
      const p = point.current.copy(pin.anchor).project(camera);
      const x = Math.round((p.x * 0.5 + 0.5) * size.width);
      const y = Math.round((0.5 - p.y * 0.5) * size.height);
      if (x === pin.x && y === pin.y) continue;
      pin.x = x;
      pin.y = y;
      pin.element.style.transform = `translate3d(${x}px, ${y}px, 0)`;
    }
  });
  return null;
}

const STAGE_STATUS: Record<ActivityKind, string> = {
  sale: "Booking a sale",
  confirmation: "Reconciling with PayPal",
  payout: "Paying a supplier",
  refund: "Sending a refund",
  claim: "Reviewing a claim",
  approval: "Needs your OK",
  warning: "Flagging an issue",
  briefing: "Writing the briefing",
  info: "Working",
};

const IDLE_STATUS: Record<CrewId, string> = {
  penny: "Books up to date",
  otto: "Watching the bills",
  kai: "Care desk open",
};

/** Lives next to the canvas, covering it exactly. */
export function CrewLabels() {
  return (
    <div aria-hidden className="pointer-events-none absolute inset-0 overflow-hidden">
      {CREW.map((id) => (
        <CrewLabel key={id} id={id} />
      ))}
    </div>
  );
}

/** Off screen until the projector has placed it. */
const PINNED = "absolute left-0 top-0 [transform:translate3d(-999px,-999px,0)]";

function CrewLabel({ id }: { id: CrewId }) {
  const speaking = useSpeaker() === id;
  const thinking = useOffice((s) => s.thinking === id);
  const stage = useOffice((s) => (s.stage?.robot === id ? s.stage : null));
  const waiting = useOffice(
    (s) => s.state?.approvals.some((a) => a.status === "pending" && a.requestedBy === id) ?? false,
  );
  const plate = usePin(id, "plate");
  const bubble = usePin(id, "bubble");
  const { name, accent } = ROBOTS[id];

  const status = thinking
    ? "Thinking…"
    : speaking
      ? "Speaking"
      : stage
        ? STAGE_STATUS[stage.item.kind]
        : waiting
          ? "Waiting for your OK"
          : IDLE_STATUS[id];
  const busy = thinking || speaking || stage !== null;

  return (
    <>
      <div ref={plate} className={PINNED}>
        <div className="flex -translate-x-1/2 -translate-y-1/2 items-center gap-2 whitespace-nowrap rounded-full border border-white/10 bg-ink-950/75 px-2.5 py-1 text-[11.5px] shadow-lg backdrop-blur-md">
          <span
            className={`size-1.5 rounded-full ${busy ? "animate-pulse" : ""}`}
            style={{ background: accent, boxShadow: `0 0 8px ${accent}` }}
          />
          <span className="font-semibold" style={{ color: accent }}>
            {name}
          </span>
          <span className="hidden text-white/60 md:inline">{status}</span>
        </div>
      </div>
      {(thinking || stage) && (
        <div ref={bubble} className={`${PINNED} z-10`}>
          <Bubble accent={accent} stage={thinking ? null : stage} />
        </div>
      )}
    </>
  );
}

/** What the robot just did, or dots while it thinks. The tail points at its head. */
function Bubble({ accent, stage }: { accent: string; stage: Stage | null }) {
  const amount = stage?.item.amountCents ?? 0;
  // Titles such as "Sent $420.00 to Lens Lab" already carry the amount.
  const showAmount = stage !== null && amount !== 0 && !stage.item.title.includes(formatMoney(Math.abs(amount)));

  return (
    <div className="-translate-x-1/2 -translate-y-full">
      <div
        key={stage?.at ?? "thinking"}
        className="flex max-w-[min(17rem,40vw)] animate-rise items-center gap-2 rounded-2xl border bg-ink-950/85 px-3 py-1.5 text-[12px] text-white shadow-xl backdrop-blur-md"
        style={{ borderColor: `${accent}66` }}
      >
        {stage ? (
          <>
            <span className="truncate">{stage.item.title}</span>
            {showAmount ? (
              <span className={`shrink-0 font-medium tabular-nums ${amount > 0 ? "text-penny" : "text-kai"}`}>
                {formatSigned(amount)}
              </span>
            ) : null}
          </>
        ) : (
          <span className="flex items-center gap-1 py-1">
            {[0, 1, 2].map((i) => (
              <span
                key={i}
                className="typing-dot size-1.5 rounded-full"
                style={{ background: accent, animationDelay: `${i * 0.15}s` }}
              />
            ))}
          </span>
        )}
      </div>
      <span
        className="mx-auto -mt-1 block size-2.5 rotate-45 border-b border-r bg-ink-950/85"
        style={{ borderColor: `${accent}66` }}
      />
    </div>
  );
}
