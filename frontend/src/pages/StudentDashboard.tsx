import React, { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { dashboardAPI, learningAPI } from "../services/api";
import type {
  StudentDashboard as DashboardData,
  TopicMastery,
  LearningPlan,
} from "../types";
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
} from "lucide-react";

/* ------------------------------------------------------------------ */
/*  Loading skeleton                                                    */
/* ------------------------------------------------------------------ */

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      {/* Hero skeleton */}
      <div className="rounded-lg border bg-card p-6">
        <div className="flex items-center gap-4">
          <Skeleton className="h-16 w-16 rounded-full" />
          <div className="space-y-2">
            <Skeleton className="h-6 w-48" />
            <Skeleton className="h-4 w-64" />
          </div>
        </div>
      </div>

      {/* Stat cards skeleton */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        {Array.from({ length: 4 }).map((_, idx) => (
          <Skeleton key={idx} className="h-28 rounded-lg" />
        ))}
      </div>

      {/* Charts skeleton */}
      <div className="grid gap-6 md:grid-cols-2">
        <Skeleton className="h-72 rounded-lg" />
        <Skeleton className="h-72 rounded-lg" />
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/*  Main component                                                      */
/* ------------------------------------------------------------------ */

const StudentDashboard: React.FC = () => {
  const [data, setData] = useState<DashboardData | null>(null);
  const [mastery, setMastery] = useState<TopicMastery[]>([]);
  const [plans, setPlans] = useState<LearningPlan[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    Promise.all([
      dashboardAPI.student().catch(() => ({ data: null })),
      learningAPI.getMastery().catch(() => ({ data: [] })),
      learningAPI.listPlans().catch(() => ({ data: [] })),
    ]).then(([dashRes, masteryRes, plansRes]) => {
      setData(dashRes.data);
      setMastery(masteryRes.data || []);
      setPlans(plansRes.data || []);
      setLoading(false);
    });
  }, []);

  if (loading) return <DashboardSkeleton />;
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

  const scoreChartData = data.recent_scores.map((scoreEntry) => ({
    label:
      scoreEntry.exam.length > 12
        ? scoreEntry.exam.slice(0, 12) + "..."
        : scoreEntry.exam,
    score: scoreEntry.score,
    date: scoreEntry.date,
  }));

  const masteryHeatmapData = mastery.map((topicMastery) => ({
    topic: topicMastery.topic,
    masteryLevel: topicMastery.mastery_level,
    score: topicMastery.avg_score_pct,
  }));

  // Build a simple Bloom's radar from mastery data (aggregate approach)
  const bloomsLevels = [
    "Remember",
    "Understand",
    "Apply",
    "Analyze",
    "Evaluate",
    "Create",
  ];
  const bloomsData = bloomsLevels.map((level, levelIndex) => ({
    level,
    score: data.average_score
      ? Math.max(
          10,
          Math.round((data.average_score ?? 0) * (1 - levelIndex * 0.1)),
        )
      : 0,
    fullMark: 100,
  }));

  const weakestTopic =
    mastery.length > 0
      ? mastery.reduce((weakest, current) =>
          current.avg_score_pct < weakest.avg_score_pct ? current : weakest,
        )
      : null;

  const activePlans = plans.filter((plan) => plan.is_active);

  const scoreTrend =
    data.recent_scores.length >= 2
      ? {
          value: Math.round(
            data.recent_scores[data.recent_scores.length - 1].score -
              data.recent_scores[data.recent_scores.length - 2].score,
          ),
          direction: (data.recent_scores[data.recent_scores.length - 1].score >=
          data.recent_scores[data.recent_scores.length - 2].score
            ? "up"
            : "down") as "up" | "down",
        }
      : undefined;

  return (
    <div className="space-y-6">
      {/* ── Hero Section ── */}
      <Card className="overflow-hidden">
        <div className="relative bg-gradient-to-br from-primary/10 via-primary/5 to-transparent p-6 md:p-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div className="flex items-center gap-4">
              {/* Avatar circle */}
              <div className="flex h-14 w-14 items-center justify-center rounded-full bg-primary text-primary-foreground text-xl font-bold font-display shadow-md">
                {data.user.full_name.charAt(0).toUpperCase()}
              </div>
              <div>
                <h1 className="text-2xl font-bold font-display tracking-tight">
                  Welcome back, {data.user.full_name.split(" ")[0]}
                </h1>
                <p className="text-sm text-muted-foreground mt-0.5">
                  {data.profile.board} &middot; Class {data.profile.class_grade}{" "}
                  &middot; {data.profile.academic_year}
                </p>
              </div>
            </div>

            {/* Overall score ring */}
            {data.average_score !== undefined &&
              data.average_score !== null && (
                <ScoreIndicator
                  score={data.average_score}
                  maxScore={100}
                  size="lg"
                  showPercentage
                />
              )}
          </div>
        </div>
      </Card>

      {/* ── Stat Cards ── */}
      <div className="grid grid-cols-2 gap-4 md:grid-cols-4">
        <StatCard
          title="Exams Taken"
          value={data.total_exams_taken}
          icon={<GraduationCap className="h-5 w-5" />}
          subtitle="Total assessments"
        />
        <StatCard
          title="Average Score"
          value={
            data.average_score ? formatPercentage(data.average_score) : "N/A"
          }
          icon={<TrendingUp className="h-5 w-5" />}
          trend={scoreTrend}
          subtitle="Across all exams"
        />
        <StatCard
          title="Active Plans"
          value={data.active_learning_plans}
          icon={<Target className="h-5 w-5" />}
          subtitle="Learning paths"
        />
        <StatCard
          title="Weak Areas"
          value={data.weaknesses.length}
          icon={<Zap className="h-5 w-5" />}
          subtitle="Topics to improve"
        />
      </div>

      {/* ── Charts Row ── */}
      <div className="grid gap-6 lg:grid-cols-2">
        {/* Score Trend Chart */}
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

        {/* Bloom's Radar */}
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

      {/* ── Strengths & Weaknesses + Quick Practice ── */}
      <div className="grid gap-6 lg:grid-cols-3">
        {/* Strengths */}
        <DataCard
          title="Strengths"
          icon={<TrendingUp className="h-4 w-4" />}
          className="lg:col-span-1"
        >
          {data.strengths.length > 0 ? (
            <div className="space-y-2">
              {data.strengths.map((strength) => (
                <div
                  key={strength}
                  className="flex items-center gap-2 rounded-md bg-mastery-mastered/10 px-3 py-2 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-mastery-mastered" />
                  <span className="text-foreground">{strength}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              Take exams to identify your strengths.
            </p>
          )}
        </DataCard>

        {/* Weaknesses */}
        <DataCard
          title="Areas to Improve"
          icon={<Zap className="h-4 w-4" />}
          className="lg:col-span-1"
        >
          {data.weaknesses.length > 0 ? (
            <div className="space-y-2">
              {data.weaknesses.map((weakness) => (
                <div
                  key={weakness}
                  className="flex items-center gap-2 rounded-md bg-mastery-beginner/10 px-3 py-2 text-sm"
                >
                  <span className="h-2 w-2 rounded-full bg-mastery-beginner" />
                  <span className="text-foreground">{weakness}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">
              No weak areas identified yet.
            </p>
          )}
        </DataCard>

        {/* Quick Practice Suggestion */}
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

      {/* ── Recent Scores Table ── */}
      {data.recent_scores.length > 0 && (
        <DataCard
          title="Recent Exams"
          description="Your latest exam results"
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
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b">
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                    Exam
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                    Subject
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                    Score
                  </th>
                  <th className="pb-2 pr-4 text-left text-xs font-medium text-muted-foreground">
                    Grade
                  </th>
                  <th className="pb-2 text-left text-xs font-medium text-muted-foreground">
                    Date
                  </th>
                </tr>
              </thead>
              <tbody>
                {data.recent_scores.map((scoreEntry, entryIndex) => (
                  <tr
                    key={entryIndex}
                    className="border-b border-border/50 last:border-0"
                  >
                    <td className="py-3 pr-4 font-medium">{scoreEntry.exam}</td>
                    <td className="py-3 pr-4 text-muted-foreground">
                      {scoreEntry.subject}
                    </td>
                    <td className="py-3 pr-4">
                      <Badge
                        variant={
                          scoreEntry.score >= 80
                            ? "success"
                            : scoreEntry.score >= 60
                              ? "info"
                              : scoreEntry.score >= 40
                                ? "warning"
                                : "destructive"
                        }
                      >
                        {scoreEntry.score}%
                      </Badge>
                    </td>
                    <td
                      className={cn(
                        "py-3 pr-4 font-semibold",
                        getGradeColor(scoreEntry.grade),
                      )}
                    >
                      {scoreEntry.grade}
                    </td>
                    <td className="py-3 text-muted-foreground">
                      {scoreEntry.date
                        ? new Date(scoreEntry.date).toLocaleDateString()
                        : "-"}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </DataCard>
      )}

      {/* ── Quick Actions ── */}
      <div className="grid grid-cols-2 gap-4">
        <Link
          to="/exams"
          className="flex items-center justify-center gap-2 rounded-lg border bg-card p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5"
        >
          <GraduationCap className="h-5 w-5 text-primary" />
          Take an Exam
        </Link>
        <Link
          to="/learning"
          className="flex items-center justify-center gap-2 rounded-lg border bg-card p-4 text-sm font-medium transition-all hover:shadow-md hover:border-primary/30 hover:bg-primary/5"
        >
          <BookOpen className="h-5 w-5 text-primary" />
          View Learning Plans
        </Link>
      </div>
    </div>
  );
};

export default StudentDashboard;
