import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI, learningAPI, examAPI } from "../services/api";
import { useAuth } from "../store/AuthContext";
import type {
  StudentDashboard as DashboardData,
  TopicMastery,
  LearningPlan,
  CrossWorkspaceExam,
} from "../types";
import TeacherBadge from "../components/TeacherBadge";
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  CardDescription,
  Badge,
  StatCard,
  ScoreIndicator,
  MasteryBadge,
  DataCard,
  Progress,
  Skeleton,
  Button,
} from "../components/ui";
import { ProgressChart } from "../components/charts/ProgressChart";
import { MasteryHeatmap } from "../components/charts/MasteryHeatmap";
import { BloomsRadar } from "../components/charts/BloomsRadar";
import { cn, getGradeColor, formatPercentage } from "../lib/utils";
import {
  BookOpen,
  TrendingUp,
  Award,
  Target,
  Brain,
  BarChart3,
  GraduationCap,
  Calendar,
  Clock,
  Zap,
  ChevronRight,
  Play,
  Sparkles,
  Users,
  AlertCircle,
  ArrowUp,
  ArrowDown,
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <Skeleton className="h-28 rounded-lg" />
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {[1, 2, 3].map((i) => (
          <Skeleton key={i} className="h-28 rounded-lg" />
        ))}
      </div>
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Countdown helper                                                    */
/* ------------------------------------------------------------------ */

function formatCountdown(dateStr: string): string {
  const diff = new Date(dateStr).getTime() - Date.now();
  if (diff <= 0) return "Now";
  const hours = Math.floor(diff / 3600000);
  const days = Math.floor(hours / 24);
  if (days > 0) return `${days}d ${hours % 24}h`;
  if (hours > 0) return `${hours}h`;
  const minutes = Math.floor(diff / 60000);
  return `${minutes}m`;
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const StudentDashboard: React.FC = () => {
  const { workspaceId } = useAuth();
  const [data, setData] = useState<DashboardData | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);

  // Extended dashboard data from backend (task #4)
  const [upcomingExams, setUpcomingExams] = useState<any[]>([]);
  const [crossWorkspaceExams, setCrossWorkspaceExams] = useState<
    CrossWorkspaceExam[]
  >([]);
  const [recommendedAction, setRecommendedAction] = useState<string>("");
  const [weeklyProgress, setWeeklyProgress] = useState<number | null>(null);

  useEffect(() => {
    Promise.all([
      dashboardAPI.student().catch(() => ({ data: null })),
      learningAPI.getMastery().catch(() => ({ data: [] })),
      learningAPI.listPlans().catch(() => ({ data: [] })),
      examAPI.getAllWorkspaces().catch(() => ({ data: [] })),
    ]).then(([dashRes, masteryRes, plansRes, crossWsRes]) => {
      const dashData = dashRes.data;
      setData(dashData);
      // Extract new action-oriented fields from backend
      if (dashData) {
        setUpcomingExams(dashData.upcoming_exams || []);
        setRecommendedAction(dashData.recommended_action || "");
        setWeeklyProgress(dashData.weekly_progress ?? null);
      }
      setMastery(masteryRes.data || []);
      setPlans(plansRes.data || []);
      setCrossWorkspaceExams(crossWsRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;

  // No workspace = show join CTA
  if (!workspaceId) {
    return (
      <div className="flex min-h-[50vh] items-center justify-center">
        <Card className="w-full max-w-md text-center">
          <CardHeader>
            <div className="mx-auto mb-2 flex h-14 w-14 items-center justify-center rounded-full bg-primary/10">
              <Users className="h-7 w-7 text-primary" />
            </div>
            <CardTitle>Join a Classroom</CardTitle>
            <CardDescription>
              Connect with your teacher to access exams, track progress, and get
              personalized study plans.
            </CardDescription>
          </CardHeader>
          <CardContent>
            <Link to="/workspace-setup">
              <Button className="gap-2">
                <Users className="h-4 w-4" />
                Get Started
              </Button>
            </Link>
          </CardContent>
        </Card>
      </div>
    );
  }

  if (!data) {
    return (
      <Card className="p-8 text-center">
        <p className="text-muted-foreground">
          Failed to load dashboard. Please try again.
        </p>
      </Card>
    );
  }

  /* ---- Derived data ---- */

  const readinessScore =
    mastery.length > 0
      ? Math.round(
          mastery.reduce((sum, t) => sum + t.avg_score_pct, 0) / mastery.length,
        )
      : data.average_score
        ? Math.round(data.average_score)
        : null;

  const scoreChartData = data.recent_scores.map((s) => ({
    label: s.exam.length > 12 ? s.exam.slice(0, 12) + "..." : s.exam,
    score: s.score,
    date: s.date,
  }));

  const masteryHeatmapData = mastery.map((t) => ({
    topic: t.topic,
    masteryLevel: t.mastery_level,
    score: t.avg_score_pct,
  }));

  const bloomsLevels = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ];
  const bloomsData = bloomsLevels.map((level, i) => ({
    level,
    score: data.average_score
      ? Math.max(10, Math.round((data.average_score ?? 0) * (1 - i * 0.1)))
      : 0,
    fullMark: 100,
  }));

  const weakestTopic =
    mastery.length > 0
      ? mastery.reduce((w, c) => (c.avg_score_pct < w.avg_score_pct ? c : w))
      : null;

  // Use cross-workspace exams count when available for the action card
  const totalUpcomingCount =
    crossWorkspaceExams.length > 0
      ? crossWorkspaceExams.length
      : upcomingExams.length;

  const activePlans = plans.filter((p) => p.is_active);

  return (
    <div className="space-y-6">
      {/* ── Hero: Readiness Score ── */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold font-display shadow-md">
                {data.user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight">
                  {readinessScore !== null
                    ? `Your readiness score is ${readinessScore}%`
                    : `Welcome back, ${data.user.full_name.split(" ")[0]}`}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {data.profile.board} &middot; Class {data.profile.class_grade}{" "}
                  &middot; {data.profile.academic_year}
                  {weeklyProgress !== null && (
                    <span
                      className={cn(
                        "ml-2 inline-flex items-center gap-0.5 font-medium",
                        weeklyProgress >= 0
                          ? "text-green-600 dark:text-green-400"
                          : "text-red-500 dark:text-red-400",
                      )}
                    >
                      {weeklyProgress >= 0 ? (
                        <ArrowUp className="h-3 w-3" />
                      ) : (
                        <ArrowDown className="h-3 w-3" />
                      )}
                      {Math.abs(weeklyProgress)}% this week
                    </span>
                  )}
                </p>
              </div>
            </div>

            {readinessScore !== null && (
              <ScoreIndicator
                score={readinessScore}
                maxScore={100}
                size="lg"
                showPercentage
              />
            )}
          </div>
        </div>
      </Card>

      {/* ── Actions Row ── */}
      <div className="grid grid-cols-1 gap-4 sm:grid-cols-3">
        {/* Upcoming exams */}
        <Card className="transition-all hover:shadow-md hover:border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-blue-100 p-2.5 dark:bg-blue-900/30">
                <Calendar className="h-5 w-5 text-blue-600 dark:text-blue-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {totalUpcomingCount > 0
                    ? `${totalUpcomingCount} upcoming exam${totalUpcomingCount !== 1 ? "s" : ""}`
                    : "No upcoming exams"}
                </p>
                {totalUpcomingCount > 0 &&
                (crossWorkspaceExams[0]?.start_at ||
                  upcomingExams[0]?.start_at) ? (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Next in{" "}
                    {formatCountdown(
                      crossWorkspaceExams[0]?.start_at ||
                        upcomingExams[0]?.start_at,
                    )}
                  </p>
                ) : (
                  <p className="text-xs text-muted-foreground mt-0.5">
                    Check back later
                  </p>
                )}
              </div>
            </div>
            {totalUpcomingCount > 0 && (
              <Link
                to="/exams"
                className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
              >
                View exams <ChevronRight className="h-3 w-3" />
              </Link>
            )}
          </CardContent>
        </Card>

        {/* Practice weakest topic */}
        <Card className="transition-all hover:shadow-md hover:border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-amber-100 p-2.5 dark:bg-amber-900/30">
                <Target className="h-5 w-5 text-amber-600 dark:text-amber-400" />
              </div>
              <div className="flex-1 min-w-0">
                {weakestTopic ? (
                  <>
                    <p className="text-sm font-semibold">
                      Practice {weakestTopic.topic}
                    </p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Your weakest topic (
                      {Math.round(weakestTopic.avg_score_pct)}% avg)
                    </p>
                  </>
                ) : recommendedAction ? (
                  <>
                    <p className="text-sm font-semibold">AI Recommendation</p>
                    <p className="text-xs text-muted-foreground mt-0.5 line-clamp-2">
                      {recommendedAction}
                    </p>
                  </>
                ) : (
                  <>
                    <p className="text-sm font-semibold">Start practicing</p>
                    <p className="text-xs text-muted-foreground mt-0.5">
                      Take exams to get topic recommendations
                    </p>
                  </>
                )}
              </div>
            </div>
            <Link
              to="/exams"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              Start practice <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>

        {/* Score trend */}
        <Card className="transition-all hover:shadow-md hover:border-primary/30">
          <CardContent className="p-5">
            <div className="flex items-start gap-3">
              <div className="rounded-lg bg-green-100 p-2.5 dark:bg-green-900/30">
                <TrendingUp className="h-5 w-5 text-green-600 dark:text-green-400" />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-semibold">
                  {data.average_score
                    ? `${Math.round(data.average_score)}% average`
                    : "No scores yet"}
                </p>
                <p className="text-xs text-muted-foreground mt-0.5">
                  {data.total_exams_taken} exam
                  {data.total_exams_taken !== 1 ? "s" : ""} taken
                </p>
              </div>
            </div>
            <Link
              to="/learning"
              className="mt-3 inline-flex items-center gap-1 text-xs font-medium text-primary hover:underline"
            >
              View learning plans <ChevronRight className="h-3 w-3" />
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Upcoming Exams List (cross-workspace aggregated) ── */}
      {(crossWorkspaceExams.length > 0 || upcomingExams.length > 0) && (
        <DataCard
          title="Upcoming Exams"
          description="Exams from all your teachers"
          icon={<Calendar className="h-4 w-4" />}
          action={
            <Link
              to="/exams"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              All Exams <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="space-y-2">
            {(crossWorkspaceExams.length > 0
              ? crossWorkspaceExams.slice(0, 5)
              : upcomingExams.slice(0, 5)
            ).map((exam: any, i: number) => (
              <div
                key={exam.assignment_id || i}
                className="flex items-center justify-between rounded-lg border p-3 transition-colors hover:bg-muted/30"
                style={{
                  borderLeftWidth: exam.color ? 3 : undefined,
                  borderLeftColor: exam.color || undefined,
                }}
              >
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {exam.paper_title || exam.title || "Exam"}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                    {exam.teacher_name && exam.color && (
                      <TeacherBadge
                        teacherName={exam.teacher_name}
                        color={exam.color}
                      />
                    )}
                    {exam.class_name && (
                      <span className="text-xs text-muted-foreground">
                        {exam.class_name}
                      </span>
                    )}
                    {exam.label && (
                      <span className="text-xs text-muted-foreground">
                        {exam.label}
                      </span>
                    )}
                    {exam.is_practice && (
                      <span className="text-xs text-muted-foreground">
                        Practice
                      </span>
                    )}
                  </div>
                </div>
                <div className="flex items-center gap-2 ml-3">
                  {exam.start_at && (
                    <span className="text-xs text-muted-foreground flex items-center gap-1">
                      <Clock className="h-3 w-3" />
                      {formatCountdown(exam.start_at)}
                    </span>
                  )}
                  <Badge
                    variant={exam.status === "active" ? "success" : "secondary"}
                  >
                    {exam.status === "active" ? "Available" : exam.status}
                  </Badge>
                </div>
              </div>
            ))}
          </div>
        </DataCard>
      )}

      {/* ── Charts Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        <DataCard
          title="Score Trend"
          description="Your recent exam performance over time"
          icon={<BarChart3 className="h-4 w-4" />}
        >
          {scoreChartData.length > 0 ? (
            <ProgressChart data={scoreChartData} height={220} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Take exams to see your score trend.
            </div>
          )}
        </DataCard>

        <DataCard
          title="Cognitive Skills"
          description="Performance across Bloom's Taxonomy levels"
          icon={<Brain className="h-4 w-4" />}
        >
          {data.average_score ? (
            <BloomsRadar data={bloomsData} height={220} />
          ) : (
            <div className="flex h-48 items-center justify-center text-sm text-muted-foreground">
              Complete exams to see cognitive skill analysis.
            </div>
          )}
        </DataCard>
      </div>

      {/* ── Topic Mastery Heatmap ── */}
      {mastery.length > 0 && (
        <DataCard
          title="Topic Mastery"
          description="Your mastery level across all topics"
          icon={<Award className="h-4 w-4" />}
        >
          <MasteryHeatmap
            data={masteryHeatmapData}
            columns={Math.min(mastery.length, 4)}
          />
        </DataCard>
      )}

      {/* ── Strengths & Weaknesses ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        <DataCard
          title="Strengths"
          icon={<TrendingUp className="h-4 w-4" />}
          className="lg:col-span-1"
        >
          {data.strengths.length > 0 ? (
            <div className="space-y-2">
              {data.strengths.map((s) => (
                <div
                  key={s}
                  className="flex items-center gap-2 rounded-md bg-mastery-mastered/10 px-3 py-2 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-mastery-mastered" />
                  <span className="text-foreground">{s}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Take exams to identify your strengths.
            </p>
          )}
        </DataCard>

        <DataCard
          title="Areas to Improve"
          icon={<Zap className="h-4 w-4" />}
          className="lg:col-span-1"
        >
          {data.weaknesses.length > 0 ? (
            <div className="space-y-2">
              {data.weaknesses.map((w) => (
                <div
                  key={w}
                  className="flex items-center gap-2 rounded-md bg-mastery-beginner/10 px-3 py-2 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-mastery-beginner" />
                  <span className="text-foreground">{w}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No weak areas identified yet.
            </p>
          )}
        </DataCard>

        {/* Quick Practice */}
        <Card className="flex flex-col overflow-hidden">
          <div className="bg-gradient-to-br from-primary/15 to-primary/5 p-6">
            <div className="flex items-center gap-2 mb-2">
              <Sparkles className="h-5 w-5 text-primary" />
              <h3 className="font-semibold text-base">Quick Practice</h3>
            </div>
            <p className="text-sm text-muted-foreground">
              AI recommends practicing your weakest topic next.
            </p>
          </div>
          <CardContent className="flex flex-1 flex-col justify-between pt-4">
            {weakestTopic ? (
              <div className="space-y-3">
                <div>
                  <p className="text-sm font-medium">{weakestTopic.topic}</p>
                  <p className="text-xs text-muted-foreground">
                    {weakestTopic.subject}
                  </p>
                </div>
                <div className="flex items-center gap-2">
                  <MasteryBadge level={weakestTopic.mastery_level} size="sm" />
                  <span className="text-xs text-muted-foreground">
                    {Math.round(weakestTopic.avg_score_pct)}% avg
                  </span>
                </div>
                <Progress
                  value={weakestTopic.avg_score_pct}
                  className="h-1.5"
                  indicatorClassName="bg-mastery-developing"
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">
                Complete exams to get AI-powered practice suggestions.
              </p>
            )}
            <Link
              to="/exams"
              className="mt-4 inline-flex items-center justify-center gap-2 rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Play className="h-4 w-4" />
              Start Practice
            </Link>
          </CardContent>
        </Card>
      </div>

      {/* ── Active Learning Plans ── */}
      {activePlans.length > 0 && (
        <DataCard
          title="Active Learning Plans"
          description={`${activePlans.length} plan${activePlans.length > 1 ? "s" : ""} in progress`}
          icon={<BookOpen className="h-4 w-4" />}
          action={
            <Link
              to="/learning"
              className="text-xs font-medium text-primary hover:underline inline-flex items-center gap-1"
            >
              View All <ChevronRight className="h-3 w-3" />
            </Link>
          }
        >
          <div className="grid gap-4 sm:grid-cols-2">
            {activePlans.slice(0, 4).map((plan) => (
              <Link key={plan.id} to="/learning" className="block">
                <Card className="p-4 transition-all hover:shadow-md hover:border-primary/30">
                  <div className="flex items-start justify-between mb-3">
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold truncate">
                        {plan.title}
                      </p>
                      <p className="text-xs text-muted-foreground mt-0.5">
                        {plan.subject} &middot; {plan.board}
                      </p>
                    </div>
                    <ScoreIndicator
                      score={plan.progress_pct}
                      maxScore={100}
                      size="sm"
                      showPercentage
                    />
                  </div>
                  <Progress value={plan.progress_pct} className="h-1.5" />
                  <div className="mt-2 flex items-center justify-between text-xs text-muted-foreground">
                    <span>{plan.objectives.length} objectives</span>
                    {plan.estimated_hours && (
                      <span className="flex items-center gap-1">
                        <Clock className="h-3 w-3" />~{plan.estimated_hours}h
                      </span>
                    )}
                  </div>
                </Card>
              </Link>
            ))}
          </div>
        </DataCard>
      )}
    </div>
  );
};

export default StudentDashboard;
