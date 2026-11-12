"use client";

import { useCallback, useEffect, useRef, useState, useSyncExternalStore } from "react";
import { stopSpeaking } from "@/lib/client/speech";

// Push-to-talk speech recognition (Chrome, Edge and Safari). Typing always
// works too, so voice is optional.

interface RecognitionResult {
  isFinal: boolean;
  0: { transcript: string };
}

interface RecognitionEvent {
  resultIndex: number;
  results: ArrayLike<RecognitionResult>;
}

interface Recognition {
  lang: string;
  interimResults: boolean;
  continuous: boolean;
  maxAlternatives: number;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
}

type RecognitionConstructor = new () => Recognition;

function recognitionConstructor(): RecognitionConstructor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionConstructor;
    webkitSpeechRecognition?: RecognitionConstructor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

const noopSubscribe = () => () => undefined;

export function useListen(onFinal: (text: string) => void, lang = "en-US") {
  const supported = useSyncExternalStore(
    noopSubscribe,
    () => recognitionConstructor() !== null,
    () => false,
  );
  const [listening, setListening] = useState(false);
  const [interim, setInterim] = useState("");
  const [error, setError] = useState<string | null>(null);
  const recognition = useRef<Recognition | null>(null);
  const onFinalRef = useRef(onFinal);

  useEffect(() => {
    onFinalRef.current = onFinal;
  }, [onFinal]);

  const start = useCallback(() => {
    const Ctor = recognitionConstructor();
    if (!Ctor || recognition.current) return;
    stopSpeaking(); // never let a robot hear itself

    const rec = new Ctor();
    rec.lang = lang;
    rec.interimResults = true;
    rec.continuous = false;
    rec.maxAlternatives = 1;
    rec.onresult = (event) => {
      let finalText = "";
      let interimText = "";
      for (let i = event.resultIndex; i < event.results.length; i++) {
        const result = event.results[i];
        if (result.isFinal) finalText += result[0].transcript;
        else interimText += result[0].transcript;
      }
      setInterim(interimText);
      if (finalText.trim()) onFinalRef.current(finalText.trim());
    };
    rec.onerror = (event) => {
      if (event.error !== "aborted" && event.error !== "no-speech") {
        setError(event.error === "not-allowed" ? "Microphone access was blocked." : "I couldn't hear that.");
      }
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
      setInterim("");
    };

    recognition.current = rec;
    setError(null);
    setListening(true);
    try {
      rec.start();
    } catch {
      recognition.current = null;
      setListening(false);
    }
  }, [lang]);

  const stop = useCallback(() => recognition.current?.stop(), []);

  useEffect(() => () => recognition.current?.abort(), []);

  return { supported, listening, interim, error, start, stop };
}
