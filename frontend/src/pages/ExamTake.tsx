import React, { useEffect, useState, useRef, useCallback } from "react";
import { useParams, useNavigate } from "react-router-dom";
import { examAPI, paperAPI, aiAPI } from "../services/api";
import type {
  QuestionPaper,
  PaperQuestionDetail,
  StudentAnswer,
  HintResponse,
  ExamSession,
} from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Textarea,
  Skeleton,
  Progress,
} from "../components/ui";
import { cn } from "../lib/utils";
import {
  Clock,
  Flag,
  ChevronLeft,
  ChevronRight,
  Keyboard,
  Lightbulb,
  CheckCircle,
  HelpCircle,
  Send,
  Brain,
  Target,
} from "lucide-react";

const ExamTake: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const navigate = useNavigate();
  const [paper, setPaper] = useState<QuestionPaper | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [questions, setQuestions] = useState<PaperQuestionDetail[]>([]);
  const [answers, setAnswers] = useState<Record<number, StudentAnswer>>({});
  const [currentIdx, setCurrentIdx] = useState(0);
  const [timeLeft, setTimeLeft] = useState(0);
  const [loading, setLoading] = useState(true);
  const timerRef = useRef<any>(null);
  const autoSaveRef = useRef<any>(null);

  // AI Hint state
  const [hints, setHints] = useState<Record<number, HintResponse[]>>({});
  const [hintLoading, setHintLoading] = useState(false);
  const [showHintPanel, setShowHintPanel] = useState(false);

  // Keyboard shortcut visibility
  const [showShortcuts, setShowShortcuts] = useState(false);

  // Track which questions had hints used
  const hintUsedQuestions = new Set(Object.keys(hints).map(Number));

  useEffect(() => {
    if (!sessionId) return;
    examAPI
      .get(Number(sessionId))
      .then(async (res) => {
        const sessionData = res.data;
        setSession(sessionData);
        const paperRes = await paperAPI.get(sessionData.paper_id);
        setPaper(paperRes.data);
        setQuestions(paperRes.data.questions || []);
        setTimeLeft(
          paperRes.data.duration_minutes * 60 - sessionData.time_spent_seconds,
        );

        const existing: Record<number, StudentAnswer> = {};
        for (const a of sessionData.answers || []) {
          existing[a.paper_question_id] = a;
        }
        setAnswers(existing);
        setLoading(false);
      })
      .catch(() => setLoading(false));
  }, [sessionId]);

  // Timer countdown
  useEffect(() => {
    if (timeLeft <= 0 || !paper) return;
    timerRef.current = setInterval(() => {
      setTimeLeft((t) => {
        if (t <= 1) {
          clearInterval(timerRef.current);
          handleSubmit();
          return 0;
        }
        return t - 1;
      });
    }, 1000);
    return () => clearInterval(timerRef.current);
  }, [paper]);

  // Auto-save every 30 seconds
  const saveAnswers = useCallback(() => {
    if (!sessionId) return;
    const answerList = Object.entries(answers).map(([pqId, ans]) => ({
      paper_question_id: Number(pqId),
      answer_text: ans.answer_text,
      selected_option: ans.selected_option,
    }));
    if (answerList.length === 0) return;
    examAPI
      .save(Number(sessionId), {
        answers: answerList,
        time_spent_seconds: (paper?.duration_minutes || 0) * 60 - timeLeft,
      })
      .catch(() => {});
  }, [answers, sessionId, timeLeft, paper]);

  useEffect(() => {
    autoSaveRef.current = setInterval(saveAnswers, 30000);
    return () => clearInterval(autoSaveRef.current);
  }, [saveAnswers]);

  // Keyboard shortcuts: J/K for next/prev, F to flag
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // Don't trigger shortcuts when typing in textarea
      if (
        e.target instanceof HTMLTextAreaElement ||
        e.target instanceof HTMLInputElement
      ) {
        return;
      }

      switch (e.key.toLowerCase()) {
        case "j":
          setCurrentIdx((i) => Math.min(questions.length - 1, i + 1));
          break;
        case "k":
          setCurrentIdx((i) => Math.max(0, i - 1));
          break;
        case "f":
          if (questions[currentIdx]) {
            toggleFlag(questions[currentIdx].paper_question_id);
          }
          break;
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [questions, currentIdx]);

  const updateAnswer = (pqId: number, field: string, value: string) => {
    setAnswers((prev) => ({
      ...prev,
      [pqId]: { ...prev[pqId], paper_question_id: pqId, [field]: value },
    }));
  };

  const toggleFlag = (pqId: number) => {
    setAnswers((prev) => ({
      ...prev,
      [pqId]: {
        ...prev[pqId],
        paper_question_id: pqId,
        is_flagged: !prev[pqId]?.is_flagged,
      },
    }));
    if (sessionId) {
      examAPI.flag(Number(sessionId), pqId).catch(() => {});
    }
  };

  const handleSubmit = async () => {
    if (!sessionId) return;
    saveAnswers();
    if (
      !window.confirm(
        "Submit this exam? You cannot change answers after submission.",
      )
    ) {
      return;
    }
    try {
      await examAPI.submit(Number(sessionId));
      navigate(`/results/${sessionId}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to submit");
    }
  };

  // AI Hint
  const requestHint = async () => {
    if (!sessionId || !questions[currentIdx]) return;
    const pqId = questions[currentIdx].paper_question_id;
    setHintLoading(true);
    try {
      const { data } = await aiAPI.hint({
        session_id: Number(sessionId),
        paper_question_id: pqId,
      });
      setHints((prev) => ({
        ...prev,
        [pqId]: [...(prev[pqId] || []), data],
      }));
      setShowHintPanel(true);
    } catch (err: any) {
      alert(
        err.response?.data?.detail ||
          "Failed to get hint. AI service may be unavailable.",
      );
    } finally {
      setHintLoading(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-16 w-full" />
        <div className="grid grid-cols-[1fr_260px] gap-4">
          <Skeleton className="h-96" />
          <Skeleton className="h-64" />
        </div>
      </div>
    );
  }

  if (!paper || questions.length === 0) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <HelpCircle className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No questions found.</p>
        </CardContent>
      </Card>
    );
  }

  const currentQ = questions[currentIdx];
  const currentAnswer = answers[currentQ.paper_question_id];
  const currentHints = hints[currentQ.paper_question_id] || [];
  const isPractice = session?.is_practice ?? false;

  const formatTime = (s: number) =>
    `${Math.floor(s / 60)}:${(s % 60).toString().padStart(2, "0")}`;

  const answeredCount = questions.filter(
    (q) =>
      !!answers[q.paper_question_id]?.answer_text ||
      !!answers[q.paper_question_id]?.selected_option,
  ).length;
  const progressPct = Math.round((answeredCount / questions.length) * 100);

  const wordCount =
    currentQ.question_type !== "mcq" && currentAnswer?.answer_text
      ? currentAnswer.answer_text.trim().split(/\s+/).filter(Boolean).length
      : 0;

  return (
    <div className="space-y-4">
      {/* Header Bar */}
      <Card>
        <CardContent className="py-3 px-5">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <div>
                <h3 className="font-semibold text-sm">{paper.title}</h3>
                <p className="text-xs text-muted-foreground">
                  {paper.subject} | {paper.total_marks} marks
                  {isPractice && (
                    <Badge variant="secondary" className="ml-2 text-[10px]">
                      Practice
                    </Badge>
                  )}
                </p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              {/* Progress */}
              <div className="hidden md:flex items-center gap-2">
                <span className="text-xs text-muted-foreground">
                  {answeredCount}/{questions.length}
                </span>
                <Progress value={progressPct} className="w-24 h-2" />
              </div>
              {/* Timer */}
              <div
                className={cn(
                  "flex items-center gap-1.5 font-mono text-lg font-bold",
                  timeLeft < 300
                    ? "text-destructive"
                    : timeLeft < 600
                      ? "text-orange-500"
                      : "text-foreground",
                )}
              >
                <Clock className="h-4 w-4" />
                {formatTime(timeLeft)}
              </div>
              {/* Keyboard shortcuts toggle */}
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowShortcuts(!showShortcuts)}
                title="Keyboard shortcuts"
              >
                <Keyboard className="h-4 w-4" />
              </Button>
              {/* Submit */}
              <Button variant="destructive" onClick={handleSubmit}>
                <Send className="h-4 w-4 mr-2" />
                Submit
              </Button>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Keyboard shortcuts tooltip */}
      {showShortcuts && (
        <Card className="border-dashed">
          <CardContent className="py-3 px-5">
            <div className="flex items-center gap-6 text-xs text-muted-foreground">
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  J
                </kbd>{" "}
                Next question
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  K
                </kbd>{" "}
                Previous question
              </span>
              <span>
                <kbd className="px-1.5 py-0.5 bg-muted rounded text-[10px] font-mono">
                  F
                </kbd>{" "}
                Flag question
              </span>
            </div>
          </CardContent>
        </Card>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[1fr_280px] gap-4">
        {/* Question Area */}
        <div className="space-y-4">
          <Card>
            <CardContent className="p-6">
              {/* Question header */}
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-2">
                  <span className="text-sm font-bold">Q{currentIdx + 1}</span>
                  <span className="text-sm text-muted-foreground">
                    of {questions.length}
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <Badge variant="outline" className="text-xs">
                    {currentQ.marks} marks
                  </Badge>
                  <Badge
                    variant={
                      currentQ.difficulty === "easy"
                        ? "success"
                        : currentQ.difficulty === "medium"
                          ? "warning"
                          : "destructive"
                    }
                    className="text-xs"
                  >
                    {currentQ.difficulty}
                  </Badge>
                  <Badge variant="secondary" className="text-xs">
                    {currentQ.topic}
                  </Badge>
                  <Button
                    variant={currentAnswer?.is_flagged ? "default" : "ghost"}
                    size="sm"
                    onClick={() => toggleFlag(currentQ.paper_question_id)}
                    className={cn(
                      currentAnswer?.is_flagged &&
                        "bg-amber-500 hover:bg-amber-600 text-white",
                    )}
                  >
                    <Flag className="h-3.5 w-3.5 mr-1" />
                    {currentAnswer?.is_flagged ? "Flagged" : "Flag"}
                  </Button>
                </div>
              </div>

              {/* Question text */}
              <div className="text-base leading-relaxed mb-6">
                {currentQ.question_text}
              </div>

              {/* Answer input */}
              {currentQ.question_type === "mcq" && currentQ.mcq_options ? (
                <div className="space-y-2">
                  {Object.entries(currentQ.mcq_options).map(([key, val]) => (
                    <label
                      key={key}
                      className={cn(
                        "flex items-center gap-3 px-4 py-3 rounded-lg border cursor-pointer transition-all",
                        currentAnswer?.selected_option === key
                          ? "border-primary bg-primary/5 ring-1 ring-primary"
                          : "border-border hover:border-muted-foreground/30 hover:bg-muted/50",
                      )}
                    >
                      <input
                        type="radio"
                        name={`q-${currentQ.paper_question_id}`}
                        checked={currentAnswer?.selected_option === key}
                        onChange={() =>
                          updateAnswer(
                            currentQ.paper_question_id,
                            "selected_option",
                            key,
                          )
                        }
                        className="sr-only"
                      />
                      <div
                        className={cn(
                          "flex-shrink-0 h-6 w-6 rounded-full border-2 flex items-center justify-center text-xs font-semibold",
                          currentAnswer?.selected_option === key
                            ? "border-primary bg-primary text-primary-foreground"
                            : "border-muted-foreground/30 text-muted-foreground",
                        )}
                      >
                        {key.toUpperCase()}
                      </div>
                      <span className="text-sm">{val}</span>
                    </label>
                  ))}
                </div>
              ) : (
                <div className="space-y-2">
                  <Textarea
                    value={currentAnswer?.answer_text || ""}
                    onChange={(e) =>
                      updateAnswer(
                        currentQ.paper_question_id,
                        "answer_text",
                        e.target.value,
                      )
                    }
                    placeholder="Type your answer here..."
                    className={cn(
                      "resize-y",
                      currentQ.question_type === "long_answer"
                        ? "min-h-[200px]"
                        : "min-h-[80px]",
                    )}
                  />
                  <div className="flex items-center justify-between text-xs text-muted-foreground">
                    <span>{wordCount} words</span>
                    {currentQ.question_type === "long_answer" &&
                      wordCount < 50 && (
                        <span className="text-amber-500">
                          Long answers typically need 100+ words
                        </span>
                      )}
                    {currentQ.question_type === "short_answer" &&
                      wordCount > 100 && (
                        <span className="text-amber-500">
                          Consider being more concise for short answers
                        </span>
                      )}
                  </div>
                </div>
              )}

              {/* Navigation */}
              <div className="flex items-center justify-between mt-6 pt-4 border-t">
                <Button
                  variant="outline"
                  onClick={() => setCurrentIdx((i) => Math.max(0, i - 1))}
                  disabled={currentIdx === 0}
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Previous
                </Button>
                <div className="flex items-center gap-2">
                  {/* AI Hint button - only for practice exams */}
                  {isPractice && (
                    <Button
                      variant="outline"
                      onClick={requestHint}
                      disabled={hintLoading}
                      className="text-primary border-primary/30 hover:bg-primary/5"
                    >
                      <Lightbulb className="h-4 w-4 mr-1" />
                      {hintLoading
                        ? "Thinking..."
                        : currentHints.length > 0
                          ? `Hint (${currentHints.length})`
                          : "Get Hint"}
                    </Button>
                  )}
                </div>
                <Button
                  variant="outline"
                  onClick={() =>
                    setCurrentIdx((i) => Math.min(questions.length - 1, i + 1))
                  }
                  disabled={currentIdx === questions.length - 1}
                >
                  Next
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            </CardContent>
          </Card>

          {/* Hint Panel */}
          {showHintPanel && currentHints.length > 0 && (
            <Card className="border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/20">
              <CardHeader className="pb-2">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-4 w-4 text-amber-500" />
                    <CardTitle className="text-sm">
                      Hints ({currentHints.length})
                    </CardTitle>
                  </div>
                  <div className="flex items-center gap-2">
                    {currentHints.length > 0 && (
                      <Badge
                        variant="outline"
                        className="text-xs text-amber-600"
                      >
                        {
                          currentHints[currentHints.length - 1]
                            .total_penalty_pct
                        }
                        % marks penalty
                      </Badge>
                    )}
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setShowHintPanel(false)}
                      className="h-6 w-6 p-0"
                    >
                      x
                    </Button>
                  </div>
                </div>
              </CardHeader>
              <CardContent className="space-y-2">
                {currentHints.map((hint, i) => (
                  <div
                    key={i}
                    className="text-sm bg-white dark:bg-card rounded-md p-3 border border-amber-100 dark:border-amber-900"
                  >
                    <div className="flex items-center gap-2 mb-1">
                      <Badge variant="secondary" className="text-[10px]">
                        Hint {hint.hint_number} (Level {hint.hint_level})
                      </Badge>
                      <span className="text-[10px] text-amber-600">
                        -{hint.marks_penalty_pct}% marks
                      </span>
                    </div>
                    <p className="text-muted-foreground leading-relaxed">
                      {hint.hint}
                    </p>
                  </div>
                ))}
              </CardContent>
            </Card>
          )}
        </div>

        {/* Question Palette (Sidebar) */}
        <div className="space-y-4">
          <Card className="sticky top-4">
            <CardHeader className="pb-3">
              <CardTitle className="text-sm">Question Palette</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="grid grid-cols-5 gap-1.5">
                {questions.map((q, i) => {
                  const answered =
                    !!answers[q.paper_question_id]?.answer_text ||
                    !!answers[q.paper_question_id]?.selected_option;
                  const flagged = answers[q.paper_question_id]?.is_flagged;
                  const hasHints = hintUsedQuestions.has(q.paper_question_id);

                  return (
                    <button
                      key={q.paper_question_id}
                      onClick={() => setCurrentIdx(i)}
                      className={cn(
                        "relative h-9 w-full rounded-md text-xs font-medium transition-all",
                        i === currentIdx
                          ? "ring-2 ring-primary bg-primary text-primary-foreground"
                          : answered
                            ? "bg-green-100 dark:bg-green-900/30 text-green-700 dark:text-green-300 border border-green-200 dark:border-green-800"
                            : flagged
                              ? "bg-amber-50 dark:bg-amber-900/30 text-amber-600 border border-amber-200 dark:border-amber-800"
                              : "bg-muted text-muted-foreground border border-border hover:border-muted-foreground/30",
                      )}
                      type="button"
                    >
                      {i + 1}
                      {flagged && !answered && (
                        <Flag className="absolute -top-1 -right-1 h-3 w-3 text-amber-500" />
                      )}
                      {hasHints && (
                        <Lightbulb className="absolute -bottom-1 -right-1 h-3 w-3 text-amber-400" />
                      )}
                    </button>
                  );
                })}
              </div>

              {/* Legend */}
              <div className="mt-4 space-y-1.5 text-[11px] text-muted-foreground">
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-green-100 dark:bg-green-900/30 border border-green-200 dark:border-green-800" />
                  <span>Answered ({answeredCount})</span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-amber-50 dark:bg-amber-900/30 border border-amber-200 dark:border-amber-800" />
                  <span>
                    Flagged (
                    {
                      questions.filter(
                        (q) => answers[q.paper_question_id]?.is_flagged,
                      ).length
                    }
                    )
                  </span>
                </div>
                <div className="flex items-center gap-2">
                  <div className="h-3 w-3 rounded bg-muted border border-border" />
                  <span>Unanswered ({questions.length - answeredCount})</span>
                </div>
                {isPractice && hintUsedQuestions.size > 0 && (
                  <div className="flex items-center gap-2">
                    <Lightbulb className="h-3 w-3 text-amber-400" />
                    <span>Hint used ({hintUsedQuestions.size})</span>
                  </div>
                )}
              </div>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
};

export default ExamTake;
