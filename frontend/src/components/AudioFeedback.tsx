import React, { useState, useRef, useCallback, useEffect } from "react";
import { voiceAPI } from "../services/api";
import { Button, useToast } from "./ui";
import { cn } from "../lib/utils";
import { Mic, MicOff, Play, Pause, Upload, Loader2, Volume2, Trash2 } from "lucide-react";

interface AudioFeedbackProps {
  evaluationId: number;
  questionEvaluationId: number;
  existingUrl?: string;
}

type RecordingState = "idle" | "recording" | "preview" | "uploading" | "done";

export const AudioFeedback: React.FC<AudioFeedbackProps> = ({
  evaluationId,
  questionEvaluationId,
  existingUrl,
}) => {
  const [recordingState, setRecordingState] = useState<RecordingState>(
    existingUrl ? "done" : "idle",
  );
  const [audioUrl, setAudioUrl] = useState<string | null>(existingUrl ?? null);
  const [audioBlobForUpload, setAudioBlobForUpload] = useState<Blob | null>(null);
  const [isPlaying, setIsPlaying] = useState(false);

  const mediaRecorderRef = useRef<MediaRecorder | null>(null);
  const chunksRef = useRef<Blob[]>([]);
  const streamRef = useRef<MediaStream | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  const { toast } = useToast();

  // Cleanup object URLs on unmount
  useEffect(() => {
    return () => {
      if (audioUrl && audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
    };
  }, [audioUrl]);

  const startRecording = useCallback(async () => {
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

      mediaRecorder.onstop = () => {
        streamRef.current?.getTracks().forEach((t) => t.stop());
        streamRef.current = null;

        const audioBlob = new Blob(chunksRef.current, { type: "audio/webm" });
        if (audioBlob.size === 0) {
          toast("No audio recorded. Please try again.", "error");
          setRecordingState("idle");
          return;
        }

        const previewUrl = URL.createObjectURL(audioBlob);
        setAudioUrl(previewUrl);
        setAudioBlobForUpload(audioBlob);
        setRecordingState("preview");
      };

      mediaRecorder.start(250);
      setRecordingState("recording");
    } catch (err: any) {
      if (err.name === "NotAllowedError") {
        toast("Microphone permission denied.", "error");
      } else {
        toast("Could not access microphone.", "error");
      }
    }
  }, [toast]);

  const stopRecording = useCallback(() => {
    if (
      mediaRecorderRef.current &&
      mediaRecorderRef.current.state === "recording"
    ) {
      mediaRecorderRef.current.stop();
    }
  }, []);

  const uploadFeedback = useCallback(async () => {
    if (!audioBlobForUpload) return;

    setRecordingState("uploading");
    try {
      const audioFile = new File([audioBlobForUpload], "feedback.webm", {
        type: "audio/webm",
      });
      const { data } = await voiceAPI.uploadAudioFeedback(
        evaluationId,
        questionEvaluationId,
        audioFile,
      );
      // Replace blob URL with server URL
      if (audioUrl && audioUrl.startsWith("blob:")) {
        URL.revokeObjectURL(audioUrl);
      }
      setAudioUrl(data.audio_feedback_url);
      setAudioBlobForUpload(null);
      setRecordingState("done");
      toast("Audio feedback uploaded.", "success");
    } catch (err: any) {
      const message =
        err.response?.data?.detail || "Failed to upload audio feedback.";
      toast(message, "error");
      setRecordingState("preview");
    }
  }, [audioBlobForUpload, evaluationId, questionEvaluationId, audioUrl, toast]);

  const discardRecording = useCallback(() => {
    if (audioUrl && audioUrl.startsWith("blob:")) {
      URL.revokeObjectURL(audioUrl);
    }
    setAudioUrl(existingUrl ?? null);
    setAudioBlobForUpload(null);
    setRecordingState(existingUrl ? "done" : "idle");
  }, [existingUrl, audioUrl]);

  const togglePlayback = useCallback(() => {
    if (!audioRef.current || !audioUrl) return;

    if (isPlaying) {
      audioRef.current.pause();
      setIsPlaying(false);
    } else {
      audioRef.current.src = audioUrl;
      audioRef.current.play().catch(() => {
        toast("Could not play audio.", "error");
      });
      setIsPlaying(true);
    }
  }, [isPlaying, audioUrl, toast]);

  const handleAudioEnded = useCallback(() => {
    setIsPlaying(false);
  }, []);

  return (
    <div className="flex items-center gap-2">
      <audio ref={audioRef} onEnded={handleAudioEnded} className="hidden" />

      {/* Idle: show record button */}
      {recordingState === "idle" && (
        <Button
          variant="outline"
          size="sm"
          onClick={startRecording}
          className="gap-1.5 text-xs"
        >
          <Mic className="h-3.5 w-3.5" />
          Record Feedback
        </Button>
      )}

      {/* Recording: show stop button + indicator */}
      {recordingState === "recording" && (
        <Button
          variant="destructive"
          size="sm"
          onClick={stopRecording}
          className={cn("gap-1.5 text-xs animate-pulse")}
        >
          <MicOff className="h-3.5 w-3.5" />
          Stop Recording
        </Button>
      )}

      {/* Preview: play, upload, or discard */}
      {recordingState === "preview" && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePlayback}
            className="gap-1 text-xs h-7 px-2"
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Play className="h-3 w-3" />
            )}
            {isPlaying ? "Pause" : "Preview"}
          </Button>
          <Button
            size="sm"
            onClick={uploadFeedback}
            className="gap-1 text-xs h-7 px-2"
          >
            <Upload className="h-3 w-3" />
            Upload
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={discardRecording}
            className="gap-1 text-xs h-7 px-2 text-muted-foreground"
          >
            <Trash2 className="h-3 w-3" />
          </Button>
        </div>
      )}

      {/* Uploading */}
      {recordingState === "uploading" && (
        <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3.5 w-3.5 animate-spin" />
          Uploading...
        </div>
      )}

      {/* Done: playback control + re-record */}
      {recordingState === "done" && audioUrl && (
        <div className="flex items-center gap-1.5">
          <Button
            variant="outline"
            size="sm"
            onClick={togglePlayback}
            className="gap-1 text-xs h-7 px-2"
          >
            {isPlaying ? (
              <Pause className="h-3 w-3" />
            ) : (
              <Volume2 className="h-3 w-3" />
            )}
            {isPlaying ? "Pause" : "Play Feedback"}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={startRecording}
            className="gap-1 text-xs h-7 px-2 text-muted-foreground"
            title="Re-record feedback"
          >
            <Mic className="h-3 w-3" />
            Re-record
          </Button>
        </div>
      )}
    </div>
  );
};
