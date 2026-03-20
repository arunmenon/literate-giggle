import React, { useState, useEffect, useRef, useCallback } from "react";
import { Mic, MicOff } from "lucide-react";
import { cn } from "../lib/utils";

// ── Types ──────────────────────────────────────────────────────────────
interface VoiceNavigationProps {
  onNext: () => void;
  onPrevious: () => void;
  onFlag: () => void;
  onGoTo: (questionNumber: number) => void;
  onSubmit: () => void;
  enabled: boolean;
  totalQuestions: number;
}

interface VoiceCommand {
  pattern: RegExp;
  action: string;
  handler: (match: RegExpMatchArray) => void;
}

// ── Feature detection ──────────────────────────────────────────────────
const SpeechRecognitionAPI =
  typeof window !== "undefined"
    ? (window as any).SpeechRecognition || (window as any).webkitSpeechRecognition
    : null;

// ── Component ──────────────────────────────────────────────────────────
const VoiceNavigation: React.FC<VoiceNavigationProps> = ({
  onNext,
  onPrevious,
  onFlag,
  onGoTo,
  onSubmit,
  enabled,
  totalQuestions,
}) => {
  const [listening, setListening] = useState(false);
  const [lastCommand, setLastCommand] = useState<string | null>(null);
  const [showToast, setShowToast] = useState(false);
  const recognitionRef = useRef<any>(null);
  const toastTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Hide component entirely if browser lacks support or consent not given
  if (!SpeechRecognitionAPI || !enabled) return null;

  // Build command table (stable across renders via useCallback on handlers)
  const commands: VoiceCommand[] = [
    {
      pattern: /\b(?:next\s*(?:question)?|go\s*next)\b/i,
      action: "Next question",
      handler: () => onNext(),
    },
    {
      pattern: /\b(?:previous\s*(?:question)?|go\s*(?:back|prev(?:ious)?))\b/i,
      action: "Previous question",
      handler: () => onPrevious(),
    },
    {
      pattern: /\b(?:flag\s*(?:this|question)?|mark\s*(?:this|question)?)\b/i,
      action: "Flag question",
      handler: () => onFlag(),
    },
    {
      pattern: /\b(?:go\s*to\s*(?:question\s*)?|question\s*(?:number\s*)?)(\d+)\b/i,
      action: "Go to question",
      handler: (match: RegExpMatchArray) => {
        const num = parseInt(match[1], 10);
        if (num >= 1 && num <= totalQuestions) {
          onGoTo(num);
        }
      },
    },
    {
      pattern: /\b(?:submit\s*(?:exam|paper|test)?|finish\s*(?:exam|paper|test)?)\b/i,
      action: "Submit exam",
      handler: () => onSubmit(),
    },
  ];

  const showCommandToast = useCallback((command: string) => {
    setLastCommand(command);
    setShowToast(true);
    if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    toastTimerRef.current = setTimeout(() => setShowToast(false), 2000);
  }, []);

  const processTranscript = useCallback(
    (transcript: string) => {
      const normalised = transcript.toLowerCase().trim();
      for (const cmd of commands) {
        const match = normalised.match(cmd.pattern);
        if (match) {
          cmd.handler(match);
          const label =
            cmd.action === "Go to question"
              ? `Go to question ${match[1]}`
              : cmd.action;
          showCommandToast(label);
          return;
        }
      }
      // No match — show what was heard for feedback
      showCommandToast(`"${transcript}" — not recognised`);
    },
    [commands, showCommandToast],
  );

  const startListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.abort();
    }

    const recognition = new SpeechRecognitionAPI();
    recognition.continuous = false;
    recognition.interimResults = false;
    recognition.lang = "en-IN";

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: any) => {
      const transcript = event.results[0]?.[0]?.transcript ?? "";
      if (transcript) processTranscript(transcript);
    };

    recognition.onerror = (event: any) => {
      // "no-speech" and "aborted" are non-fatal — just stop gracefully
      if (event.error !== "no-speech" && event.error !== "aborted") {
        console.warn("Speech recognition error:", event.error);
      }
      setListening(false);
    };

    recognition.onend = () => setListening(false);

    recognitionRef.current = recognition;
    recognition.start();
  }, [processTranscript]);

  const stopListening = useCallback(() => {
    recognitionRef.current?.abort();
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) {
      stopListening();
    } else {
      startListening();
    }
  }, [listening, startListening, stopListening]);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      recognitionRef.current?.abort();
      if (toastTimerRef.current) clearTimeout(toastTimerRef.current);
    };
  }, []);

  return (
    <>
      {/* Floating mic button — bottom-right */}
      <button
        type="button"
        onClick={toggleListening}
        aria-label={listening ? "Stop voice navigation" : "Start voice navigation"}
        className={cn(
          "fixed bottom-6 right-6 z-50 flex items-center justify-center",
          "h-14 w-14 rounded-full shadow-lg transition-all duration-200",
          "focus:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          listening
            ? "bg-destructive text-destructive-foreground hover:bg-destructive/90"
            : "bg-primary text-primary-foreground hover:bg-primary/90",
        )}
      >
        {listening ? <MicOff className="h-6 w-6" /> : <Mic className="h-6 w-6" />}

        {/* Pulse animation when listening */}
        {listening && (
          <>
            <span className="absolute inset-0 rounded-full bg-destructive/40 animate-ping" />
            <span className="absolute inset-[-4px] rounded-full border-2 border-destructive/30 animate-pulse" />
          </>
        )}
      </button>

      {/* Command toast notification */}
      {showToast && lastCommand && (
        <div
          className={cn(
            "fixed bottom-24 right-6 z-50",
            "px-4 py-2.5 rounded-lg shadow-lg",
            "bg-card border border-border",
            "text-sm font-medium text-foreground",
            "animate-in fade-in slide-in-from-bottom-2 duration-200",
          )}
          role="status"
          aria-live="polite"
        >
          <div className="flex items-center gap-2">
            <Mic className="h-3.5 w-3.5 text-primary flex-shrink-0" />
            <span>{lastCommand}</span>
          </div>
        </div>
      )}
    </>
  );
};

export default VoiceNavigation;
