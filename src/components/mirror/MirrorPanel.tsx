"use client";

import { Camera, Loader2, RefreshCw, ScanFace, ShoppingBag, UserRound } from "lucide-react";
import dynamic from "next/dynamic";
import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import { Drawer } from "@/components/ui/Drawer";
import { FrameGlyph } from "@/components/ui/FrameGlyph";
import { addFromCounter, reportFaceReading } from "@/lib/client/lumi";
import { useShop } from "@/lib/client/shopStore";
import { PRODUCTS, SHAPE_ADVICE, SIZE_WIDTH_MM, getProduct, sizeForFaceWidth } from "@/lib/domain/catalog";
import { readFace, sampleFace, type FaceSample } from "@/lib/domain/faceShape";
import { formatMoney } from "@/lib/domain/money";
import { FACE_SHAPES, type FaceProfile, type FaceShape, type Product, type ProductId } from "@/lib/domain/types";
import { useFaceCamera, type FaceFrame } from "./faceCamera";

const TryOnOverlay = dynamic(() => import("./TryOnOverlay"), { ssr: false });
const MannequinView = dynamic(() => import("./MannequinView"), { ssr: false });

/** About two seconds of frontal frames give a steady median. */
const SAMPLES_NEEDED = 24;
const SAMPLE_EVERY_MS = 90;

type Scan = { phase: "waiting"; hint: string } | { phase: "scanning"; progress: number } | { phase: "done" };

export default function MirrorPanel() {
  const mode = useShop((s) => s.mirror);
  const tryingOn = useShop((s) => s.tryingOn);
  const { videoRef, frame, status, error, start, stop } = useFaceCamera();
  const close = useCallback(() => useShop.getState().openPanel(null), []);
  const product = tryingOn ? getProduct(tryingOn) : null;

  // Start with whatever the customer was looking at, or a frame that suits them.
  useEffect(() => {
    const shop = useShop.getState();
    if (shop.tryingOn) return;
    const face = shop.face;
    const suggested = PRODUCTS.find((product) => face && product.suits.includes(face.shape)) ?? PRODUCTS[0];
    shop.tryOn(shop.focused ?? shop.onCounter[0] ?? suggested.id);
  }, []);

  // Mirror the camera's progress into the shop state (the boutique dims while it runs).
  useEffect(() => {
    const shop = useShop.getState();
    if (status === "live") shop.patch({ mirror: "live" });
    else if (status === "error") shop.patch({ mirror: "consent" });
  }, [status]);

  const startCamera = () => {
    useShop.getState().patch({ mirror: "starting" });
    void start();
  };

  const showMannequin = () => {
    stop();
    useShop.getState().patch({ mirror: "mannequin" });
  };

  const showVideo = mode === "starting" || mode === "live";

  return (
    <Drawer
      wide
      title="Magic mirror"
      subtitle="Measured on your device · the video is never uploaded"
      icon={<ScanFace className="size-5 text-lumi" />}
      onClose={close}
    >
      <div className="relative h-[min(470px,48vh)] overflow-hidden rounded-[22px] bg-ink-900 ring-1 ring-white/[0.06]">
        {/* The video stays mounted so the camera can attach to it as soon as it starts. */}
        <video
          ref={videoRef}
          playsInline
          muted
          className={`absolute inset-0 size-full -scale-x-100 object-cover transition-opacity duration-500 ${
            mode === "live" ? "opacity-100" : "opacity-0"
          }`}
        />
        {mode === "live" && <LiveMirror frame={frame} product={product} />}
        {mode === "starting" && (
          <div className="absolute inset-0 grid place-items-center">
            <div className="flex flex-col items-center gap-3 text-sm text-white/60">
              <span className="relative grid size-16 place-items-center">
                <span className="absolute inset-0 animate-pulse-ring rounded-full bg-lumi/30" />
                <Loader2 className="size-6 animate-spin text-lumi" />
              </span>
              Waking up the mirror…
            </div>
          </div>
        )}
        {mode === "mannequin" && (
          <div className="absolute inset-0">
            <MannequinView product={product} />
          </div>
        )}
        {mode === "consent" && <Consent error={error} onCamera={startCamera} onMannequin={showMannequin} />}
        {product && (mode === "live" || mode === "mannequin") && (
          <div className="glass absolute bottom-3 left-3 rounded-full px-3 py-1.5 text-xs text-white">
            <span className="font-display text-[15px]">{product.name}</span>
            <span className="text-white/55"> · {formatMoney(product.priceCents)}</span>
          </div>
        )}
      </div>

      {mode === "mannequin" && <ShapePicker />}
      <FrameStrip />
      {(mode === "live" || mode === "mannequin") && (
        <div className="mt-4 flex gap-2">
          {product && <AddButton productId={product.id} />}
          <button
            type="button"
            onClick={mode === "mannequin" ? startCamera : showMannequin}
            className="inline-flex items-center justify-center gap-1.5 rounded-full bg-white/[0.08] px-4 py-2.5 text-[13px] text-white/85 transition hover:bg-white/15"
          >
            {mode === "mannequin" ? <Camera className="size-4" /> : <UserRound className="size-4" />}
            {mode === "mannequin" ? "Use my camera" : "Mannequin"}
          </button>
        </div>
      )}
      {showVideo && (
        <p className="mt-4 text-[11.5px] leading-relaxed text-white/40">
          Face tracking runs in your browser with MediaPipe. Lumi only receives your face shape, width and recommended
          size.
        </p>
      )}
    </Drawer>
  );
}

function Consent({
  error,
  onCamera,
  onMannequin,
}: {
  error: string | null;
  onCamera: () => void;
  onMannequin: () => void;
}) {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center px-8 text-center">
      <div className="relative grid size-24 place-items-center">
        <span className="absolute inset-0 rounded-[48%] border border-lumi/40 shadow-[0_0_40px_-6px_rgba(94,234,212,0.6)]" />
        <ScanFace className="size-9 text-lumi" />
      </div>
      <h3 className="mt-5 font-display text-3xl text-white">See frames on your face</h3>
      <p className="mt-2 max-w-sm text-[13px] leading-relaxed text-white/60">
        The mirror finds your face shape and width, then fits frames in 3D. It all runs on this device: the video is
        never uploaded, and Lumi only gets a few measurements.
      </p>
      {error && (
        <p role="alert" className="mt-3 max-w-sm rounded-2xl bg-kai/10 px-3 py-2 text-[12.5px] text-kai">
          {error}
        </p>
      )}
      <div className="mt-6 flex flex-wrap justify-center gap-2">
        <button
          type="button"
          onClick={onCamera}
          className="inline-flex items-center gap-2 rounded-full bg-lumi px-5 py-2.5 text-sm font-semibold text-ink-950 transition hover:brightness-110"
        >
          <Camera className="size-4" /> Start the camera
        </button>
        <button
          type="button"
          onClick={onMannequin}
          className="rounded-full bg-white/[0.08] px-5 py-2.5 text-sm text-white/85 transition hover:bg-white/15"
        >
          Use the mannequin
        </button>
      </div>
    </div>
  );
}

/** The live view: AR overlay plus the face reading that runs once per visit. */
function LiveMirror({ frame, product }: { frame: RefObject<FaceFrame>; product: Product | null }) {
  // Measure once per visit; reopening the mirror keeps the earlier reading.
  const [scan, setScan] = useState<Scan>(() =>
    useShop.getState().face?.source === "camera"
      ? { phase: "done" }
      : { phase: "waiting", hint: "Look straight at the mirror" },
  );
  const samples = useRef<FaceSample[]>([]);

  useEffect(() => {
    if (scan.phase === "done") return;
    const wait = (hint: string) =>
      setScan((prev) => (prev.phase === "waiting" && prev.hint === hint ? prev : { phase: "waiting", hint }));
    const timer = window.setInterval(() => {
      const current = frame.current;
      if (!current.landmarks || performance.now() - current.at > 400) return wait("Step into the mirror");
      const sample = sampleFace(current.landmarks, current.width, current.height);
      if (!sample) return wait("Look straight at the mirror");
      samples.current.push(sample);
      if (samples.current.length < SAMPLES_NEEDED) {
        setScan({
          phase: "scanning",
          progress: samples.current.length / SAMPLES_NEEDED,
        });
        return;
      }
      const reading = readFace(samples.current);
      samples.current = [];
      if (!reading) return;
      setScan({ phase: "done" });
      const profile: FaceProfile = {
        shape: reading.shape,
        widthMm: reading.widthMm,
        recommendedSize: sizeForFaceWidth(reading.widthMm),
        confidence: reading.confidence,
        source: "camera",
      };
      reportFaceReading(profile);
    }, SAMPLE_EVERY_MS);
    return () => window.clearInterval(timer);
  }, [scan.phase, frame]);

  const rescan = () => {
    samples.current = [];
    setScan({ phase: "waiting", hint: "Look straight at the mirror" });
  };

  return (
    <>
      <div className="absolute inset-0 -scale-x-100">
        <TryOnOverlay frame={frame} product={product} scanning={scan.phase !== "done"} />
      </div>
      <div className="absolute left-3 right-3 top-3 flex items-start justify-between gap-2">
        <ScanStatus scan={scan} />
        {scan.phase === "done" && (
          <button
            type="button"
            onClick={rescan}
            className="glass inline-flex items-center gap-1.5 rounded-full px-3 py-1.5 text-xs text-white/80 transition hover:text-white"
          >
            <RefreshCw className="size-3.5" /> Measure again
          </button>
        )}
      </div>
    </>
  );
}

function ScanStatus({ scan }: { scan: Scan }) {
  const face = useShop((s) => s.face);
  if (scan.phase === "waiting") {
    return <span className="glass rounded-full px-3 py-1.5 text-xs text-white/80">{scan.hint}</span>;
  }
  if (scan.phase === "scanning") {
    return (
      <span className="glass flex items-center gap-2 rounded-full px-3 py-1.5 text-xs text-white">
        Reading your face
        <span className="h-1 w-20 overflow-hidden rounded-full bg-white/15">
          <span
            className="block h-full rounded-full bg-lumi transition-[width]"
            style={{ width: `${Math.round(scan.progress * 100)}%` }}
          />
        </span>
      </span>
    );
  }
  if (!face) return null;
  return (
    <span className="glass max-w-[70%] rounded-2xl px-3 py-2 text-xs text-white/80">
      <span className="font-semibold capitalize text-lumi">{face.shape} face</span>
      {face.widthMm ? ` · ${face.widthMm} mm` : ""} · size {face.recommendedSize} ({SIZE_WIDTH_MM[face.recommendedSize]}{" "}
      mm)
      <span className="mt-0.5 block text-[11px] text-white/50">{SHAPE_ADVICE[face.shape]}</span>
    </span>
  );
}

function ShapePicker() {
  const face = useShop((s) => s.face);
  const pick = (shape: FaceShape) =>
    reportFaceReading({
      shape,
      widthMm: null,
      recommendedSize: "M",
      confidence: 1,
      source: "manual",
    });

  return (
    <div className="mt-4">
      <p className="text-xs text-white/55">No camera? Tell Lumi your face shape:</p>
      <div className="mt-2 flex flex-wrap gap-1.5">
        {FACE_SHAPES.map((shape) => (
          <button
            key={shape}
            type="button"
            onClick={() => pick(shape)}
            aria-pressed={face?.shape === shape}
            className={`rounded-full px-3 py-1.5 text-[12.5px] capitalize transition ${
              face?.shape === shape
                ? "bg-lumi text-ink-950"
                : "border border-white/10 bg-white/[0.04] text-white/75 hover:border-lumi/40 hover:text-white"
            }`}
          >
            {shape}
          </button>
        ))}
      </div>
    </div>
  );
}

function FrameStrip() {
  const tryingOn = useShop((s) => s.tryingOn);
  const face = useShop((s) => s.face);
  return (
    <div className="mt-4">
      <div className="flex items-center justify-between text-xs text-white/55">
        <span>Frames to try</span>
        {face && (
          <span className="inline-flex items-center gap-1.5">
            <span className="size-1.5 rounded-full bg-lumi" /> suits a
            {face.shape === "oval" || face.shape === "oblong" ? "n" : ""} {face.shape} face
          </span>
        )}
      </div>
      <div className="scrollbar-thin -mx-1 mt-2 flex gap-2 overflow-x-auto px-1 pb-1">
        {PRODUCTS.map((product) => {
          const active = product.id === tryingOn;
          const suits = face ? product.suits.includes(face.shape) : false;
          return (
            <button
              key={product.id}
              type="button"
              onClick={() => useShop.getState().tryOn(product.id)}
              aria-pressed={active}
              className={`relative flex w-[84px] shrink-0 flex-col items-center gap-1 rounded-2xl px-2 py-2 transition ${
                active ? "bg-white/[0.1] ring-1 ring-lumi/60" : "bg-white/[0.03] hover:bg-white/[0.07]"
              }`}
            >
              {suits && (
                <span className="absolute right-2 top-2 size-1.5 rounded-full bg-lumi" title="Suits your face" />
              )}
              <FrameGlyph product={product} className="w-16" />
              <span className="text-[11.5px] text-white/80">{product.name}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}

function AddButton({ productId }: { productId: ProductId }) {
  const size = useShop((s) => s.face?.recommendedSize ?? "M");
  const inBag = useShop((s) => s.bag.some((line) => line.productId === productId));
  const product = getProduct(productId);
  return (
    <button
      type="button"
      onClick={() => addFromCounter(productId)}
      className="inline-flex flex-1 items-center justify-center gap-2 rounded-full bg-gold-400 px-4 py-2.5 text-[13px] font-semibold text-ink-950 transition hover:bg-gold-300"
    >
      <ShoppingBag className="size-4" /> {inBag ? "Add another" : "Add"} {product.name} · {size}
    </button>
  );
}
