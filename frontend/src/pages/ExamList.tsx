import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { paperAPI, examAPI } from "../services/api";
import type { QuestionPaper, ExamSession } from "../types";
import {
  Button,
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  CardDescription,
  Badge,
  Skeleton,
  StatCard,
} from "../components/ui";
import { cn } from "../lib/utils";
import {
  Play,
  BookOpen,
  Clock,
  Award,
  Target,
  TrendingUp,
  FileText,
  CheckCircle,
  BarChart3,
} from "lucide-react";

const ExamList: React.FC = () => {
  const [papers, setPapers] = useState<QuestionPaper[]>([]);
  const [myExams, setMyExams] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    Promise.all([
      paperAPI.list({ status: "published" }).catch(() => ({ data: [] })),
      paperAPI.list({ status: "active" }).catch(() => ({ data: [] })),
      examAPI.list().catch(() => ({ data: [] })),
    ]).then(([pub, active, exams]) => {
      setPapers([...(pub.data || []), ...(active.data || [])]);
      setMyExams(exams.data || []);
      setLoading(false);
    });
  }, []);

  const startExam = async (paperId: number, practice: boolean) => {
    try {
      const { data } = await examAPI.start({
        paper_id: paperId,
        is_practice: practice,
      });
      navigate(`/exam/${data.id}`);
    } catch (err: any) {
      alert(err.response?.data?.detail || "Failed to start exam");
    }
  };

  const getStatusVariant = (status: string) => {
    switch (status) {
      case "evaluated":
      case "reviewed":
        return "success" as const;
      case "in_progress":
        return "warning" as const;
      case "submitted":
        return "info" as const;
      default:
        return "secondary" as const;
    }
  };

  const getScoreColor = (pct: number | undefined) => {
    if (pct === undefined || pct === null) return "";
    if (pct >= 70) return "text-green-600 dark:text-green-400";
    if (pct >= 40) return "text-amber-600 dark:text-amber-400";
    return "text-red-600 dark:text-red-400";
  };

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // Compute stats
  const completedExams = myExams.filter(
    (e) => e.status === "evaluated" || e.status === "reviewed",
  );
  const averageScore =
    completedExams.length > 0
      ? Math.round(
          completedExams.reduce((sum, e) => sum + (e.percentage || 0), 0) /
            completedExams.length,
        )
      : null;
  const inProgressExams = myExams.filter((e) => e.status === "in_progress");

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-display tracking-tight">
          Exams
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          Take exams, practice, and track your progress
        </p>
      </div>

      {/* Stats */}
      {myExams.length > 0 && (
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
          <StatCard
            title="Total Exams"
            value={myExams.length}
            icon={<FileText className="h-5 w-5" />}
          />
          <StatCard
            title="Completed"
            value={completedExams.length}
            icon={<CheckCircle className="h-5 w-5" />}
          />
          <StatCard
            title="Average Score"
            value={averageScore !== null ? `${averageScore}%` : "-"}
            icon={<TrendingUp className="h-5 w-5" />}
          />
          <StatCard
            title="In Progress"
            value={inProgressExams.length}
            icon={<Clock className="h-5 w-5" />}
          />
        </div>
      )}

      {/* In Progress Exams */}
      {inProgressExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            Continue Where You Left Off
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {inProgressExams.map((exam) => (
              <Card
                key={exam.id}
                className="border-amber-200 dark:border-amber-800 bg-amber-50/30 dark:bg-amber-950/10"
              >
                <CardContent className="p-4 flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="rounded-lg bg-amber-100 dark:bg-amber-900/30 p-2">
                      <Clock className="h-4 w-4 text-amber-600" />
                    </div>
                    <div>
                      <p className="text-sm font-medium">Exam #{exam.id}</p>
                      <p className="text-xs text-muted-foreground">
                        {exam.is_practice && (
                          <Badge
                            variant="secondary"
                            className="mr-1 text-[10px]"
                          >
                            Practice
                          </Badge>
                        )}
                        {Math.round(exam.time_spent_seconds / 60)} min spent
                      </p>
                    </div>
                  </div>
                  <Link to={`/exam/${exam.id}`}>
                    <Button size="sm">
                      <Play className="h-3.5 w-3.5 mr-1" />
                      Continue
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Exam History */}
      {completedExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BarChart3 className="h-4 w-4 text-primary" />
            Exam History
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {myExams
              .filter(
                (e) =>
                  e.status === "evaluated" ||
                  e.status === "reviewed" ||
                  e.status === "submitted",
              )
              .map((exam) => (
                <Card key={exam.id} className="transition-all hover:shadow-sm">
                  <CardContent className="p-4">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center gap-4">
                        <div className="flex items-center gap-2">
                          <span className="text-sm font-medium">
                            Exam #{exam.id}
                          </span>
                          <Badge
                            variant={getStatusVariant(exam.status)}
                            className="text-xs"
                          >
                            {exam.status.replace("_", " ")}
                          </Badge>
                          {exam.is_practice && (
                            <Badge variant="outline" className="text-xs">
                              Practice
                            </Badge>
                          )}
                        </div>
                      </div>
                      <div className="flex items-center gap-4">
                        {exam.percentage != null && (
                          <span
                            className={cn(
                              "text-lg font-bold font-display",
                              getScoreColor(exam.percentage),
                            )}
                          >
                            {exam.percentage}%
                          </span>
                        )}
                        {exam.grade && (
                          <Badge variant="secondary" className="text-xs">
                            {exam.grade}
                          </Badge>
                        )}
                        {exam.status === "evaluated" ||
                        exam.status === "reviewed" ? (
                          <Link to={`/results/${exam.id}`}>
                            <Button variant="outline" size="sm">
                              <Award className="h-3.5 w-3.5 mr-1" />
                              View Results
                            </Button>
                          </Link>
                        ) : exam.status === "submitted" ? (
                          <Link to={`/results/${exam.id}`}>
                            <Button size="sm">
                              <Target className="h-3.5 w-3.5 mr-1" />
                              Evaluate
                            </Button>
                          </Link>
                        ) : null}
                      </div>
                    </div>
                  </CardContent>
                </Card>
              ))}
          </div>
        </div>
      )}

      {/* Available Papers */}
      <div className="space-y-3">
        <h3 className="text-lg font-semibold flex items-center gap-2">
          <BookOpen className="h-4 w-4 text-primary" />
          Available Question Papers
        </h3>
        {papers.length === 0 ? (
          <Card>
            <CardContent className="py-12 text-center">
              <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
              <p className="text-muted-foreground font-medium">
                No papers available
              </p>
              <p className="text-sm text-muted-foreground mt-1">
                Ask your teacher to publish question papers
              </p>
            </CardContent>
          </Card>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {papers.map((paper) => (
              <Card key={paper.id} className="transition-all hover:shadow-md">
                <CardHeader className="pb-3">
                  <div className="flex items-start justify-between">
                    <div>
                      <CardTitle className="text-base">{paper.title}</CardTitle>
                      <CardDescription className="mt-1">
                        {paper.board} | Class {paper.class_grade} |{" "}
                        {paper.subject}
                      </CardDescription>
                    </div>
                    <Badge
                      variant={
                        paper.status === "active" ? "success" : "secondary"
                      }
                      className="text-xs"
                    >
                      {paper.status}
                    </Badge>
                  </div>
                </CardHeader>
                <CardContent>
                  <div className="flex items-center gap-4 text-xs text-muted-foreground mb-4">
                    <span className="flex items-center gap-1">
                      <Target className="h-3 w-3" />
                      {paper.total_marks} marks
                    </span>
                    <span className="flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {paper.duration_minutes} min
                    </span>
                    <span className="flex items-center gap-1">
                      <FileText className="h-3 w-3" />
                      {paper.question_count} questions
                    </span>
                  </div>
                  <div className="flex gap-2">
                    <Button
                      variant="outline"
                      size="sm"
                      onClick={() => startExam(paper.id, true)}
                      className="flex-1"
                    >
                      <BookOpen className="h-3.5 w-3.5 mr-1" />
                      Practice
                    </Button>
                    {paper.status === "active" && (
                      <Button
                        size="sm"
                        onClick={() => startExam(paper.id, false)}
                        className="flex-1"
                      >
                        <Play className="h-3.5 w-3.5 mr-1" />
                        Start Exam
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default ExamList;
