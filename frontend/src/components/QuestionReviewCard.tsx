import React, { useState, useMemo } from "react";
import type { GeneratedQuestion, DifficultyCalibration } from "../types";
import { Badge, Button, Input, Textarea, Select } from "./ui";
import { MathText } from "./MathText";
import { cn } from "../lib/utils";
import {
  AlertTriangle,
  CheckCircle,
  XCircle,
  ChevronDown,
  ChevronRight,
  Brain,
  ShieldCheck,
  Sparkles,
  Star,
  RefreshCw,
  Edit,
} from "lucide-react";

export type ReviewStatus = "pending" | "accepted" | "rejected";

export interface ReviewQuestionData extends GeneratedQuestion {
  // Editable overrides -- tracked separately to detect changes
  edited_question_text?: string;
  edited_model_answer?: string;
  edited_marks?: number;
  edited_difficulty?: string;
  edited_blooms_level?: string;
  edited_mcq_options?: Record<string, string>;
  edited_correct_option?: string;
  edited_answer_keywords?: string[];
  // Teacher confirmation tracking (set when blooms is changed in review)
  _blooms_teacher_confirmed?: boolean;
}

interface QuestionReviewCardProps {
  question: ReviewQuestionData;
  index: number;
  mode: "auto" | "guided" | "expert";
  status: ReviewStatus;
  rating: number;
  regenerationCount: number;
  onStatusChange: (index: number, status: ReviewStatus) => void;
  onQuestionEdit: (index: number, updates: Partial<ReviewQuestionData>) => void;
  onRegenerate: (index: number, feedback: string) => void;
  onRatingChange: (index: number, rating: number) => void;
  calibration?: DifficultyCalibration | null;
}

const DIFFICULTIES = [
  { value: "easy", label: "Easy" },
  { value: "medium", label: "Medium" },
  { value: "hard", label: "Hard" },
];

const BLOOMS_LEVELS = [
  { value: "remember", label: "Remember" },
  { value: "understand", label: "Understand" },
  { value: "apply", label: "Apply" },
  { value: "analyze", label: "Analyze" },
  { value: "evaluate", label: "Evaluate" },
  { value: "create", label: "Create" },
];

function getDifficultyVariant(difficulty: string) {
  if (difficulty === "easy") return "success" as const;
  if (difficulty === "medium") return "warning" as const;
  return "destructive" as const;
}

function getBloomsConfidenceBadge(
  confidence: number | null | undefined,
  teacherConfirmed: boolean,
): { label: string; className: string; icon: React.ReactNode } | null {
  if (teacherConfirmed) {
    return {
      label: "Verified",
      className:
        "border-blue-300 text-blue-700 bg-blue-50 dark:border-blue-800 dark:text-blue-300 dark:bg-blue-950/40",
      icon: <ShieldCheck className="h-3 w-3 mr-0.5" />,
    };
  }
  if (confidence == null) return null;
  if (confidence >= 0.7) {
    return {
      label: "High confidence",
      className:
        "border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:bg-emerald-950/40",
      icon: null,
    };
  }
  if (confidence >= 0.4) {
    return {
      label: "Medium confidence",
      className:
        "border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:text-amber-300 dark:bg-amber-950/40",
      icon: null,
    };
  }
  return {
    label: "Low confidence",
    className:
      "border-red-300 text-red-700 bg-red-50 dark:border-red-800 dark:text-red-300 dark:bg-red-950/40",
    icon: null,
  };
}

function QuestionReviewCard({
  question,
  index,
  mode,
  status,
  rating,
  regenerationCount,
  onStatusChange,
  onQuestionEdit,
  onRegenerate,
  onRatingChange,
  calibration,
}: QuestionReviewCardProps) {
  const [expanded, setExpanded] = useState(mode !== "auto");
  const [showFeedback, setShowFeedback] = useState(false);
  const [feedback, setFeedback] = useState("");
  const [regenerating, setRegenerating] = useState(false);

  // Derive current values (edited or original)
  const currentText = question.edited_question_text ?? question.question_text;
  const currentAnswer = question.edited_model_answer ?? question.model_answer;
  const currentMarks = question.edited_marks ?? question.marks;
  const currentDifficulty = question.edited_difficulty ?? question.difficulty;
  const currentBlooms = question.edited_blooms_level ?? question.blooms_level;
  const currentMcqOptions = question.edited_mcq_options ?? question.mcq_options;
  const currentCorrectOption =
    question.edited_correct_option ?? question.correct_option;
  const currentKeywords =
    question.edited_answer_keywords ?? question.answer_keywords;

  // Bloom's confidence
  const isTeacherConfirmed =
    question._blooms_teacher_confirmed ??
    question.blooms_teacher_confirmed ??
    false;
  const bloomsConfidence = isTeacherConfirmed
    ? 1.0
    : (question.blooms_confidence ?? null);
  const confidenceBadge = getBloomsConfidenceBadge(
    bloomsConfidence,
    isTeacherConfirmed,
  );

  // Difficulty calibration mismatch
  const hasMismatch = calibration?.mismatch === true;

  const isEdited = useMemo(() => {
    return (
      question.edited_question_text !== undefined ||
      question.edited_model_answer !== undefined ||
      question.edited_marks !== undefined ||
      question.edited_difficulty !== undefined ||
      question.edited_blooms_level !== undefined ||
      question.edited_mcq_options !== undefined ||
      question.edited_correct_option !== undefined ||
      question.edited_answer_keywords !== undefined
    );
  }, [question]);

  const handleRegenerate = async () => {
    if (!feedback.trim() || regenerationCount >= 5) return;
    setRegenerating(true);
    try {
      await onRegenerate(index, feedback);
      setFeedback("");
    } finally {
      setRegenerating(false);
    }
  };

  const borderColor =
    status === "accepted"
      ? "border-l-green-500"
      : status === "rejected"
        ? "border-l-red-500"
        : "border-l-amber-400";

  const bgColor =
    status === "accepted"
      ? "bg-green-50/50 dark:bg-green-950/20"
      : status === "rejected"
        ? "bg-muted/50 opacity-60"
        : "";

  return (
    <div
      className={cn(
        "rounded-lg border border-l-4 transition-all",
        borderColor,
        bgColor,
      )}
    >
      {/* Collapsed View */}
      <div className="p-4">
        <div className="flex items-start gap-3">
          {/* Expand Toggle */}
          <button
            type="button"
            onClick={() => setExpanded(!expanded)}
            className="mt-0.5 flex-shrink-0 text-muted-foreground hover:text-foreground transition-colors"
          >
            {expanded ? (
              <ChevronDown className="h-4 w-4" />
            ) : (
              <ChevronRight className="h-4 w-4" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            {/* Badge Row */}
            <div className="flex items-center gap-2 mb-1.5 flex-wrap">
              <Badge variant="outline" className="text-xs">
                {question.question_type.replace("_", " ")}
              </Badge>
              <Badge
                variant={getDifficultyVariant(currentDifficulty)}
                className="text-xs"
              >
                {currentDifficulty}
              </Badge>
              <Badge variant="secondary" className="text-xs">
                {currentMarks} marks
              </Badge>
              {currentBlooms && (
                <Badge variant="outline" className="text-xs">
                  <Brain className="h-3 w-3 mr-1" />
                  {currentBlooms}
                </Badge>
              )}
              {confidenceBadge && (
                <Badge
                  variant="outline"
                  className={cn("text-xs", confidenceBadge.className)}
                >
                  {confidenceBadge.icon}
                  {confidenceBadge.label}
                </Badge>
              )}
              {hasMismatch && calibration && (
                <Badge
                  variant="outline"
                  className="text-xs border-orange-300 text-orange-700 bg-orange-50 dark:border-orange-800 dark:text-orange-300 dark:bg-orange-950/40"
                  title={`Based on ${calibration.sample_size} student attempts, avg score ${Math.round(calibration.empirical_score * 100)}%`}
                >
                  <AlertTriangle className="h-3 w-3 mr-0.5" />
                  Marked {calibration.assigned_difficulty}, actual{" "}
                  {calibration.empirical_difficulty}
                </Badge>
              )}
              {isEdited && (
                <Badge
                  variant="outline"
                  className="text-xs border-amber-300 text-amber-600 dark:text-amber-400"
                >
                  <Edit className="h-3 w-3 mr-1" />
                  Edited
                </Badge>
              )}
              {regenerationCount > 0 && (
                <Badge variant="outline" className="text-xs">
                  v{regenerationCount + 1}
                </Badge>
              )}
              <div className="ml-auto flex items-center gap-1">
                <Sparkles className="h-3 w-3 text-primary" />
                <span className="text-xs text-primary font-medium">
                  AI Generated
                </span>
              </div>
            </div>

            {/* Question Text */}
            <MathText text={currentText} as="p" className="text-sm leading-relaxed" />

            {/* Question Image */}
            {question.question_image_url && (
              <div className="mt-3">
                <img
                  src={question.question_image_url}
                  alt="Question diagram"
                  className="max-w-full rounded-lg border border-border cursor-pointer hover:opacity-90 transition-opacity"
                  style={{ maxHeight: "300px" }}
                  onClick={() => window.open(question.question_image_url!, "_blank")}
                />
              </div>
            )}

            {/* MCQ Options (always visible in collapsed) */}
            {currentMcqOptions && !expanded && (
              <div className="mt-2 grid grid-cols-1 md:grid-cols-2 gap-1">
                {Object.entries(currentMcqOptions).map(([key, val]) => (
                  <div
                    key={key}
                    className={cn(
                      "text-xs px-2 py-1 rounded",
                      key === currentCorrectOption
                        ? "bg-green-50 text-green-700 dark:bg-green-950 dark:text-green-300 font-medium"
                        : "bg-muted text-muted-foreground",
                    )}
                  >
                    <strong>{key.toUpperCase()}.</strong> <MathText text={val} />
                    {key === currentCorrectOption && (
                      <CheckCircle className="h-3 w-3 inline ml-1" />
                    )}
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Accept/Reject Buttons */}
          <div className="flex items-center gap-1 flex-shrink-0">
            <button
              type="button"
              onClick={() =>
                onStatusChange(
                  index,
                  status === "accepted" ? "pending" : "accepted",
                )
              }
              className={cn(
                "p-1.5 rounded-md transition-colors",
                status === "accepted"
                  ? "bg-green-100 text-green-700 dark:bg-green-900 dark:text-green-300"
                  : "text-muted-foreground hover:text-green-600 hover:bg-green-50 dark:hover:bg-green-950",
              )}
              title="Accept"
            >
              <CheckCircle className="h-4 w-4" />
            </button>
            <button
              type="button"
              onClick={() =>
                onStatusChange(
                  index,
                  status === "rejected" ? "pending" : "rejected",
                )
              }
              className={cn(
                "p-1.5 rounded-md transition-colors",
                status === "rejected"
                  ? "bg-red-100 text-red-700 dark:bg-red-900 dark:text-red-300"
                  : "text-muted-foreground hover:text-red-600 hover:bg-red-50 dark:hover:bg-red-950",
              )}
              title="Reject"
            >
              <XCircle className="h-4 w-4" />
            </button>
          </div>
        </div>
      </div>

      {/* Expanded View */}
      {expanded && (
        <div className="px-4 pb-4 space-y-4 border-t pt-4 ml-7">
          {/* Editable Question Text */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Question Text
            </label>
            <Textarea
              value={currentText}
              onChange={(e) =>
                onQuestionEdit(index, {
                  edited_question_text: e.target.value,
                })
              }
              className={cn(
                "min-h-[60px] text-sm",
                question.edited_question_text !== undefined &&
                  "border-amber-300 dark:border-amber-700",
              )}
            />
            {/\\\(|\\?\$\$|\\\[/.test(currentText) && (
              <div className="rounded-md border border-dashed p-2 bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Preview</p>
                <MathText text={currentText} as="div" className="text-sm" />
              </div>
            )}
          </div>

          {/* Editable Model Answer */}
          <div className="space-y-1.5">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Model Answer
            </label>
            <Textarea
              value={currentAnswer}
              onChange={(e) =>
                onQuestionEdit(index, {
                  edited_model_answer: e.target.value,
                })
              }
              className={cn(
                "min-h-[60px] text-sm",
                question.edited_model_answer !== undefined &&
                  "border-amber-300 dark:border-amber-700",
              )}
            />
            {/\\\(|\\?\$\$|\\\[/.test(currentAnswer) && (
              <div className="rounded-md border border-dashed p-2 bg-muted/30">
                <p className="text-[10px] text-muted-foreground mb-1 uppercase tracking-wider">Preview</p>
                <MathText text={currentAnswer} as="div" className="text-sm" />
              </div>
            )}
          </div>

          {/* Editable Marks, Difficulty, Bloom's */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Marks
              </label>
              <Input
                type="number"
                value={currentMarks}
                onChange={(e) =>
                  onQuestionEdit(index, {
                    edited_marks: Number(e.target.value),
                  })
                }
                min={1}
                max={20}
                className="text-sm"
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Difficulty
              </label>
              <Select
                value={currentDifficulty}
                onChange={(e) =>
                  onQuestionEdit(index, {
                    edited_difficulty: e.target.value,
                  })
                }
                options={DIFFICULTIES}
              />
            </div>
            <div className="space-y-1.5">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Bloom's Level
              </label>
              <Select
                value={currentBlooms}
                onChange={(e) =>
                  onQuestionEdit(index, {
                    edited_blooms_level: e.target.value,
                    _blooms_teacher_confirmed: true,
                  })
                }
                options={BLOOMS_LEVELS}
              />
            </div>
          </div>

          {/* MCQ Options (editable) */}
          {currentMcqOptions && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                MCQ Options
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                {Object.entries(currentMcqOptions).map(([key, val]) => (
                  <div key={key} className="flex items-center gap-2">
                    <span className="text-xs font-bold text-muted-foreground w-6">
                      {key.toUpperCase()}.
                    </span>
                    <Input
                      value={val}
                      onChange={(e) => {
                        const updated = {
                          ...currentMcqOptions,
                          [key]: e.target.value,
                        };
                        onQuestionEdit(index, {
                          edited_mcq_options: updated,
                        });
                      }}
                      className="text-sm flex-1"
                    />
                    <button
                      type="button"
                      onClick={() =>
                        onQuestionEdit(index, {
                          edited_correct_option: key,
                        })
                      }
                      className={cn(
                        "p-1 rounded transition-colors",
                        key === currentCorrectOption
                          ? "text-green-600 bg-green-100 dark:bg-green-900 dark:text-green-300"
                          : "text-muted-foreground hover:text-green-600",
                      )}
                      title={
                        key === currentCorrectOption
                          ? "Correct answer"
                          : "Set as correct"
                      }
                    >
                      <CheckCircle className="h-4 w-4" />
                    </button>
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Answer Keywords (editable pills) */}
          {currentKeywords && currentKeywords.length > 0 && (
            <div className="space-y-2">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Answer Keywords
              </label>
              <div className="flex flex-wrap gap-1.5">
                {currentKeywords.map((kw, ki) => (
                  <span
                    key={ki}
                    className="inline-flex items-center gap-1 rounded-md border px-2 py-1 text-xs bg-background"
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => {
                        const updated = currentKeywords.filter(
                          (_, j) => j !== ki,
                        );
                        onQuestionEdit(index, {
                          edited_answer_keywords: updated,
                        });
                      }}
                      className="text-muted-foreground hover:text-destructive"
                    >
                      <XCircle className="h-3 w-3" />
                    </button>
                  </span>
                ))}
              </div>
            </div>
          )}

          {/* Quality Rating (Guided + Expert) */}
          {(mode === "guided" || mode === "expert") && (
            <div className="flex items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Quality
              </span>
              <div className="flex items-center gap-0.5">
                {[1, 2, 3, 4, 5].map((star) => (
                  <button
                    key={star}
                    type="button"
                    onClick={() => onRatingChange(index, star)}
                    className="p-0.5 transition-colors"
                  >
                    <Star
                      className={cn(
                        "h-4 w-4",
                        star <= rating
                          ? "fill-amber-400 text-amber-400"
                          : "text-muted-foreground/30",
                      )}
                    />
                  </button>
                ))}
              </div>
            </div>
          )}

          {/* Feedback + Regenerate (Expert always, Guided opt-in) */}
          {(mode === "expert" || (mode === "guided" && showFeedback)) && (
            <div className="space-y-2 border-t pt-3">
              <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Improvement Feedback
              </label>
              <Textarea
                placeholder="How should this question be improved?"
                value={feedback}
                onChange={(e) => setFeedback(e.target.value)}
                className="min-h-[50px] text-sm"
              />
              <div className="flex items-center gap-2">
                <Button
                  size="sm"
                  variant="outline"
                  onClick={handleRegenerate}
                  disabled={
                    regenerating || !feedback.trim() || regenerationCount >= 5
                  }
                >
                  {regenerating ? (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5 animate-spin" />
                      Regenerating...
                    </>
                  ) : (
                    <>
                      <RefreshCw className="h-3.5 w-3.5 mr-1.5" />
                      Regenerate
                    </>
                  )}
                </Button>
                {regenerationCount >= 5 && (
                  <span className="text-xs text-muted-foreground">
                    Max regenerations reached
                  </span>
                )}
              </div>
            </div>
          )}

          {/* Show feedback opt-in button for Guided mode */}
          {mode === "guided" && !showFeedback && (
            <button
              type="button"
              onClick={() => setShowFeedback(true)}
              className="text-xs text-muted-foreground hover:text-foreground flex items-center gap-1 transition-colors"
            >
              <RefreshCw className="h-3 w-3" />
              Provide feedback & regenerate
            </button>
          )}
        </div>
      )}
    </div>
  );
}

export { QuestionReviewCard };
export type { QuestionReviewCardProps };
