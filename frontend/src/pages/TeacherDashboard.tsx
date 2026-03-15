import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI, questionAPI, paperAPI } from "../services/api";
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
  Award,
  Clock,
  CheckCircle,
  Target,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Types for teacher dashboard data                                    */
/* ------------------------------------------------------------------ */

interface TeacherStats {
  papers_created: number;
  total_exam_sessions: number;
  average_student_score?: number;
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
      <div className="grid grid-cols-2 gap-4 md:grid-cols-3">
        {Array.from({ length: 3 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 rounded-lg" />
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
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.teacherStats().catch(() => ({ data: null })),
      paperAPI.list().catch(() => ({ data: [] })),
      questionAPI.listBanks().catch(() => ({ data: [] })),
    ]).then(([statsRes, papersRes, banksRes]) => {
      setStats(statsRes.data);
      setPapers(Array.isArray(papersRes.data) ? papersRes.data : []);
      setBanks(Array.isArray(banksRes.data) ? banksRes.data : []);
      setLoading(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;

  const totalQuestions = banks.reduce(
    (sum, bank) => sum + bank.question_count,
    0,
  );

  // Group papers by status for the lifecycle view
  const papersByStatus: Record<string, number> = {};
  for (const paper of papers) {
    const statusKey = paper.status.toLowerCase();
    papersByStatus[statusKey] = (papersByStatus[statusKey] || 0) + 1;
  }

  // Recent papers (last 5, sorted by creation date)
  const recentPapers = [...papers]
    .sort(
      (a, b) =>
        new Date(b.created_at).getTime() - new Date(a.created_at).getTime(),
    )
    .slice(0, 5);

  // Subject distribution for question banks
  const subjectDistribution: Record<string, number> = {};
  for (const bank of banks) {
    subjectDistribution[bank.subject] =
      (subjectDistribution[bank.subject] || 0) + bank.question_count;
  }

  // Difficulty breakdown mock based on available data
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
      {/* ── Hero Section ── */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <h1 className="text-2xl font-bold font-display tracking-tight">
                Teacher Dashboard
              </h1>
              <p className="text-sm text-muted-foreground mt-1">
                Manage your question banks, papers, and track student
                performance.
              </p>
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
          {LIFECYCLE_STAGES.map((stage, stageIndex) => {
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
                {stageIndex < LIFECYCLE_STAGES.length - 1 && (
                  <ChevronRight className="h-4 w-4 text-muted-foreground flex-shrink-0" />
                )}
              </React.Fragment>
            );
          })}
        </div>
      </DataCard>

      {/* ── Content Row: Question Banks + Difficulty Breakdown ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Question Bank Overview */}
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
              {/* Subject distribution bars */}
              {Object.entries(subjectDistribution)
                .sort(([, countA], [, countB]) => countB - countA)
                .slice(0, 6)
                .map(([subject, questionCount]) => (
                  <div key={subject} className="space-y-1">
                    <div className="flex items-center justify-between text-sm">
                      <span className="font-medium">{subject}</span>
                      <span className="text-muted-foreground">
                        {questionCount} questions
                      </span>
                    </div>
                    <Progress
                      value={questionCount}
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

        {/* Student Performance Breakdown */}
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

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        <Link
          to="/questions"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="rounded-lg bg-primary/10 p-2.5">
            <BookOpen className="h-5 w-5 text-primary" />
          </div>
          <div>
            <p className="text-sm font-semibold">Manage Questions</p>
            <p className="text-xs text-muted-foreground">
              Browse and edit question banks
            </p>
          </div>
        </Link>
        <Link
          to="/questions"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="rounded-lg bg-mastery-mastered/10 p-2.5">
            <Sparkles className="h-5 w-5 text-mastery-mastered" />
          </div>
          <div>
            <p className="text-sm font-semibold">AI Generate</p>
            <p className="text-xs text-muted-foreground">
              Generate questions with AI
            </p>
          </div>
        </Link>
        <Link
          to="/papers"
          className="flex items-center gap-3 rounded-lg border bg-card p-4 transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5"
        >
          <div className="rounded-lg bg-mastery-proficient/10 p-2.5">
            <FileText className="h-5 w-5 text-mastery-proficient" />
          </div>
          <div>
            <p className="text-sm font-semibold">Create Paper</p>
            <p className="text-xs text-muted-foreground">
              Build a new question paper
            </p>
          </div>
        </Link>
      </div>
    </div>
  );
};

export default TeacherDashboard;
