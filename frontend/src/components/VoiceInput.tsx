import React, { useState, useRef, useCallback, useEffect } from "react";
import { Mic, MicOff, Loader2, AlertCircle } from "lucide-react";
import { cn } from "../lib/utils";
import { getVoiceWsUrl } from "../services/api";
import { useConsentStatus } from "../hooks/useConsentStatus";
import type { VoiceTranscriptEvent } from "../types";

// ── Types ──────────────────────────────────────────────────────────────

interface VoiceInputProps {
  onTranscript: (text: string) => void;
  onPartialTranscript?: (text: string) => void;
  language?: string;
  disabled?: boolean;
  className?: string;
}

type RecordingState = "idle" | "recording" | "processing";

// ── Helpers ────────────────────────────────────────────────────────────

function formatDuration(seconds: number): string {
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return `${m}:${s.toString().padStart(2, "0")}`;
}

/** Preferred MIME for MediaRecorder — pick first supported format. */
function getPreferredMime(): string {
  const candidates = [
    "audio/webm;codecs=opus",
    "audio/webm",
    "audio/ogg;codecs=opus",
    "audio/mp4",
  ];
  for (const mime of candidates) {
    if (MediaRecorder.isTypeSupported(mime)) return mime;
  }
  return "";
}

// ── Component ──────────────────────────────────────────────────────────

const VoiceInput: React.FC<VoiceInputProps> = ({
  onTranscript,
  onPartialTranscript,
  language = "en-IN",
  disabled = false,
  className,
}) => {
  const { isVoiceEnabled, loading: consentLoading } = useConsentStatus();

  const [state, setState] = useState<RecordingState>("idle");
  const [error, setError] = useState<string | null>(null);
  const [duration, setDuration] = useState(0);

  const wsRef = useRef<WebSocket | null>(null);
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const unmountedRef = useRef(false);

  // ── Cleanup on unmount ─────────────────────────────────────────────
  useEffect(() => {
    unmountedRef.current = false;
    return () => {
      unmountedRef.current = true;
      stopRecording();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // ── Stop everything ────────────────────────────────────────────────
  const stopRecording = useCallback(() => {
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }

    if (recorderRef.current && recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
    recorderRef.current = null;

    if (streamRef.current) {
      streamRef.current.getTracks().forEach((t) => t.stop());
      streamRef.current = null;
    }

    if (wsRef.current) {
      const ws = wsRef.current;
      wsRef.current = null;
      // Send flush + stop before closing
      if (ws.readyState === WebSocket.OPEN) {
        try {
          ws.send(JSON.stringify({ type: "flush" }));
          ws.send(JSON.stringify({ type: "stop" }));
        } catch {
          // ignore — socket may already be closing
        }
      }
      if (
        ws.readyState === WebSocket.OPEN ||
        ws.readyState === WebSocket.CONNECTING
      ) {
        ws.close();
      }
    }

    if (!unmountedRef.current) {
      setState("idle");
      setDuration(0);
    }
  }, []);

  // ── Start recording ────────────────────────────────────────────────
  const startRecording = useCallback(async () => {
    setError(null);

    // 1. Check MediaRecorder support
    if (typeof MediaRecorder === "undefined") {
      setError("Your browser does not support audio recording.");
      return;
    }

    // 2. Request mic permission
    let stream: MediaStream;
    try {
      stream = await navigator.mediaDevices.getUserMedia({ audio: true });
    } catch (err: any) {
      if (err.name === "NotAllowedError" || err.name === "PermissionDeniedError") {
        setError(
          "Microphone access denied. Please allow microphone access in your browser settings.",
        );
      } else {
        setError("Could not access microphone. Please check your device.");
      }
      return;
    }

    if (unmountedRef.current) {
      stream.getTracks().forEach((t) => t.stop());
      return;
    }

    streamRef.current = stream;

    // 3. Open WebSocket
    const wsUrl = getVoiceWsUrl("transcribe");
    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.onopen = () => {
      if (unmountedRef.current) {
        ws.close();
        return;
      }

      // Send config message
      ws.send(
        JSON.stringify({
          type: "config",
          language,
          format: getPreferredMime() || "audio/webm",
        }),
      );

      // 4. Start MediaRecorder
      const mimeType = getPreferredMime();
      const recorder = new MediaRecorder(stream, {
        ...(mimeType ? { mimeType } : {}),
        audioBitsPerSecond: 64_000,
      });
      recorderRef.current = recorder;

      recorder.ondataavailable = (e: BlobEvent) => {
        if (e.data.size > 0 && ws.readyState === WebSocket.OPEN) {
          ws.send(e.data);
        }
      };

      recorder.onerror = () => {
        if (!unmountedRef.current) {
          setError("Recording error. Please try again.");
        }
        stopRecording();
      };

      recorder.start(250); // Send chunks every 250ms
      setState("recording");
      setDuration(0);

      // Start duration counter
      timerRef.current = setInterval(() => {
        if (!unmountedRef.current) {
          setDuration((d) => d + 1);
        }
      }, 1000);
    };

    ws.onmessage = (event: MessageEvent) => {
      if (unmountedRef.current) return;
      try {
        const data: VoiceTranscriptEvent = JSON.parse(event.data);
        switch (data.type) {
          case "partial":
            onPartialTranscript?.(data.text ?? "");
            break;
          case "final":
            if (data.text) {
              onTranscript(data.text);
            }
            onPartialTranscript?.("");
            break;
          case "error":
            setError(
              data.message || "Transcription failed. Please try again or type your answer.",
            );
            stopRecording();
            break;
          case "ready":
            // Server acknowledged config — no action needed
            break;
        }
      } catch {
        // Non-JSON message — ignore
      }
    };

    ws.onerror = () => {
      if (!unmountedRef.current) {
        setError("Voice service unavailable. Please type your answer.");
      }
      stopRecording();
    };

    ws.onclose = () => {
      if (!unmountedRef.current && state === "recording") {
        setState("idle");
      }
    };
  }, [language, onTranscript, onPartialTranscript, stopRecording, state]);

  // ── Toggle handler ─────────────────────────────────────────────────
  const handleToggle = useCallback(() => {
    if (state === "recording") {
      setState("processing");
      stopRecording();
    } else if (state === "idle") {
      startRecording();
    }
  }, [state, startRecording, stopRecording]);

  // ── Don't render until consent is resolved ─────────────────────────
  if (consentLoading) return null;
  if (!isVoiceEnabled) return null;

  const isDisabled = disabled || state === "processing";

  return (
    <div className={cn("inline-flex items-center gap-2", className)}>
      {/* Mic button */}
      <button
        type="button"
        onClick={handleToggle}
        disabled={isDisabled}
        aria-label={
          state === "recording"
            ? "Stop recording"
            : state === "processing"
              ? "Processing audio"
              : "Start voice input"
        }
        className={cn(
          "relative flex h-9 w-9 items-center justify-center rounded-full transition-all",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
          "disabled:pointer-events-none disabled:opacity-50",
          state === "recording"
            ? "bg-red-500 text-white hover:bg-red-600 shadow-md"
            : state === "processing"
              ? "bg-muted text-muted-foreground"
              : "bg-secondary text-secondary-foreground hover:bg-secondary/80",
        )}
      >
        {/* Pulse ring while recording */}
        {state === "recording" && (
          <span className="absolute inset-0 animate-ping rounded-full bg-red-400 opacity-40" />
        )}

        {state === "processing" ? (
          <Loader2 className="h-4 w-4 animate-spin" />
        ) : state === "recording" ? (
          <MicOff className="relative z-10 h-4 w-4" />
        ) : (
          <Mic className="h-4 w-4" />
        )}
      </button>

      {/* Recording duration */}
      {state === "recording" && (
        <span className="text-xs font-medium tabular-nums text-red-500">
          {formatDuration(duration)}
        </span>
      )}

      {/* Speak now prompt */}
      {state === "recording" && duration === 0 && (
        <span className="text-xs text-muted-foreground">Speak now...</span>
      )}

      {/* Error message */}
      {error && state === "idle" && (
        <span className="inline-flex items-center gap-1 text-xs text-destructive">
          <AlertCircle className="h-3 w-3 shrink-0" />
          {error}
        </span>
      )}
    </div>
  );
};

export default VoiceInput;
