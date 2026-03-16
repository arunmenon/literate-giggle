import React, { useEffect, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { evaluationAPI, examAPI, aiAPI } from "../services/api";
import type { Evaluation, ExamSession, ExplainResponse } from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Progress,
  Skeleton,
  ScoreIndicator,
  useToast,
} from "../components/ui";
import { BloomsRadar, DifficultyBreakdown } from "../components/charts";
import { cn, getGradeColor } from "../lib/utils";
import {
  Award,
  TrendingUp,
  Target,
  Brain,
  Sparkles,
  CheckCircle,
  XCircle,
  Lightbulb,
  BookOpen,
  BarChart3,
  FileText,
  ChevronLeft,
} from "lucide-react";

const ExamResults: React.FC = () => {
  const { sessionId } = useParams<{ sessionId: string }>();
  const [evaluation, setEvaluation] = useState<Evaluation | null>(null);
  const [session, setSession] = useState<ExamSession | null>(null);
  const [loading, setLoading] = useState(true);
  const [evaluating, setEvaluating] = useState(false);

  // Streaming evaluation state
  const [streamProgress, setStreamProgress] = useState<
    Array<{ question_number: number; status: string }>
  >([]);

  const { toast, ToastContainer } = useToast();

  // AI Explain state per question
  const [explanations, setExplanations] = useState<
    Record<number, ExplainResponse>
  >({});
  const [explainLoading, setExplainLoading] = useState<Record<number, boolean>>(
    {},
  );

  useEffect(() => {
    if (!sessionId) return;
    examAPI.get(Number(sessionId)).then((res) => {
      setSession(res.data);
      if (res.data.status === "evaluated" || res.data.status === "reviewed") {
        evaluationAPI
          .get(Number(sessionId))
          .then((evalRes) => setEvaluation(evalRes.data))
          .catch(() => {})
          .finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });
  }, [sessionId]);

  const triggerStreamingEvaluation = async () => {
    if (!sessionId) return;
    setEvaluating(true);
    setStreamProgress([]);

    const token = localStorage.getItem("token");

    try {
      const response = await fetch("/api/evaluations/evaluate/stream", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ session_id: Number(sessionId) }),
      });

      if (!response.ok) {
        throw new Error("Evaluation failed");
      }

      const reader = response.body?.getReader();
      const decoder = new TextDecoder();

      if (!reader) throw new Error("No response body");

      let buffer = "";
      while (true) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() || "";

        for (const line of lines) {
          if (line.startsWith("data: ")) {
            const dataStr = line.slice(6).trim();
            if (dataStr === "[DONE]") continue;
            try {
              const data = JSON.parse(dataStr);
              if (data.type === "progress") {
                setStreamProgress((prev) => [
                  ...prev,
                  {
                    question_number: data.question_number,
                    status: data.status || "evaluating",
                  },
                ]);
              } else if (data.type === "complete" && data.evaluation) {
                setEvaluation(data.evaluation);
              }
            } catch {
              // ignore parse errors
            }
          }
        }
      }
    } catch (err: any) {
      // Fallback to non-streaming evaluation
      try {
        const { data } = await evaluationAPI.evaluate({
          session_id: Number(sessionId),
        });
        setEvaluation(data);
      } catch (fallbackErr: any) {
        toast(
          fallbackErr.response?.data?.detail || "Evaluation failed",
          "error",
        );
      }
    } finally {
      setEvaluating(false);
    }
  };

  const handleExplain = async (questionEvaluationId: number) => {
    setExplainLoading((prev) => ({ ...prev, [questionEvaluationId]: true }));
    try {
      const { data } = await aiAPI.explain({
        question_evaluation_id: questionEvaluationId,
      });
      setExplanations((prev) => ({ ...prev, [questionEvaluationId]: data }));
    } catch (err: any) {
      toast(
        err.response?.data?.detail ||
          "Failed to get explanation. AI service may be unavailable.",
        "error",
      );
    } finally {
      setExplainLoading((prev) => ({
        ...prev,
        [questionEvaluationId]: false,
      }));
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Not evaluated yet -- show evaluation trigger
  if (!evaluation && session?.status === "submitted") {
    return (
      <div className="max-w-lg mx-auto mt-12">
        <Card>
          <CardHeader className="text-center">
            <div className="mx-auto mb-4 rounded-full bg-primary/10 p-4 w-fit">
              <Sparkles className="h-8 w-8 text-primary" />
            </div>
            <CardTitle className="text-xl">Exam Submitted</CardTitle>
            <CardDescription>
              Your exam has been submitted successfully. Click below to evaluate
              your answers with AI.
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {evaluating && streamProgress.length > 0 && (
              <div className="space-y-2">
                <p className="text-sm font-medium">Evaluating questions...</p>
                <Progress
                  value={
                    (streamProgress.length / (streamProgress.length + 2)) * 100
                  }
                  className="h-2"
                />
                <div className="flex flex-wrap gap-1">
                  {streamProgress.map((sp) => (
                    <Badge
                      key={sp.question_number}
                      variant="success"
                      className="text-[10px]"
                    >
                      Q{sp.question_number}
                    </Badge>
                  ))}
                </div>
              </div>
            )}
            <Button
              onClick={triggerStreamingEvaluation}
              disabled={evaluating}
              className="w-full"
              size="lg"
            >
              {evaluating ? (
                <>
                  <Brain className="h-4 w-4 mr-2 animate-pulse" />
                  AI is Evaluating...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4 mr-2" />
                  Evaluate with AI
                </>
              )}
            </Button>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!evaluation) {
    return (
      <Card>
        <CardContent className="py-12 text-center">
          <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
          <p className="text-muted-foreground">No results available.</p>
        </CardContent>
      </Card>
    );
  }

  // Build chart data
  const bloomsData = evaluation.blooms_scores
    ? Object.entries(evaluation.blooms_scores).map(([level, score]) => ({
        level,
        score: Math.round(score),
        fullMark: 100,
      }))
    : [];

  const difficultyData = evaluation.difficulty_scores
    ? Object.entries(evaluation.topic_scores || {}).reduce(
        (
          acc: Array<{ difficulty: string; obtained: number; total: number }>,
          [topic, scores],
        ) => {
          // Group by difficulty if available from question evaluations
          return acc;
        },
        [],
      )
    : [];

  // Build difficulty data from question evaluations
  const difficultyMap: Record<string, { obtained: number; total: number }> = {};
  for (const qe of evaluation.question_evaluations) {
    // We don't have difficulty on qe directly, use a general mapping
    const bucket =
      qe.marks_obtained / qe.marks_possible >= 0.7
        ? "Correct"
        : qe.marks_obtained / qe.marks_possible >= 0.3
          ? "Partial"
          : "Incorrect";
    if (!difficultyMap[bucket]) {
      difficultyMap[bucket] = { obtained: 0, total: 0 };
    }
    difficultyMap[bucket].obtained += qe.marks_obtained;
    difficultyMap[bucket].total += qe.marks_possible;
  }
  const performanceBreakdown = Object.entries(difficultyMap).map(
    ([difficulty, scores]) => ({
      difficulty,
      obtained: scores.obtained,
      total: scores.total,
    }),
  );

  return (
    <div className="space-y-6">
      <ToastContainer />
      {/* Back navigation */}
      <Link
        to="/exams"
        className="inline-flex items-center gap-1 text-sm text-muted-foreground hover:text-foreground transition-colors"
      >
        <ChevronLeft className="h-4 w-4" />
        Back to Exams
      </Link>

      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-display tracking-tight">
          Exam Results
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          {evaluation.evaluated_by && (
            <Badge variant="secondary" className="mr-2 text-xs">
              Evaluated by {evaluation.evaluated_by}
            </Badge>
          )}
          {new Date(evaluation.evaluated_at).toLocaleDateString()}
        </p>
      </div>

      {/* Score Summary */}
      <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
        <Card className="md:col-span-1 flex items-center justify-center py-6">
          <ScoreIndicator
            score={evaluation.total_marks_obtained}
            maxScore={evaluation.total_marks_possible}
            size="lg"
          />
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground">Score</p>
            <p className="text-3xl font-bold font-display">
              {evaluation.total_marks_obtained}
              <span className="text-lg text-muted-foreground">
                /{evaluation.total_marks_possible}
              </span>
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground">Percentage</p>
            <p
              className={cn(
                "text-3xl font-bold font-display",
                evaluation.percentage >= 70
                  ? "text-green-600 dark:text-green-400"
                  : evaluation.percentage >= 40
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400",
              )}
            >
              {evaluation.percentage}%
            </p>
          </CardContent>
        </Card>
        <Card>
          <CardContent className="p-6 flex flex-col justify-center h-full">
            <p className="text-sm text-muted-foreground">Grade</p>
            <p
              className={cn(
                "text-3xl font-bold font-display",
                getGradeColor(evaluation.grade || ""),
              )}
            >
              {evaluation.grade || "-"}
            </p>
          </CardContent>
        </Card>
      </div>

      {/* Charts Row */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        {/* Topic Analysis */}
        {evaluation.topic_scores && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <BarChart3 className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">Topic Analysis</CardTitle>
              </div>
            </CardHeader>
            <CardContent className="space-y-3">
              {Object.entries(evaluation.topic_scores).map(
                ([topic, scores]) => {
                  const pct =
                    scores.total > 0
                      ? Math.round((scores.obtained / scores.total) * 100)
                      : 0;
                  return (
                    <div key={topic}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <span className="font-medium truncate mr-2">
                          {topic}
                        </span>
                        <span className="text-muted-foreground text-xs flex-shrink-0">
                          {scores.obtained}/{scores.total} ({pct}%)
                        </span>
                      </div>
                      <Progress
                        value={pct}
                        className={cn(
                          "h-2",
                          pct >= 70
                            ? "[&>div]:bg-green-500"
                            : pct >= 40
                              ? "[&>div]:bg-amber-500"
                              : "[&>div]:bg-red-500",
                        )}
                      />
                    </div>
                  );
                },
              )}
            </CardContent>
          </Card>
        )}

        {/* Bloom's Taxonomy */}
        {bloomsData.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <Brain className="h-4 w-4 text-primary" />
                <CardTitle className="text-base">
                  Bloom's Taxonomy Performance
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <BloomsRadar data={bloomsData} />
            </CardContent>
          </Card>
        )}
      </div>

      {/* Performance Breakdown */}
      {performanceBreakdown.length > 0 && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Target className="h-4 w-4 text-primary" />
              <CardTitle className="text-base">Performance Breakdown</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <DifficultyBreakdown data={performanceBreakdown} />
          </CardContent>
        </Card>
      )}

      {/* Strengths & Weaknesses */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {evaluation.strengths && evaluation.strengths.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <CheckCircle className="h-4 w-4 text-green-500" />
                <CardTitle className="text-base text-green-600 dark:text-green-400">
                  Strengths
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.strengths.map((s, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <CheckCircle className="h-3.5 w-3.5 text-green-500 mt-0.5 flex-shrink-0" />
                    <span>{s}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
        {evaluation.weaknesses && evaluation.weaknesses.length > 0 && (
          <Card>
            <CardHeader>
              <div className="flex items-center gap-2">
                <XCircle className="h-4 w-4 text-red-500" />
                <CardTitle className="text-base text-red-600 dark:text-red-400">
                  Areas to Improve
                </CardTitle>
              </div>
            </CardHeader>
            <CardContent>
              <ul className="space-y-2">
                {evaluation.weaknesses.map((w, i) => (
                  <li key={i} className="flex items-start gap-2 text-sm">
                    <XCircle className="h-3.5 w-3.5 text-red-500 mt-0.5 flex-shrink-0" />
                    <span>{w}</span>
                  </li>
                ))}
              </ul>
            </CardContent>
          </Card>
        )}
      </div>

      {/* Recommendations */}
      {evaluation.recommendations && (
        <Card>
          <CardHeader>
            <div className="flex items-center gap-2">
              <Lightbulb className="h-4 w-4 text-amber-500" />
              <CardTitle className="text-base">Study Recommendations</CardTitle>
            </div>
          </CardHeader>
          <CardContent>
            <p className="text-sm leading-relaxed whitespace-pre-wrap text-muted-foreground">
              {evaluation.recommendations}
            </p>
          </CardContent>
        </Card>
      )}

      {/* Question-wise Breakdown */}
      <Card>
        <CardHeader>
          <div className="flex items-center gap-2">
            <FileText className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Question-wise Breakdown</CardTitle>
          </div>
        </CardHeader>
        <CardContent className="divide-y">
          {evaluation.question_evaluations.map((qe, i) => {
            const scorePct =
              qe.marks_possible > 0 ? qe.marks_obtained / qe.marks_possible : 0;
            const explanation = explanations[qe.id];
            const isExplainLoading = explainLoading[qe.id];

            return (
              <div key={qe.id} className="py-4 first:pt-0 last:pb-0">
                <div className="flex items-start justify-between gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1.5 flex-wrap">
                      <span className="text-sm font-semibold">Q{i + 1}</span>
                      <Badge variant="outline" className="text-xs">
                        {qe.question_type?.replace("_", " ")}
                      </Badge>
                      <Badge
                        variant={
                          scorePct >= 0.7
                            ? "success"
                            : scorePct >= 0.3
                              ? "warning"
                              : "destructive"
                        }
                        className="text-xs"
                      >
                        {qe.marks_obtained}/{qe.marks_possible}
                      </Badge>
                    </div>
                    <p className="text-sm leading-relaxed mb-2">
                      {qe.question_text}
                    </p>

                    {/* Student answer */}
                    {qe.student_answer && (
                      <div className="bg-muted/50 rounded-md p-3 mb-2">
                        <p className="text-xs font-medium text-muted-foreground mb-1">
                          Your Answer
                        </p>
                        <p className="text-sm">{qe.student_answer}</p>
                      </div>
                    )}

                    {/* Model answer comparison */}
                    {qe.model_answer && (
                      <div className="bg-green-50 dark:bg-green-950/20 rounded-md p-3 mb-2 border border-green-100 dark:border-green-900">
                        <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                          Model Answer
                        </p>
                        <p className="text-sm text-green-800 dark:text-green-200">
                          {qe.model_answer}
                        </p>
                      </div>
                    )}

                    {/* Feedback */}
                    {qe.feedback && (
                      <p className="text-sm text-primary mt-1">{qe.feedback}</p>
                    )}

                    {/* Keywords */}
                    {qe.keywords_found && qe.keywords_found.length > 0 && (
                      <div className="flex items-center gap-1 mt-2 flex-wrap">
                        <span className="text-[10px] text-muted-foreground">
                          Keywords found:
                        </span>
                        {qe.keywords_found.map((kw) => (
                          <Badge
                            key={kw}
                            variant="success"
                            className="text-[10px]"
                          >
                            {kw}
                          </Badge>
                        ))}
                        {qe.keywords_missing?.map((kw) => (
                          <Badge
                            key={kw}
                            variant="destructive"
                            className="text-[10px]"
                          >
                            {kw}
                          </Badge>
                        ))}
                      </div>
                    )}

                    {/* AI Explain */}
                    {!explanation && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleExplain(qe.id)}
                        disabled={isExplainLoading}
                        className="mt-3 text-primary border-primary/30 hover:bg-primary/5"
                      >
                        <Sparkles className="h-3.5 w-3.5 mr-1" />
                        {isExplainLoading ? "Explaining..." : "Explain with AI"}
                      </Button>
                    )}

                    {/* AI Explanation panel */}
                    {explanation && (
                      <div className="mt-3 rounded-lg border border-primary/20 bg-primary/[0.02] p-4 space-y-3">
                        <div className="flex items-center gap-2">
                          <Sparkles className="h-4 w-4 text-primary" />
                          <span className="text-sm font-semibold text-primary">
                            AI Explanation
                          </span>
                        </div>
                        <p className="text-sm leading-relaxed">
                          {explanation.explanation}
                        </p>
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
                          <div className="bg-blue-50 dark:bg-blue-950/20 rounded-md p-3">
                            <p className="text-xs font-medium text-blue-600 dark:text-blue-400 mb-1">
                              Key Concept
                            </p>
                            <p className="text-xs text-blue-800 dark:text-blue-200">
                              {explanation.key_concept}
                            </p>
                          </div>
                          <div className="bg-amber-50 dark:bg-amber-950/20 rounded-md p-3">
                            <p className="text-xs font-medium text-amber-600 dark:text-amber-400 mb-1">
                              Common Mistake
                            </p>
                            <p className="text-xs text-amber-800 dark:text-amber-200">
                              {explanation.common_mistake}
                            </p>
                          </div>
                          <div className="bg-green-50 dark:bg-green-950/20 rounded-md p-3">
                            <p className="text-xs font-medium text-green-600 dark:text-green-400 mb-1">
                              Study Tip
                            </p>
                            <p className="text-xs text-green-800 dark:text-green-200">
                              {explanation.study_tip}
                            </p>
                          </div>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              </div>
            );
          })}
        </CardContent>
      </Card>

      {/* Generate Learning Plan CTA */}
      <Card className="border-primary/20 bg-primary/[0.02]">
        <CardContent className="py-6 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="rounded-lg bg-primary/10 p-3">
              <BookOpen className="h-5 w-5 text-primary" />
            </div>
            <div>
              <p className="font-semibold text-sm">
                Struggling with some topics?
              </p>
              <p className="text-xs text-muted-foreground">
                Generate a personalized learning plan based on your weak areas
              </p>
            </div>
          </div>
          <Link to="/learning">
            <Button>
              <TrendingUp className="h-4 w-4 mr-2" />
              Generate Learning Plan
            </Button>
          </Link>
        </CardContent>
      </Card>
    </div>
  );
};

export default ExamResults;
