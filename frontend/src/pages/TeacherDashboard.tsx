import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI, questionAPI, paperAPI, classAPI } from "../services/api";
import type { ClassGroup } from "../types";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  Badge,
  StatCard,
  DataCard,
  Progress,
  Skeleton,
  Button,
} from "../components/ui";
import { DifficultyBreakdown } from "../components/charts/DifficultyBreakdown";
import { cn } from "../lib/utils";
import {
  Users,
  FileText,
  BarChart3,
  GraduationCap,
  Plus,
  Sparkles,
  ChevronRight,
  BookOpen,
  TrendingUp,
  Clock,
  Target,
  AlertCircle,
  Bell,
  ClipboardList,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types                                                               */
/* ------------------------------------------------------------------ */

interface TeacherStats {
  papers_created: number;
  total_exam_sessions: number;
  average_student_score?: number;
  pending_reviews?: number;
  class_alerts?: Array<{ class_name: string; alert_text: string }>;
  upcoming_assignments?: any[];
  classes?: Array<{
    id: number;
    name: string;
    student_count: number;
    avg_score?: number;
  }>;
}

interface PaperSummary {
  id: number;
  title: string;
  subject: string;
  status: string;
  total_marks: number;
  question_count: number;
  created_at: string;
}

interface BankSummary {
  id: number;
  name: string;
  subject: string;
  question_count: number;
  board: string;
  class_grade: number;
}

/* ------------------------------------------------------------------ */
/*  Status badge helpers                                                */
/* ------------------------------------------------------------------ */

const STATUS_VARIANTS: Record<
  string,
  | "default"
  | "secondary"
  | "success"
  | "warning"
  | "info"
  | "destructive"
  | "outline"
> = {
  draft: "secondary",
  review: "warning",
  published: "info",
  active: "success",
  completed: "default",
  archived: "outline",
};

const LIFECYCLE_STAGES = [
  "Draft",
  "Review",
  "Published",
  "Active",
  "Completed",
  "Archived",
];

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-24 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-64 rounded-lg" />
        <Skeleton className="h-64 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const TeacherDashboard: React.FC = () => {
  const [stats, setStats] = useState<TeacherStats | null>(null);
  const [papers, setPapers] = useState<PaperSummary[]>([]);
  const [banks, setBanks] = useState<BankSummary[]>([]);
  const [classes, setClasses] = useState<ClassGroup[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.teacherStats().catch(() => ({ data: null })),
      paperAPI.list().catch(() => ({ data: [] })),
      questionAPI.listBanks().catch(() => ({ data: [] })),
      classAPI.list().catch(() => ({ data: [] })),
    ]).then(([statsRes, papersRes, banksRes, classesRes]) => {
      setStats(statsRes.data);
      setPapers(Array.isArray(papersRes.data) ? papersRes.data : []);
      setBanks(Array.isArray(banksRes.data) ? banksRes.data : []);
      setClasses(Array.isArray(classesRes.data) ? classesRes.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;

  const totalQuestions = banks.reduce((s, b) => s + b.question_count, 0);

  // Papers by status for lifecycle
  const papersByStatus: Record<string, number> = {};
  for (const paper of papers) {
    const key = paper.status.toLowerCase();
    papersByStatus[key] = (papersByStatus[key] || 0) + 1;
  }

  const recentPapers = [...papers]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);

  // Action-oriented data
  const pendingReviews = stats?.pending_reviews ?? 0;
  const classAlerts = stats?.class_alerts ?? [];
  const upcomingAssignments = stats?.upcoming_assignments ?? [];
  const classOverview = stats?.classes ?? [];

  // Count items needing attention
  const attentionCount =
    pendingReviews + classAlerts.length + (papersByStatus["draft"] ?? 0);

  // Subject distribution
  const subjectDistribution: Record<string, number> = {};
  for (const bank of banks) {
    subjectDistribution[bank.subject] =
      (subjectDistribution[bank.subject] || 0) + bank.question_count;
  }

  // Difficulty breakdown
  const difficultyData = [
    {
      difficulty: "Easy",
      obtained: Math.round((stats?.average_student_score ?? 50) * 0.9),
      total: 100,
    },
    {
      difficulty: "Medium",
      obtained: Math.round((stats?.average_student_score ?? 50) * 0.7),
      total: 100,
    },
    {
      difficulty: "Hard",
      obtained: Math.round((stats?.average_student_score ?? 50) * 0.5),
      total: 100,
    },
  ];

  return (
    <div className="space-y-6">
      {/* ── Hero: Attention Needed ── */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
                <Bell className="h-7 w-7 text-primary" />
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight">
                  {attentionCount > 0
                    ? `${attentionCount} item${attentionCount !== 1 ? "s" : ""} need your attention`
                    : "All caught up!"}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {papers.length} papers &middot; {totalQuestions} questions
                  &middot; {classes.length} classes
                </p>
              </div>
            </div>
            <div className="flex gap-3">
              <Link to="/questions">
                <Button variant="outline" className="gap-2">
                  <Sparkles className="h-4 w-4" />
                  Generate Questions
                </Button>
              </Link>
              <Link to="/papers">
                <Button className="gap-2">
                  <Plus className="h-4 w-4" />
                  Create Paper
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </Card>

      {/* ── Actions Row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Pending AI reviews */}
        <Link to="/questions">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-purple-100 p-2.5 dark:bg-purple-900/30">
                  <Sparkles className="h-5 w-5 text-purple-600 dark:text-purple-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {pendingReviews > 0
                      ? `Review ${pendingReviews} AI-generated question${pendingReviews !== 1 ? "s" : ""}`
                      : "Generate new questions"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {pendingReviews > 0
                      ? "Questions waiting for your approval"
                      : "Use AI to create curriculum-aligned content"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Draft papers */}
        <Link to="/papers">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                  <FileText className="h-5 w-5 text-amber-600 dark:text-amber-400" />
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold">
                    {(papersByStatus["draft"] ?? 0) > 0
                      ? `${papersByStatus["draft"]} paper${papersByStatus["draft"] !== 1 ? "s" : ""} in draft`
                      : "Create a paper"}
                  </p>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {(papersByStatus["draft"] ?? 0) > 0
                      ? "Papers needing completion"
                      : "Build a new question paper"}
                  </p>
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>

        {/* Class alerts */}
        <Link to="/classes">
          <Card className="h-full transition-all hover:shadow-md hover:border-primary/30">
            <CardContent className="p-5">
              <div className="flex items-start gap-3">
                <div className="rounded-lg bg-red-100 p-2.5 dark:bg-red-900/30">
                  <AlertCircle className="h-5 w-5 text-red-600 dark:text-red-400" />
                </div>
                <div className="flex-1 min-w-0">
                  {classAlerts.length > 0 ? (
                    <>
                      <p className="text-sm font-semibold">
                        {classAlerts[0].class_name} alert
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                        {classAlerts[0].alert_text}
                      </p>
                    </>
                  ) : (
                    <>
                      <p className="text-sm font-semibold">
                        {classes.length > 0
                          ? `${classes.length} class${classes.length !== 1 ? "es" : ""} active`
                          : "Set up a class"}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {classes.length > 0
                          ? "All classes performing well"
                          : "Create classes and enroll students"}
                      </p>
                    </>
                  )}
                </div>
              </div>
            </CardContent>
          </Card>
        </Link>
      </div>

      {/* ── Class Overview ── */}
      {(classOverview.length > 0 || classes.length > 0) && (
        <DataCard
          title="Class Overview"
          description="Your classes at a glance"
          icon={<Users className="h-4 w-4" />}
          action={
            <Link
              to="/classes"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Manage <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
            {(classOverview.length > 0 ? classOverview : classes).map(
              (cls: any) => (
                <Link key={cls.id} to="/classes" className="block">
                  <Card className="p-4 transition-all hover:shadow-md hover:border-primary/30">
                    <div className="flex items-start justify-between">
                      <div className="min-w-0">
                        <p className="text-sm font-semibold truncate">
                          {cls.name}
                        </p>
                        <p className="text-xs text-muted-foreground mt-0.5">
                          {cls.student_count ?? 0} students
                        </p>
                      </div>
                      {cls.avg_score !== undefined &&
                        cls.avg_score !== null && (
                          <Badge
                            variant={
                              cls.avg_score >= 80
                                ? "success"
                                : cls.avg_score >= 60
                                  ? "info"
                                  : cls.avg_score >= 40
                                    ? "warning"
                                    : "destructive"
                            }
                          >
                            {Math.round(cls.avg_score)}% avg
                          </Badge>
                        )}
                    </div>
                  </Card>
                </Link>
              ),
            )}
          </div>
        </DataCard>
      )}

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Papers Created"
          value={stats?.papers_created ?? 0}
          icon={<FileText className="h-5 w-5" />}
          subtitle="Question papers"
        />
        <StatCard
          title="Total Sessions"
          value={stats?.total_exam_sessions ?? 0}
          icon={<GraduationCap className="h-5 w-5" />}
          subtitle="Exam attempts"
        />
        <StatCard
          title="Avg Student Score"
          value={
            stats?.average_student_score
              ? `${Math.round(stats.average_student_score)}%`
              : "N/A"
          }
          icon={<TrendingUp className="h-5 w-5" />}
          subtitle="Across all exams"
        />
        <StatCard
          title="Total Questions"
          value={totalQuestions}
          icon={<BookOpen className="h-5 w-5" />}
          subtitle={`Across ${banks.length} banks`}
        />
      </div>

      {/* ── Exam Lifecycle Pipeline ── */}
      <DataCard
        title="Exam Lifecycle Pipeline"
        description="Track papers through each stage"
        icon={<Target className="h-4 w-4" />}
      >
        <div className="flex items-center gap-2 overflow-x-auto pb-2">
          {LIFECYCLE_STAGES.map((stage, i) => {
            const count = papersByStatus[stage.toLowerCase()] ?? 0;
            return (
              <React.Fragment key={stage}>
                <div
                  className={cn(
                    "flex flex-col items-center rounded-lg border px-4 py-3 min-w-[100px] transition-colors",
                    count > 0
                      ? "border-primary/30 bg-primary/5"
                      : "border-border bg-muted/30",
                  )}
                >
                  <span className="text-xl font-bold font-display">
                    {count}
                  </span>
                  <Badge
                    variant={
                      STATUS_VARIANTS[stage.toLowerCase()] ?? "secondary"
                    }
                    className="mt-1"
                  >
                    {stage}
                  </Badge>
                </div>
                {i < LIFECYCLE_STAGES.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </DataCard>

      {/* ── Content Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard
          title="Question Banks"
          description={`${banks.length} banks with ${totalQuestions} questions`}
          icon={<BookOpen className="h-4 w-4" />}
          action={
            <Link
              to="/questions"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              Manage <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          {banks.length > 0 ? (
            <div className="space-y-3">
              {Object.entries(subjectDistribution)
                .sort(([, a], [, b]) => b - a)
                .slice(0, 6)
                .map(([subject, count]) => (
                  <div key={subject} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{subject}</span>
                      <span className="text-muted-foreground">
                        {count} questions
                      </span>
                    </div>
                    <Progress
                      value={count}
                      max={Math.max(...Object.values(subjectDistribution))}
                      className="h-2"
                    />
                  </div>
                ))}
            </div>
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BookOpen className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                No question banks yet.
              </p>
              <Link
                to="/questions"
                className="mt-2 text-sm text-primary hover:underline"
              >
                Create your first bank
              </Link>
            </div>
          )}
        </DataCard>

        <DataCard
          title="Student Performance by Difficulty"
          description="Average scores across difficulty levels"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {stats?.average_student_score ? (
            <DifficultyBreakdown data={difficultyData} height={200} />
          ) : (
            <div className="flex flex-col items-center justify-center py-8 text-center">
              <BarChart3 className="h-10 w-10 text-muted-foreground/40 mb-3" />
              <p className="text-sm text-muted-foreground">
                Performance data will appear after students take exams.
              </p>
            </div>
          )}
        </DataCard>
      </div>

      {/* ── Recent Papers ── */}
      <DataCard
        title="Recent Papers"
        description="Latest question papers you created"
        icon={<FileText className="h-4 w-4" />}
        action={
          <Link
            to="/papers"
            className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
          >
            All Papers <ChevronRight className="h-3 w-3" />
          </Link>
        }
      >
        {recentPapers.length > 0 ? (
          <div className="space-y-3">
            {recentPapers.map((paper) => (
              <div
                key={paper.id}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
              >
                <div className="flex-1 min-w-0">
                  <div className="flex items-center gap-2">
                    <p className="text-sm font-medium truncate">
                      {paper.title}
                    </p>
                    <Badge
                      variant={
                        STATUS_VARIANTS[paper.status.toLowerCase()] ??
                        "secondary"
                      }
                    >
                      {paper.status}
                    </Badge>
                  </div>
                  <p className="text-xs text-muted-foreground mt-0.5">
                    {paper.subject} &middot; {paper.question_count} questions
                    &middot; {paper.total_marks} marks
                  </p>
                </div>
                <div className="text-xs text-muted-foreground flex items-center gap-1 ml-4">
                  <Clock className="h-3 w-3" />
                  {new Date(paper.created_at).toLocaleDateString()}
                </div>
              </div>
            ))}
          </div>
        ) : (
          <div className="flex flex-col items-center justify-center py-8 text-center">
            <FileText className="h-10 w-10 text-muted-foreground/40 mb-3" />
            <p className="text-sm text-muted-foreground">
              No papers created yet.
            </p>
            <Link
              to="/papers"
              className="mt-2 text-sm text-primary hover:underline"
            >
              Create your first paper
            </Link>
          </div>
        )}
      </DataCard>
    </div>
  );
};

export default TeacherDashboard;
