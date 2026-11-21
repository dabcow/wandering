"use client";

import { useCallback, useEffect, useRef, useState } from "react";

/* Minimal typings for the Web Speech API, which is not in every TS DOM lib. */
type RecognitionResult = { isFinal: boolean; 0: { transcript: string } };
type RecognitionEvent = { results: { length: number; [index: number]: RecognitionResult } };
type Recognition = {
  continuous: boolean;
  interimResults: boolean;
  lang: string;
  onresult: ((event: RecognitionEvent) => void) | null;
  onerror: ((event: { error: string }) => void) | null;
  onend: (() => void) | null;
  start(): void;
  stop(): void;
  abort(): void;
};
type RecognitionCtor = new () => Recognition;

function getRecognitionCtor(): RecognitionCtor | null {
  if (typeof window === "undefined") return null;
  const w = window as unknown as {
    SpeechRecognition?: RecognitionCtor;
    webkitSpeechRecognition?: RecognitionCtor;
  };
  return w.SpeechRecognition ?? w.webkitSpeechRecognition ?? null;
}

function join(base: string, spoken: string): string {
  if (!spoken) return base;
  if (!base) return spoken;
  return /\s$/.test(base) ? base + spoken : `${base} ${spoken}`;
}

/**
 * Dictation into a controlled text value. While listening, the transcript is
 * appended live to the text that was there when listening started (or when
 * the user last edited by hand).
 */
export function useDictation(value: string, onChange: (value: string) => void) {
  const [supported, setSupported] = useState(false);
  const [listening, setListening] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const recognition = useRef<Recognition | null>(null);
  const base = useRef("");
  const fromIndex = useRef(0);
  const seenResults = useRef(0);
  const latest = useRef({ value, onChange });

  useEffect(() => {
    latest.current = { value, onChange };
  });

  useEffect(() => {
    setSupported(getRecognitionCtor() !== null);
    return () => recognition.current?.abort();
  }, []);

  const stop = useCallback(() => {
    recognition.current?.stop();
  }, []);

  const start = useCallback(() => {
    const Ctor = getRecognitionCtor();
    if (!Ctor || recognition.current) return;
    setError(null);

    const rec = new Ctor();
    rec.continuous = true;
    rec.interimResults = true;
    rec.lang = navigator.language || "en-US";
    base.current = latest.current.value;
    fromIndex.current = 0;
    seenResults.current = 0;

    rec.onresult = (event) => {
      let spoken = "";
      for (let i = fromIndex.current; i < event.results.length; i++) {
        spoken += event.results[i][0].transcript;
      }
      seenResults.current = event.results.length;
      latest.current.onChange(join(base.current, spoken.trim()));
    };
    rec.onerror = (event) => {
      if (event.error === "not-allowed" || event.error === "service-not-allowed") {
        setError("Microphone access was blocked. Allow it in your browser to dictate.");
      } else if (event.error === "audio-capture") {
        setError("No microphone was found.");
      } else if (event.error === "network") {
        setError("Voice recognition needs a network connection.");
      } else if (event.error !== "no-speech" && event.error !== "aborted") {
        setError(`Voice input stopped (${event.error}).`);
      }
    };
    rec.onend = () => {
      recognition.current = null;
      setListening(false);
    };

    try {
      rec.start();
      recognition.current = rec;
      setListening(true);
    } catch {
      setError("Could not start voice input.");
    }
  }, []);

  /** Call when the user edits the text by hand so dictation continues from their version. */
  const rebase = useCallback((edited: string) => {
    base.current = edited;
    fromIndex.current = seenResults.current;
  }, []);

  return { supported, listening, error, start, stop, rebase };
}
