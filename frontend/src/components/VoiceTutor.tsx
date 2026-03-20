import React, { useState, useRef, useEffect, useCallback } from "react";
import { cn } from "../lib/utils";
import { Button } from "./ui/Button";
import { MathText } from "./MathText";
import {
  Mic,
  MicOff,
  Square,
  Volume2,
  VolumeX,
  Bot,
  User,
  Loader2,
  Clock,
  Copy,
  Check,
  Radio,
  X,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                              */
/* ------------------------------------------------------------------ */

type VoiceTutorState =
  | "connecting"
  | "idle"
  | "listening"
  | "processing"
  | "speaking";

type InputMode = "push_to_talk" | "continuous";

interface TranscriptMessage {
  id: string;
  role: "user" | "assistant";
  text: string;
  timestamp: Date;
}

interface VoiceTutorProps {
  topic: string;
  onClose: () => void;
}

/* ------------------------------------------------------------------ */
/*  Constants                                                          */
/* ------------------------------------------------------------------ */

const PLAYBACK_SPEEDS = [0.75, 1, 1.25, 1.5] as const;
const MAX_SESSION_SECONDS = 15 * 60; // 15 minutes

/* ------------------------------------------------------------------ */
/*  Helpers                                                            */
/* ------------------------------------------------------------------ */

function formatDuration(totalSeconds: number): string {
  const minutes = Math.floor(totalSeconds / 60);
  const seconds = totalSeconds % 60;
  return `${String(minutes).padStart(2, "0")}:${String(seconds).padStart(2, "0")}`;
}

/* ------------------------------------------------------------------ */
/*  Component                                                          */
/* ------------------------------------------------------------------ */

const VoiceTutor: React.FC<VoiceTutorProps> = ({ topic, onClose }) => {
  // Connection and state
  const [state, setState] = useState<VoiceTutorState>("connecting");
  const [inputMode, setInputMode] = useState<InputMode>("push_to_talk");
  const [transcript, setTranscript] = useState<TranscriptMessage[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  // Audio playback
  const [playbackSpeed, setPlaybackSpeed] = useState<number>(1);
  const [isAudioMuted, setIsAudioMuted] = useState(false);

  // Session timer
  const [elapsedSeconds, setElapsedSeconds] = useState(0);

  // Refs
  const wsRef = useRef<WebSocket | null>(null);
  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const mediaStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const audioQueueRef = useRef<ArrayBuffer[]>([]);
  const currentAudioSourceRef = useRef<AudioBufferSourceNode | null>(null);
  const transcriptEndRef = useRef<HTMLDivElement>(null);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const isHoldingRef = useRef(false);
  const sessionActiveRef = useRef(true);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [transcript]);

  // Session timer
  useEffect(() => {
    timerRef.current = setInterval(() => {
      setElapsedSeconds((prev) => {
        if (prev + 1 >= MAX_SESSION_SECONDS) {
          handleEndSession();
          return prev;
        }
        return prev + 1;
      });
    }, 1000);
    return () => {
      if (timerRef.current) clearInterval(timerRef.current);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  /* ---- WebSocket connection ---- */

  const connectWebSocket = useCallback(() => {
    const token = localStorage.getItem("token");
    if (!token) {
      setError("Authentication required. Please log in again.");
      setState("idle");
      return;
    }

    const protocol = window.location.protocol === "https:" ? "wss:" : "ws:";
    const host = window.location.host;
    const wsUrl = `${protocol}//${host}/api/voice/tutor?token=${encodeURIComponent(token)}`;

    const ws = new WebSocket(wsUrl);
    wsRef.current = ws;

    ws.binaryType = "arraybuffer";

    ws.onopen = () => {
      setState("idle");
      setError(null);
      // Send start message with topic
      ws.send(JSON.stringify({ type: "start", topic }));
    };

    ws.onmessage = (event) => {
      if (event.data instanceof ArrayBuffer) {
        // Binary audio data from TTS
        handleAudioData(event.data);
        return;
      }

      try {
        const message = JSON.parse(event.data);
        handleServerMessage(message);
      } catch {
        // Ignore unparseable messages
      }
    };

    ws.onerror = () => {
      setError("Connection error. Please check your network and try again.");
      setState("idle");
    };

    ws.onclose = (event) => {
      if (sessionActiveRef.current) {
        if (event.code !== 1000) {
          setError("Connection lost. The session has ended.");
        }
        setState("idle");
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [topic]);

  useEffect(() => {
    connectWebSocket();
    return () => {
      sessionActiveRef.current = false;
      cleanup();
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [connectWebSocket]);

  /* ---- Server message handling ---- */

  const handleServerMessage = useCallback(
    (message: { type: string; role?: string; text?: string; message?: string }) => {
      switch (message.type) {
        case "transcript": {
          const role = message.role as "user" | "assistant";
          setTranscript((prev) => [
            ...prev,
            {
              id: `${role}-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
              role,
              text: message.text || "",
              timestamp: new Date(),
            },
          ]);
          if (role === "user") {
            setState("processing");
          }
          break;
        }
        case "audio_start":
          setState("speaking");
          audioQueueRef.current = [];
          break;
        case "audio_end":
          playAudioQueue();
          break;
        case "thinking":
          setState("processing");
          break;
        case "error":
          setError(message.message || "An error occurred");
          setState("idle");
          break;
        case "session_end":
          handleEndSession();
          break;
        default:
          break;
      }
    },
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  /* ---- Audio playback ---- */

  const getAudioContext = useCallback(() => {
    if (!audioContextRef.current) {
      audioContextRef.current = new AudioContext();
    }
    return audioContextRef.current;
  }, []);

  const handleAudioData = useCallback((data: ArrayBuffer) => {
    audioQueueRef.current.push(data);
  }, []);

  const playAudioQueue = useCallback(async () => {
    if (isAudioMuted || audioQueueRef.current.length === 0) {
      setState("idle");
      return;
    }

    const context = getAudioContext();

    // Concatenate all audio chunks
    const totalLength = audioQueueRef.current.reduce(
      (sum, buf) => sum + buf.byteLength,
      0,
    );
    const combined = new Uint8Array(totalLength);
    let offset = 0;
    for (const buf of audioQueueRef.current) {
      combined.set(new Uint8Array(buf), offset);
      offset += buf.byteLength;
    }
    audioQueueRef.current = [];

    try {
      const audioBuffer = await context.decodeAudioData(combined.buffer);
      const source = context.createBufferSource();
      source.buffer = audioBuffer;
      source.playbackRate.value = playbackSpeed;
      source.connect(context.destination);
      currentAudioSourceRef.current = source;

      source.onended = () => {
        currentAudioSourceRef.current = null;
        setState("idle");
      };

      source.start(0);
    } catch {
      // If decoding fails (e.g. partial data), try playing as blob via Audio element
      try {
        const blob = new Blob([combined], { type: "audio/mp3" });
        const url = URL.createObjectURL(blob);
        const audio = new Audio(url);
        audio.playbackRate = playbackSpeed;
        audio.onended = () => {
          URL.revokeObjectURL(url);
          setState("idle");
        };
        audio.onerror = () => {
          URL.revokeObjectURL(url);
          setState("idle");
        };
        await audio.play();
      } catch {
        setState("idle");
      }
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [isAudioMuted, playbackSpeed, getAudioContext]);

  const stopAudioPlayback = useCallback(() => {
    if (currentAudioSourceRef.current) {
      try {
        currentAudioSourceRef.current.stop();
      } catch {
        // Already stopped
      }
      currentAudioSourceRef.current = null;
    }
    setState("idle");
  }, []);

  /* ---- Microphone / recording ---- */

  const startRecording = useCallback(async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({
        audio: {
          echoCancellation: true,
          noiseSuppression: true,
          sampleRate: 16000,
        },
      });
      mediaStreamRef.current = stream;

      const recorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = recorder;

      recorder.ondataavailable = (event) => {
        if (event.data.size > 0 && wsRef.current?.readyState === WebSocket.OPEN) {
          event.data.arrayBuffer().then((buffer) => {
            wsRef.current?.send(buffer);
          });
        }
      };

      recorder.start(250); // Send chunks every 250ms
      setState("listening");
    } catch (err) {
      const message =
        err instanceof DOMException && err.name === "NotAllowedError"
          ? "Microphone access denied. Please allow microphone access and try again."
          : "Failed to start recording. Please check your microphone.";
      setError(message);
    }
  }, []);

  const stopRecording = useCallback(() => {
    if (mediaRecorderRef.current && mediaRecorderRef.current.state !== "inactive") {
      mediaRecorderRef.current.stop();
    }
    if (mediaStreamRef.current) {
      mediaStreamRef.current.getTracks().forEach((track) => track.stop());
      mediaStreamRef.current = null;
    }
    mediaRecorderRef.current = null;
  }, []);

  /* ---- Push-to-talk handlers ---- */

  const handlePushToTalkDown = useCallback(() => {
    if (state !== "idle" && state !== "speaking") return;
    isHoldingRef.current = true;
    stopAudioPlayback();

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "start_speaking" }));
    }
    startRecording();
  }, [state, stopAudioPlayback, startRecording]);

  const handlePushToTalkUp = useCallback(() => {
    if (!isHoldingRef.current) return;
    isHoldingRef.current = false;

    stopRecording();
    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "stop_speaking" }));
    }
    setState("processing");
  }, [stopRecording]);

  /* ---- Continuous mode handlers ---- */

  const toggleContinuousListening = useCallback(() => {
    if (state === "listening") {
      stopRecording();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop_speaking" }));
      }
      setState("idle");
    } else if (state === "idle") {
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "start_speaking" }));
      }
      startRecording();
    }
  }, [state, stopRecording, startRecording]);

  /* ---- Mode toggle ---- */

  const toggleMode = useCallback(() => {
    // Stop any active recording first
    if (state === "listening") {
      stopRecording();
      if (wsRef.current?.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop_speaking" }));
      }
      setState("idle");
    }

    const newMode = inputMode === "push_to_talk" ? "continuous" : "push_to_talk";
    setInputMode(newMode);

    if (wsRef.current?.readyState === WebSocket.OPEN) {
      wsRef.current.send(JSON.stringify({ type: "mode", value: newMode }));
    }
  }, [inputMode, state, stopRecording]);

  /* ---- Session management ---- */

  const cleanup = useCallback(() => {
    stopRecording();
    stopAudioPlayback();
    if (wsRef.current) {
      if (wsRef.current.readyState === WebSocket.OPEN) {
        wsRef.current.send(JSON.stringify({ type: "stop" }));
      }
      wsRef.current.close();
      wsRef.current = null;
    }
    if (audioContextRef.current) {
      audioContextRef.current.close().catch(() => {});
      audioContextRef.current = null;
    }
    if (timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [stopRecording, stopAudioPlayback]);

  const handleEndSession = useCallback(() => {
    sessionActiveRef.current = false;
    cleanup();
    onClose();
  }, [cleanup, onClose]);

  /* ---- Copy transcript ---- */

  const copyTranscript = useCallback(() => {
    const text = transcript
      .map(
        (msg) =>
          `[${msg.role === "user" ? "You" : "Tutor"}] ${msg.text}`,
      )
      .join("\n\n");
    navigator.clipboard.writeText(text).then(() => {
      setCopied(true);
      setTimeout(() => setCopied(false), 2000);
    });
  }, [transcript]);

  /* ---- Playback speed cycle ---- */

  const cyclePlaybackSpeed = useCallback(() => {
    const currentIndex = PLAYBACK_SPEEDS.indexOf(
      playbackSpeed as (typeof PLAYBACK_SPEEDS)[number],
    );
    const nextIndex = (currentIndex + 1) % PLAYBACK_SPEEDS.length;
    setPlaybackSpeed(PLAYBACK_SPEEDS[nextIndex]);
  }, [playbackSpeed]);

  /* ---- Render ---- */

  const isConnected = state !== "connecting";
  const timeRemaining = MAX_SESSION_SECONDS - elapsedSeconds;
  const isTimeLow = timeRemaining <= 60;

  return (
    <div className="flex flex-col bg-card border rounded-lg shadow-xl h-full overflow-hidden">
      {/* Header */}
      <div className="flex items-center justify-between border-b px-4 py-3 bg-gradient-to-r from-primary/5 to-transparent">
        <div className="flex items-center gap-2 min-w-0">
          <div className="relative">
            <Bot className="h-5 w-5 text-primary" />
            {state === "listening" && (
              <span className="absolute -top-0.5 -right-0.5 h-2 w-2 rounded-full bg-red-500 animate-pulse" />
            )}
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-sm truncate">
              Voice Tutor
            </h3>
            <p className="text-[11px] text-muted-foreground truncate">
              {topic}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {/* Session timer */}
          <div
            className={cn(
              "flex items-center gap-1 text-xs font-mono tabular-nums px-2 py-0.5 rounded-full",
              isTimeLow
                ? "bg-destructive/10 text-destructive"
                : "bg-muted text-muted-foreground",
            )}
          >
            <Clock className="h-3 w-3" />
            {formatDuration(elapsedSeconds)}
          </div>
          {/* Close */}
          <button
            type="button"
            onClick={handleEndSession}
            className="rounded-md p-1.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
            aria-label="End voice session"
          >
            <X className="h-4 w-4" />
          </button>
        </div>
      </div>

      {/* Status bar */}
      <div className="flex items-center justify-between px-4 py-2 border-b bg-muted/30 text-xs">
        <div className="flex items-center gap-2">
          <StatusIndicator state={state} />
          <span className="text-muted-foreground capitalize">
            {state === "connecting"
              ? "Connecting..."
              : state === "listening"
                ? "Listening..."
                : state === "processing"
                  ? "Thinking..."
                  : state === "speaking"
                    ? "Speaking..."
                    : "Ready"}
          </span>
        </div>
        <div className="flex items-center gap-2">
          {/* Input mode toggle */}
          <button
            type="button"
            onClick={toggleMode}
            className={cn(
              "flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-medium transition-colors",
              inputMode === "continuous"
                ? "bg-green-500/15 text-green-700 dark:text-green-400"
                : "bg-muted text-muted-foreground hover:bg-muted/80",
            )}
            disabled={!isConnected}
          >
            <Radio className="h-3 w-3" />
            {inputMode === "push_to_talk" ? "Push-to-talk" : "Continuous"}
          </button>

          {/* Mute toggle */}
          <button
            type="button"
            onClick={() => setIsAudioMuted(!isAudioMuted)}
            className="rounded-md p-1 text-muted-foreground hover:text-foreground transition-colors"
            aria-label={isAudioMuted ? "Unmute" : "Mute"}
          >
            {isAudioMuted ? (
              <VolumeX className="h-3.5 w-3.5" />
            ) : (
              <Volume2 className="h-3.5 w-3.5" />
            )}
          </button>

          {/* Playback speed */}
          <button
            type="button"
            onClick={cyclePlaybackSpeed}
            className="rounded-md px-1.5 py-0.5 text-[11px] font-mono font-medium text-muted-foreground hover:text-foreground hover:bg-muted transition-colors"
            aria-label={`Playback speed: ${playbackSpeed}x`}
          >
            {playbackSpeed}x
          </button>
        </div>
      </div>

      {/* Transcript area */}
      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {/* Connecting state */}
        {state === "connecting" && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Loader2 className="h-8 w-8 animate-spin mb-3 opacity-60" />
            <p className="text-sm font-medium">Connecting to voice tutor...</p>
          </div>
        )}

        {/* Empty transcript */}
        {state !== "connecting" && transcript.length === 0 && (
          <div className="flex flex-col items-center justify-center h-full text-center text-muted-foreground">
            <Mic className="h-10 w-10 mb-3 opacity-30" />
            <p className="text-sm font-medium">
              {inputMode === "push_to_talk"
                ? "Hold the microphone button to speak"
                : "Tap the microphone button to start listening"}
            </p>
            <p className="text-xs mt-1 opacity-70">
              Ask questions about {topic}
            </p>
          </div>
        )}

        {/* Messages */}
        {transcript.map((msg) => (
          <div
            key={msg.id}
            className={cn(
              "flex gap-2",
              msg.role === "user" ? "justify-end" : "justify-start",
            )}
          >
            {msg.role === "assistant" && (
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
                <Bot className="h-4 w-4 text-primary" />
              </div>
            )}
            <div
              className={cn(
                "max-w-[80%] rounded-lg px-3 py-2 text-sm",
                msg.role === "user"
                  ? "bg-primary text-primary-foreground"
                  : "bg-muted text-foreground",
              )}
            >
              {msg.role === "assistant" ? (
                <MathText
                  text={msg.text}
                  as="p"
                  className="whitespace-pre-wrap"
                />
              ) : (
                <p className="whitespace-pre-wrap">{msg.text}</p>
              )}
              <span
                className={cn(
                  "block text-[10px] mt-1 opacity-60",
                  msg.role === "user"
                    ? "text-primary-foreground"
                    : "text-muted-foreground",
                )}
              >
                {msg.timestamp.toLocaleTimeString([], {
                  hour: "2-digit",
                  minute: "2-digit",
                })}
              </span>
            </div>
            {msg.role === "user" && (
              <div className="flex-shrink-0 h-7 w-7 rounded-full bg-muted flex items-center justify-center">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>
            )}
          </div>
        ))}

        {/* Processing indicator */}
        {state === "processing" && (
          <div className="flex gap-2">
            <div className="flex-shrink-0 h-7 w-7 rounded-full bg-primary/10 flex items-center justify-center">
              <Bot className="h-4 w-4 text-primary" />
            </div>
            <div className="bg-muted rounded-lg px-3 py-2">
              <div className="flex items-center gap-1.5">
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:0ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:150ms]" />
                <span className="h-1.5 w-1.5 rounded-full bg-primary animate-bounce [animation-delay:300ms]" />
              </div>
            </div>
          </div>
        )}

        <div ref={transcriptEndRef} />
      </div>

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-2 rounded-md border border-destructive/30 bg-destructive/10 px-3 py-2 text-xs text-destructive flex items-center justify-between">
          <span>{error}</span>
          <button
            type="button"
            onClick={() => setError(null)}
            className="ml-2 hover:text-destructive/80"
          >
            <X className="h-3 w-3" />
          </button>
        </div>
      )}

      {/* Controls bar */}
      <div className="border-t px-4 py-3 bg-muted/20">
        <div className="flex items-center justify-between">
          {/* Copy transcript */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5"
            onClick={copyTranscript}
            disabled={transcript.length === 0}
          >
            {copied ? (
              <Check className="h-3.5 w-3.5" />
            ) : (
              <Copy className="h-3.5 w-3.5" />
            )}
            {copied ? "Copied" : "Copy"}
          </Button>

          {/* Main mic button */}
          <div className="flex items-center gap-3">
            {state === "speaking" && (
              <Button
                variant="outline"
                size="icon"
                className="h-9 w-9 rounded-full"
                onClick={stopAudioPlayback}
                aria-label="Stop playback"
              >
                <Square className="h-4 w-4" />
              </Button>
            )}

            {inputMode === "push_to_talk" ? (
              <button
                type="button"
                onMouseDown={handlePushToTalkDown}
                onMouseUp={handlePushToTalkUp}
                onMouseLeave={handlePushToTalkUp}
                onTouchStart={(e) => {
                  e.preventDefault();
                  handlePushToTalkDown();
                }}
                onTouchEnd={(e) => {
                  e.preventDefault();
                  handlePushToTalkUp();
                }}
                disabled={
                  !isConnected || state === "processing"
                }
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200 select-none touch-none",
                  state === "listening"
                    ? "bg-red-500 text-white scale-110 shadow-lg shadow-red-500/30 animate-pulse"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                  (!isConnected || state === "processing") &&
                    "opacity-50 cursor-not-allowed",
                )}
                aria-label="Hold to speak"
              >
                {state === "listening" ? (
                  <Mic className="h-6 w-6" />
                ) : state === "processing" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </button>
            ) : (
              <button
                type="button"
                onClick={toggleContinuousListening}
                disabled={
                  !isConnected || state === "processing"
                }
                className={cn(
                  "flex h-14 w-14 items-center justify-center rounded-full transition-all duration-200",
                  state === "listening"
                    ? "bg-green-500 text-white shadow-lg shadow-green-500/30"
                    : "bg-primary text-primary-foreground hover:bg-primary/90 shadow-md",
                  (!isConnected || state === "processing") &&
                    "opacity-50 cursor-not-allowed",
                )}
                aria-label={
                  state === "listening" ? "Stop listening" : "Start listening"
                }
              >
                {state === "listening" ? (
                  <MicOff className="h-6 w-6" />
                ) : state === "processing" ? (
                  <Loader2 className="h-6 w-6 animate-spin" />
                ) : (
                  <Mic className="h-6 w-6" />
                )}
              </button>
            )}
          </div>

          {/* End session */}
          <Button
            variant="ghost"
            size="sm"
            className="h-8 text-xs gap-1.5 text-destructive hover:text-destructive hover:bg-destructive/10"
            onClick={handleEndSession}
          >
            <Square className="h-3.5 w-3.5" />
            End
          </Button>
        </div>

        {/* Push-to-talk hint */}
        {inputMode === "push_to_talk" && state === "idle" && (
          <p className="text-center text-[11px] text-muted-foreground mt-2">
            Hold the button to speak, release to send
          </p>
        )}
      </div>
    </div>
  );
};

/* ------------------------------------------------------------------ */
/*  Status indicator sub-component                                     */
/* ------------------------------------------------------------------ */

const StatusIndicator: React.FC<{ state: VoiceTutorState }> = ({ state }) => {
  const colors: Record<VoiceTutorState, string> = {
    connecting: "bg-amber-500",
    idle: "bg-green-500",
    listening: "bg-red-500",
    processing: "bg-amber-500",
    speaking: "bg-blue-500",
  };

  return (
    <span
      className={cn(
        "h-2 w-2 rounded-full",
        colors[state],
        (state === "listening" || state === "connecting") && "animate-pulse",
      )}
    />
  );
};

export { VoiceTutor };
export type { VoiceTutorProps };
