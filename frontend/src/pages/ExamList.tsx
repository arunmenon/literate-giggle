import React, { useEffect, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { examAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import type { ExamSession } from "../types";
import {
  Button,
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  Skeleton,
  Input,
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
  Calendar,
  Users,
  ChevronRight,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Helpers                                                             */
/* ------------------------------------------------------------------ */

function formatCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  return `${Math.floor(diff / 60000)}m`;
}

function getStudentStatusLabel(status: string): string {
  switch (status) {
    case "in_progress":
      return "In Progress";
    case "submitted":
      return "Submitted";
    case "evaluated":
    case "reviewed":
      return "Results Ready";
    default:
      return status.replace("_", " ");
  }
}

function getStatusVariant(status: string) {
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
}

function getScoreColor(pct: number | undefined) {
  if (pct === undefined || pct === null) return "";
  if (pct >= 70) return "text-green-600 dark:text-green-400";
  if (pct >= 40) return "text-amber-600 dark:text-amber-400";
  return "text-red-600 dark:text-red-400";
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const ExamList: React.FC = () => {
  const { workspaceId } = useAuth();
  const [myExams, setMyExams] = useState<ExamSession[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  // Upcoming exams from assigned classes (from exam list API)
  const [assignedExams, setAssignedExams] = useState<any[]>([]);

  useEffect(() => {
    examAPI
      .list()
      .then((res) => {
        const data = res.data;
        // The API may return { sessions, assignments } or just sessions
        if (Array.isArray(data)) {
          setMyExams(data);
        } else {
          setMyExams(data.sessions || data.exams || []);
          setAssignedExams(data.assignments || data.upcoming || []);
        }
      })
      .catch(() => {
        setMyExams([]);
      })
      .finally(() => setLoading(false));
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

  if (loading) {
    return (
      <div className="space-y-6">
        <Skeleton className="h-10 w-48" />
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-28" />
          ))}
        </div>
        <Skeleton className="h-64" />
      </div>
    );
  }

  // No workspace = show join CTA
  if (!workspaceId) {
    return (
      <div className="space-y-6">
        <div>
          <h2 className="text-2xl font-bold font-display tracking-tight">
            My Exams
          </h2>
          <p className="text-sm text-muted-foreground mt-1">
            Join a classroom to see your assigned exams
          </p>
        </div>
        <Card className="py-12 text-center">
          <CardContent>
            <Users className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-lg font-medium text-foreground">
              Join a Classroom
            </p>
            <p className="text-sm text-muted-foreground mt-1 mb-4">
              Enter your teacher's invite code to see your assigned exams.
            </p>
            <Link to="/workspace-setup">
              <Button className="gap-2">
                <Users className="h-4 w-4" />
                Join Classroom
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  // Categorize exams
  const inProgressExams = myExams.filter((e) => e.status === "in_progress");
  const completedExams = myExams.filter(
    (e) =>
      e.status === "evaluated" ||
      e.status === "reviewed" ||
      e.status === "submitted",
  );
  const practiceExams = myExams.filter((e) => e.is_practice);
  const formalCompleted = completedExams.filter((e) => !e.is_practice);

  // Upcoming = assigned but not yet started
  const upcomingExams = assignedExams.filter((a: any) => a.status === "active");

  // Stats
  const averageScore =
    formalCompleted.length > 0
      ? Math.round(
          formalCompleted.reduce((s, e) => s + (e.percentage || 0), 0) /
            formalCompleted.length,
        )
      : null;

  return (
    <div className="space-y-6">
      {/* Page Header */}
      <div>
        <h2 className="text-2xl font-bold font-display tracking-tight">
          My Exams
        </h2>
        <p className="text-sm text-muted-foreground mt-1">
          View upcoming exams, continue in-progress, and review your results
        </p>
      </div>

      {/* Stats */}
      {myExams.length > 0 && (
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
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

      {/* Upcoming Exams */}
      {upcomingExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Calendar className="h-4 w-4 text-blue-500" />
            Upcoming
          </h3>
          <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
            {upcomingExams.map((exam: any, i: number) => (
              <Card key={i} className="transition-all hover:shadow-md">
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-medium truncate">
                        {exam.paper_title || "Exam"}
                      </p>
                      <div className="flex items-center gap-2 mt-1 text-xs text-muted-foreground">
                        {exam.class_name && <span>{exam.class_name}</span>}
                        {exam.start_at && (
                          <span className="flex items-center gap-1">
                            <Clock className="h-3 w-3" />
                            Starts in {formatCountdown(exam.start_at)}
                          </span>
                        )}
                        {exam.is_practice && (
                          <Badge variant="outline" className="text-xs">
                            Practice
                          </Badge>
                        )}
                      </div>
                    </div>
                    <Badge variant="info">Available</Badge>
                  </div>
                  <div className="mt-3 flex gap-2">
                    {exam.is_practice ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => startExam(exam.paper_id, true)}
                        className="gap-1"
                      >
                        <BookOpen className="h-3.5 w-3.5" />
                        Practice
                      </Button>
                    ) : (
                      <Button
                        size="sm"
                        onClick={() => startExam(exam.paper_id, false)}
                        className="gap-1"
                      >
                        <Play className="h-3.5 w-3.5" />
                        Start Exam
                      </Button>
                    )}
                  </div>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* In Progress Exams */}
      {inProgressExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <Clock className="h-4 w-4 text-amber-500" />
            In Progress
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
                    <Button size="sm" className="gap-1">
                      <Play className="h-3.5 w-3.5" />
                      Continue
                    </Button>
                  </Link>
                </CardContent>
              </Card>
            ))}
          </div>
        </div>
      )}

      {/* Completed Exams */}
      {completedExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <CheckCircle className="h-4 w-4 text-green-500" />
            Completed
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {completedExams
              .filter((e) => !e.is_practice)
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
                            {getStudentStatusLabel(exam.status)}
                          </Badge>
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
                            <Button
                              variant="outline"
                              size="sm"
                              className="gap-1"
                            >
                              <Award className="h-3.5 w-3.5" />
                              View Results
                            </Button>
                          </Link>
                        ) : exam.status === "submitted" ? (
                          <Link to={`/results/${exam.id}`}>
                            <Button size="sm" className="gap-1">
                              <Target className="h-3.5 w-3.5" />
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

      {/* Practice Exams */}
      {practiceExams.length > 0 && (
        <div className="space-y-3">
          <h3 className="text-lg font-semibold flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-purple-500" />
            Practice
          </h3>
          <div className="grid grid-cols-1 gap-2">
            {practiceExams.map((exam) => (
              <Card
                key={exam.id}
                className="transition-all hover:shadow-sm border-purple-100 dark:border-purple-900/30"
              >
                <CardContent className="p-4">
                  <div className="flex items-center justify-between">
                    <div className="flex items-center gap-3">
                      <Badge
                        variant="outline"
                        className="text-xs text-purple-600 dark:text-purple-400 border-purple-200 dark:border-purple-800"
                      >
                        Practice
                      </Badge>
                      <span className="text-sm font-medium">
                        Exam #{exam.id}
                      </span>
                      <Badge
                        variant={getStatusVariant(exam.status)}
                        className="text-xs"
                      >
                        {getStudentStatusLabel(exam.status)}
                      </Badge>
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
                      {exam.status === "in_progress" ? (
                        <Link to={`/exam/${exam.id}`}>
                          <Button size="sm" className="gap-1">
                            <Play className="h-3.5 w-3.5" />
                            Continue
                          </Button>
                        </Link>
                      ) : exam.status === "evaluated" ||
                        exam.status === "reviewed" ? (
                        <Link to={`/results/${exam.id}`}>
                          <Button variant="outline" size="sm" className="gap-1">
                            <Award className="h-3.5 w-3.5" />
                            Results
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

      {/* Empty state */}
      {myExams.length === 0 && upcomingExams.length === 0 && (
        <Card>
          <CardContent className="py-12 text-center">
            <FileText className="h-12 w-12 mx-auto text-muted-foreground/40 mb-3" />
            <p className="text-muted-foreground font-medium">No exams yet</p>
            <p className="text-sm text-muted-foreground mt-1">
              Your teacher will assign exams to your class. Check back soon.
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
};

export default ExamList;
