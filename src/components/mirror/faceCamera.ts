"use client";

import type { FaceLandmarker, NormalizedLandmark } from "@mediapipe/tasks-vision";
import { useCallback, useEffect, useRef, useState } from "react";

// The magic mirror's eyes: the front camera plus MediaPipe Face Landmarker,
// running entirely in the browser. Video frames never leave the device.

const WASM_PATH = "/mediapipe/wasm";
const MODEL_URL =
  "https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task";

let shared: Promise<FaceLandmarker> | null = null;

/** Loads the model once per page. Tries the GPU first and falls back to the CPU. */
function loadFaceLandmarker(): Promise<FaceLandmarker> {
  shared ??= (async () => {
    const { FaceLandmarker, FilesetResolver } = await import("@mediapipe/tasks-vision");
    const files = await FilesetResolver.forVisionTasks(WASM_PATH);
    const create = (delegate: "GPU" | "CPU") =>
      FaceLandmarker.createFromOptions(files, {
        baseOptions: { modelAssetPath: MODEL_URL, delegate },
        runningMode: "VIDEO",
        numFaces: 1,
      });
    try {
      return await create("GPU");
    } catch {
      return await create("CPU");
    }
  })().catch((error: unknown) => {
    shared = null;
    throw error;
  });
  return shared;
}

/** The most recent tracking result, read every frame by the AR overlay. */
export interface FaceFrame {
  landmarks: NormalizedLandmark[] | null;
  width: number;
  height: number;
  at: number;
}

export type CameraStatus = "idle" | "starting" | "live" | "error";

function describeCameraError(error: unknown): string {
  const name = error instanceof DOMException ? error.name : "";
  if (name === "NotAllowedError" || name === "SecurityError")
    return "Camera access was blocked. You can allow it from the address bar, or use the mannequin instead.";
  if (name === "NotFoundError" || name === "OverconstrainedError") return "No camera was found on this device.";
  if (name === "NotReadableError") return "The camera is busy in another app. Close it and try again.";
  return "The mirror couldn't start. Check your connection and try again.";
}

export function useFaceCamera() {
  const videoRef = useRef<HTMLVideoElement>(null);
  const frame = useRef<FaceFrame>({ landmarks: null, width: 0, height: 0, at: 0 });
  const [status, setStatus] = useState<CameraStatus>("idle");
  const [error, setError] = useState<string | null>(null);
  const session = useRef<{ stop: () => void } | null>(null);

  const stop = useCallback(() => {
    session.current?.stop();
    session.current = null;
    frame.current = { landmarks: null, width: 0, height: 0, at: 0 };
  }, []);

  const start = useCallback(async () => {
    stop();
    setError(null);
    setStatus("starting");

    let stopped = false;
    let stream: MediaStream | null = null;
    let raf = 0;
    const thisSession = {
      stop: () => {
        stopped = true;
        cancelAnimationFrame(raf);
        stream?.getTracks().forEach((track) => track.stop());
        if (videoRef.current) videoRef.current.srcObject = null;
      },
    };
    session.current = thisSession;

    try {
      if (!navigator.mediaDevices?.getUserMedia) throw new DOMException("No camera API", "NotFoundError");
      const [media, landmarker] = await Promise.all([
        navigator.mediaDevices.getUserMedia({
          audio: false,
          video: { facingMode: "user", width: { ideal: 1280 }, height: { ideal: 720 } },
        }),
        loadFaceLandmarker(),
      ]);
      stream = media;
      const video = videoRef.current;
      if (stopped || !video) {
        thisSession.stop();
        return;
      }
      video.srcObject = stream;
      await video.play();

      let lastTime = -1;
      const track = () => {
        if (stopped) return;
        if (video.readyState >= 2 && video.currentTime !== lastTime) {
          lastTime = video.currentTime;
          const now = performance.now();
          const result = landmarker.detectForVideo(video, now);
          frame.current = {
            landmarks: result.faceLandmarks[0] ?? null,
            width: video.videoWidth,
            height: video.videoHeight,
            at: now,
          };
        }
        raf = requestAnimationFrame(track);
      };
      raf = requestAnimationFrame(track);
      setStatus("live");
    } catch (cause) {
      thisSession.stop();
      if (session.current === thisSession) session.current = null;
      setError(describeCameraError(cause));
      setStatus("error");
    }
  }, [stop]);

  // Always release the camera when the mirror closes.
  useEffect(() => stop, [stop]);

  return { videoRef, frame, status, error, start, stop };
}
