import React, { useState, useRef, useCallback } from "react";
import { voiceAPI } from "../services/api";
import {
  Button,
  Card,
  CardContent,
  Badge,
  useToast,
} from "./ui";
import { cn } from "../lib/utils";
import { Mic, MicOff, Loader2, CheckCircle, RotateCcw } from "lucide-react";

export interface DictationIntent {
  action?: string;
  subject?: string;
  topic?: string;
  chapter?: string;
  question_type?: string;
  difficulty?: string;
  count?: number;
}

interface VoiceDictationProps {
  onIntentParsed: (intent: DictationIntent) => void;
}

type DictationState = "idle" | "recording" | "transcribing" | "parsed";

export const VoiceDictation: React.FC<VoiceDictationProps> = ({
  onIntentParsed,
}) => {
  const [state, setState] = useState<DictationState>("idle");
  const [transcript, setTranscript] = useState<string | null>(null);
  const [intent, setIntent] = useState<DictationIntent | null>(null);
  const [error, setError] = useState<string | null>(null);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);

  const { toast } = useToast();

  const startRecording = useCallback(async () => {
    setError(null);
    setTranscript(null);
    setIntent(null);

    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      streamRef.current = stream;

      const mediaRecorder = new MediaRecorder(stream, {
        mimeType: MediaRecorder.isTypeSupported("audio/webm;codecs=opus")
          ? "audio/webm;codecs=opus"
          : "audio/webm",
      });
      mediaRecorderRef.current = mediaRecorder;
      chunksRef.current = [];

      mediaRecorder.ondataavailable = (event) => {
        if (event.data.size > 0) {
          chunksRef.current.push(event.data);
        }
      };

      mediaRecorder.onstop = async () => {
        // Stop all tracks
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          setError("No audio recorded. Please try again.");
          setState("idle");
          return;
        }

        setState("transcribing");

        try {
          const audioFile = new File([audioBlob], "dictation.webm", {
            type: "audio/webm",
          });
          const { data } = await voiceAPI.dictateQuestion(audioFile);
          setTranscript(data.transcript);
          setIntent(data.intent);
          setState("parsed");
          onIntentParsed(data.intent);
        } catch (err: any) {
          const message =
            err.response?.data?.detail || "Failed to process voice dictation.";
          setError(message);
          toast(message, "error");
          setState("idle");
        }
      };

      mediaRecorder.start(250); // collect data every 250ms
      setState("recording");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        setError("Microphone permission denied. Please allow access and retry.");
      } else {
        setError("Could not access microphone.");
      }
      setState("idle");
    }
  }, [onIntentParsed, toast]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const reset = useCallback(() => {
    setState("idle");
    setTranscript(null);
    setIntent(null);
    setError(null);
  }, []);

  // Mic button -- pulsing when recording
  const micButton = (
    <Button
      variant={state === "recording" ? "destructive" : "outline"}
      size="icon"
      onClick={state === "recording" ? stopRecording : startRecording}
      disabled={state === "transcribing"}
      className={cn(
        "relative h-9 w-9 rounded-full",
        state === "recording" && "animate-pulse",
      )}
      title={
        state === "recording"
          ? "Stop recording"
          : "Dictate question with voice"
      }
    >
      {state === "transcribing" ? (
        <Loader2 className="h-4 w-4 animate-spin" />
      ) : state === "recording" ? (
        <MicOff className="h-4 w-4" />
      ) : (
        <Mic className="h-4 w-4" />
      )}
    </Button>
  );

  // Compact view: just the mic button when idle with no previous result
  if (state === "idle" && !transcript && !error) {
    return micButton;
  }

  return (
    <div className="flex items-start gap-2">
      {micButton}

      {/* Feedback card shown during/after dictation */}
      {(state !== "idle" || transcript || error) && (
        <Card className="flex-1 border-primary/20 bg-primary/[0.02]">
          <CardContent className="p-3 space-y-2">
            {/* Recording indicator */}
            {state === "recording" && (
              <div className="flex items-center gap-2 text-sm text-red-600 dark:text-red-400">
                <span className="h-2 w-2 rounded-full bg-red-500 animate-pulse" />
                Listening... speak your question request
              </div>
            )}

            {/* Transcribing */}
            {state === "transcribing" && (
              <div className="flex items-center gap-2 text-sm text-muted-foreground">
                <Loader2 className="h-3.5 w-3.5 animate-spin" />
                Processing your voice...
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-sm text-red-600 dark:text-red-400">{error}</p>
            )}

            {/* Transcript */}
            {transcript && (
              <div className="space-y-2">
                <p className="text-sm">
                  <span className="font-medium text-muted-foreground mr-1">
                    You said:
                  </span>
                  &ldquo;{transcript}&rdquo;
                </p>

                {/* Parsed intent badges */}
                {intent && (
                  <div className="flex flex-wrap gap-1.5">
                    {intent.subject && (
                      <Badge variant="secondary" className="text-xs">
                        Subject: {intent.subject}
                      </Badge>
                    )}
                    {intent.topic && (
                      <Badge variant="secondary" className="text-xs">
                        Topic: {intent.topic}
                      </Badge>
                    )}
                    {intent.chapter && (
                      <Badge variant="secondary" className="text-xs">
                        Chapter: {intent.chapter}
                      </Badge>
                    )}
                    {intent.question_type && (
                      <Badge variant="secondary" className="text-xs">
                        Type: {intent.question_type}
                      </Badge>
                    )}
                    {intent.difficulty && (
                      <Badge variant="secondary" className="text-xs">
                        Difficulty: {intent.difficulty}
                      </Badge>
                    )}
                    {intent.count != null && (
                      <Badge variant="secondary" className="text-xs">
                        Count: {intent.count}
                      </Badge>
                    )}
                  </div>
                )}

                {state === "parsed" && (
                  <div className="flex items-center gap-2">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500" />
                    <span className="text-xs text-green-600 dark:text-green-400">
                      Form fields updated from voice
                    </span>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={reset}
                      className="ml-auto h-7 px-2 text-xs"
                    >
                      <RotateCcw className="h-3 w-3 mr-1" />
                      Reset
                    </Button>
                  </div>
                )}
              </div>
            )}
          </CardContent>
        </Card>
      )}
    </div>
  );
};
