import React, { useState } from "react";
import type {
  BankAnalytics as BankAnalyticsType,
  ChapterCoverage,
  CoverageHeatmapResponse,
  BankCalibrationResponse,
} from "../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Button,
  Progress,
  Skeleton,
} from "./ui";
import { cn } from "../lib/utils";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
  Cell,
  ReferenceLine,
} from "recharts";
import {
  AlertTriangle,
  BookOpen,
  ChevronDown,
  ChevronUp,
  Grid3X3,
  Pencil,
  RefreshCw,
  Scale,
  Sparkles,
  Target,
  TrendingUp,
} from "lucide-react";
import { CoverageHeatmap } from "./CoverageHeatmap";

// ── RAG colors ──

const RAG_COLORS: Record<ChapterCoverage["status"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  empty: "bg-gray-300 dark:bg-gray-600",
};

const RAG_TEXT: Record<ChapterCoverage["status"], string> = {
  green: "text-emerald-600 dark:text-emerald-400",
  amber: "text-amber-600 dark:text-amber-400",
  red: "text-red-600 dark:text-red-400",
  empty: "text-gray-400 dark:text-gray-500",
};

const RAG_BAR: Record<ChapterCoverage["status"], string> = {
  green: "hsl(152, 69%, 31%)",
  amber: "hsl(38, 92%, 50%)",
  red: "hsl(0, 72%, 51%)",
  empty: "hsl(0, 0%, 75%)",
};

// ── Props ──

export interface BankAnalyticsProps {
  analytics: BankAnalyticsType | null;
  loading: boolean;
  error: string | null;
  onFillGap: (chapterId: number, chapterName: string) => void;
  onChapterClick: (chapterId: number) => void;
  onCreateCurriculum: () => void;
  onRetry: () => void;
  onEditChapter?: (chapterId: number, chapterName: string) => void;
  // Heatmap
  heatmapData?: CoverageHeatmapResponse | null;
  heatmapLoading?: boolean;
  heatmapError?: string | null;
  onHeatmapCellClick?: (chapterId: number, bloomsLevel: string, questionIds: number[]) => void;
  onHeatmapFillGap?: (chapterId: number, bloomsLevel: string) => void;
  // Calibration
  calibrationData?: BankCalibrationResponse | null;
  calibrationLoading?: boolean;
  onUpdateDifficulty?: (questionId: number, newDifficulty: string) => void;
}

// ── Skeleton loader ──

function AnalyticsSkeleton() {
  return (
    <Card>
      <CardHeader>
        <Skeleton className="h-5 w-48" />
      </CardHeader>
      <CardContent className="space-y-4">
        <Skeleton className="h-3 w-full" />
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          {[1, 2, 3, 4].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
        <div className="space-y-2">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-8 w-full" />
          ))}
        </div>
      </CardContent>
    </Card>
  );
}

// ── Main component ──

const MISMATCH_LABELS: Record<string, string> = {
  easier_than_marked: "easier",
  harder_than_marked: "harder",
};

const BankAnalytics: React.FC<BankAnalyticsProps> = ({
  analytics,
  loading,
  error,
  onFillGap,
  onChapterClick,
  onCreateCurriculum,
  onRetry,
  onEditChapter,
  heatmapData,
  heatmapLoading,
  heatmapError,
  onHeatmapCellClick,
  onHeatmapFillGap,
  calibrationData,
  calibrationLoading,
  onUpdateDifficulty,
}) => {
  const [compositionOpen, setCompositionOpen] = useState(false);
  const [heatmapOpen, setHeatmapOpen] = useState(false);
  const [calibrationOpen, setCalibrationOpen] = useState(false);

  if (loading) return <AnalyticsSkeleton />;

  if (error) {
    return (
      <Card className="border-destructive/30 bg-destructive/5">
        <CardContent className="flex items-center justify-between p-4">
          <div className="flex items-center gap-2 text-sm text-destructive">
            <AlertTriangle className="h-4 w-4" />
            Analytics unavailable
          </div>
          <Button variant="ghost" size="sm" onClick={onRetry}>
            <RefreshCw className="mr-1 h-3 w-3" /> Retry
          </Button>
        </CardContent>
      </Card>
    );
  }

  // No curriculum state
  if (!analytics || analytics.chapters_total === 0) {
    const board = analytics?.board ?? "";
    const classGrade = analytics?.class_grade ?? "";
    const subject = analytics?.subject ?? "";
    return (
      <Card className="border-dashed">
        <CardContent className="flex flex-col items-center justify-center py-10 text-center">
          <BookOpen className="mb-3 h-10 w-10 text-muted-foreground/50" />
          <p className="text-sm font-medium">
            No curriculum found
            {board ? ` for ${board} Class ${classGrade} ${subject}` : ""}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            Create a curriculum to see chapter coverage and gap analysis
          </p>
          <Button className="mt-4" size="sm" onClick={onCreateCurriculum}>
            <Sparkles className="mr-1.5 h-3.5 w-3.5" />
            Create with AI
          </Button>
        </CardContent>
      </Card>
    );
  }

  const coveragePct =
    analytics.chapters_total > 0
      ? Math.round(
          (analytics.chapters_covered / analytics.chapters_total) * 100,
        )
      : 0;

  const gapAlerts = analytics.gap_alerts;
  const showMoreGaps = gapAlerts.length > 4;
  const visibleGaps = showMoreGaps ? gapAlerts.slice(0, 4) : gapAlerts;

  // ── Composition chart data ──
  const typeData = Object.entries(analytics.composition.by_type).map(
    ([name, count]) => ({ name, count }),
  );
  const difficultyData = Object.entries(
    analytics.composition.by_difficulty,
  ).map(([name, count]) => ({ name, count }));
  const bloomsData = Object.entries(analytics.composition.by_blooms).map(
    ([name, count]) => ({ name, count }),
  );

  return (
    <Card>
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <CardTitle className="text-base">Coverage Analytics</CardTitle>
          </div>
          <Badge variant="outline" className="font-mono text-xs">
            {analytics.total_questions} questions
          </Badge>
        </div>
      </CardHeader>

      <CardContent className="space-y-5">
        {/* Coverage summary bar */}
        <div className="space-y-1.5">
          <div className="flex items-baseline justify-between text-sm">
            <span className="font-medium">
              {analytics.chapters_covered}/{analytics.chapters_total} chapters
              covered
            </span>
            <span
              className={cn(
                "font-semibold",
                coveragePct >= 75
                  ? "text-emerald-600 dark:text-emerald-400"
                  : coveragePct >= 50
                    ? "text-amber-600 dark:text-amber-400"
                    : "text-red-600 dark:text-red-400",
              )}
            >
              {coveragePct}%
            </span>
          </div>
          <Progress
            value={coveragePct}
            indicatorClassName={cn(
              coveragePct >= 75
                ? "bg-emerald-500"
                : coveragePct >= 50
                  ? "bg-amber-500"
                  : "bg-red-500",
            )}
          />
        </div>

        {/* Gap alerts */}
        {gapAlerts.length > 0 && (
          <div className="space-y-2">
            <p className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
              <AlertTriangle className="h-3 w-3" />
              Gap Alerts ({gapAlerts.length})
            </p>
            <div className="grid gap-2 sm:grid-cols-2">
              {visibleGaps.map((gap) => (
                <div
                  key={gap.chapter_id}
                  className="flex items-center justify-between rounded-lg border border-red-200 bg-red-50 px-3 py-2 dark:border-red-900/40 dark:bg-red-950/30"
                >
                  <div className="min-w-0 flex-1">
                    <p className="truncate text-sm font-medium text-red-700 dark:text-red-300">
                      {gap.chapter_name}
                    </p>
                    <p className="text-xs text-red-500 dark:text-red-400">
                      {gap.status === "empty" ? "0 questions" : "Below target"}{" "}
                      &middot; need {gap.questions_needed}
                    </p>
                  </div>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="ml-2 shrink-0 text-xs text-red-600 hover:bg-red-100 hover:text-red-700 dark:text-red-400 dark:hover:bg-red-900/40"
                    onClick={() => onFillGap(gap.chapter_id, gap.chapter_name)}
                  >
                    <Sparkles className="mr-1 h-3 w-3" />
                    Fill with AI
                  </Button>
                </div>
              ))}
            </div>
            {showMoreGaps && (
              <p className="text-xs text-muted-foreground">
                +{gapAlerts.length - 4} more gaps
              </p>
            )}
          </div>
        )}

        {/* Chapter coverage bars */}
        <div className="space-y-2">
          <p className="text-xs font-medium text-muted-foreground uppercase tracking-wide">
            Chapter Coverage
          </p>
          <div className="space-y-1.5">
            {analytics.chapter_coverage.map((ch) => {
              const pct =
                ch.target_count > 0
                  ? Math.min(
                      100,
                      Math.round((ch.question_count / ch.target_count) * 100),
                    )
                  : ch.question_count > 0
                    ? 100
                    : 0;
              return (
                <div
                  key={ch.chapter_id}
                  className="group flex items-center gap-2 rounded-md px-1 py-1 transition-colors hover:bg-muted/50 cursor-pointer"
                  onClick={() => onChapterClick(ch.chapter_id)}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ")
                      onChapterClick(ch.chapter_id);
                  }}
                >
                  {/* RAG dot */}
                  <span
                    className={cn(
                      "h-2 w-2 shrink-0 rounded-full",
                      RAG_COLORS[ch.status],
                    )}
                  />

                  {/* Chapter name */}
                  <span className="min-w-0 flex-1 truncate text-sm">
                    {ch.chapter_name}
                  </span>

                  {/* Edit icon (hover) */}
                  {onEditChapter && (
                    <button
                      className="hidden shrink-0 rounded p-0.5 text-muted-foreground transition-colors hover:text-foreground group-hover:inline-flex"
                      onClick={(e) => {
                        e.stopPropagation();
                        onEditChapter(ch.chapter_id, ch.chapter_name);
                      }}
                      aria-label={`Edit ${ch.chapter_name}`}
                    >
                      <Pencil className="h-3 w-3" />
                    </button>
                  )}

                  {/* Bar */}
                  <div className="relative h-2 w-24 shrink-0 overflow-hidden rounded-full bg-muted sm:w-32">
                    <div
                      className={cn(
                        "absolute inset-y-0 left-0 rounded-full transition-all",
                        RAG_COLORS[ch.status],
                      )}
                      style={{ width: `${pct}%` }}
                    />
                    {/* Target line */}
                    {ch.target_count > 0 && (
                      <div
                        className="absolute inset-y-0 w-px bg-foreground/40"
                        style={{ left: "100%" }}
                        title={`Target: ${ch.target_count}`}
                      />
                    )}
                  </div>

                  {/* Count */}
                  <span
                    className={cn(
                      "w-12 shrink-0 text-right text-xs tabular-nums",
                      RAG_TEXT[ch.status],
                    )}
                  >
                    {ch.question_count}/{ch.target_count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>

        {/* Coverage Heatmap (collapsible) */}
        {(heatmapData || heatmapLoading || heatmapError) && (
          <div className="border-t pt-3">
            <button
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide transition-colors hover:text-foreground"
              onClick={() => setHeatmapOpen((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Grid3X3 className="h-3 w-3" />
                Coverage Heatmap
              </span>
              {heatmapOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {heatmapOpen && (
              <div className="mt-3">
                <CoverageHeatmap
                  data={heatmapData ?? null}
                  loading={heatmapLoading ?? false}
                  error={heatmapError ?? null}
                  onCellClick={onHeatmapCellClick ?? (() => {})}
                  onFillGap={onHeatmapFillGap ?? (() => {})}
                />
              </div>
            )}
          </div>
        )}

        {/* Calibration Alerts (collapsible) */}
        {(calibrationData || calibrationLoading) && (
          <div className="border-t pt-3">
            <button
              className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide transition-colors hover:text-foreground"
              onClick={() => setCalibrationOpen((v) => !v)}
            >
              <span className="flex items-center gap-1.5">
                <Scale className="h-3 w-3" />
                Calibration Alerts
                {calibrationData && calibrationData.total_mismatches > 0 && (
                  <Badge
                    variant="warning"
                    className="ml-1 text-[10px] px-1.5 py-0"
                  >
                    {calibrationData.total_mismatches}
                  </Badge>
                )}
              </span>
              {calibrationOpen ? (
                <ChevronUp className="h-3.5 w-3.5" />
              ) : (
                <ChevronDown className="h-3.5 w-3.5" />
              )}
            </button>

            {calibrationOpen && (
              <div className="mt-3 space-y-2">
                {calibrationLoading ? (
                  <div className="space-y-2">
                    {[1, 2, 3].map((i) => (
                      <Skeleton key={i} className="h-10 w-full" />
                    ))}
                  </div>
                ) : calibrationData &&
                  calibrationData.calibrations.filter((c) => c.mismatch)
                    .length > 0 ? (
                  <>
                    <p className="text-xs text-muted-foreground">
                      {calibrationData.total_mismatches} question
                      {calibrationData.total_mismatches !== 1 ? "s" : ""} with
                      difficulty mismatch (of {calibrationData.total_calibrated}{" "}
                      calibrated)
                    </p>
                    <div className="grid gap-2">
                      {calibrationData.calibrations
                        .filter((c) => c.mismatch)
                        .map((cal) => (
                          <div
                            key={cal.question_id}
                            className="flex items-center justify-between rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 dark:border-amber-900/40 dark:bg-amber-950/30"
                          >
                            <div className="min-w-0 flex-1">
                              <p className="text-sm font-medium text-amber-700 dark:text-amber-300">
                                Question #{cal.question_id}
                              </p>
                              <p className="text-xs text-amber-600 dark:text-amber-400">
                                Marked{" "}
                                <span className="font-medium">
                                  {cal.assigned_difficulty}
                                </span>
                                , actually{" "}
                                <span className="font-medium">
                                  {cal.empirical_difficulty}
                                </span>{" "}
                                &middot; {cal.sample_size} attempts &middot; avg{" "}
                                {Math.round(cal.empirical_score * 100)}%
                              </p>
                            </div>
                            {onUpdateDifficulty && (
                              <Button
                                variant="ghost"
                                size="sm"
                                className="ml-2 shrink-0 text-xs text-amber-600 hover:bg-amber-100 hover:text-amber-700 dark:text-amber-400 dark:hover:bg-amber-900/40"
                                onClick={() =>
                                  onUpdateDifficulty(
                                    cal.question_id,
                                    cal.empirical_difficulty,
                                  )
                                }
                              >
                                Update to {cal.empirical_difficulty}
                              </Button>
                            )}
                          </div>
                        ))}
                    </div>
                  </>
                ) : (
                  <p className="text-xs text-muted-foreground py-2">
                    No difficulty mismatches detected
                    {calibrationData
                      ? ` (${calibrationData.total_calibrated} calibrated)`
                      : ""}
                  </p>
                )}
              </div>
            )}
          </div>
        )}

        {/* Composition (collapsible) */}
        <div className="border-t pt-3">
          <button
            className="flex w-full items-center justify-between text-xs font-medium text-muted-foreground uppercase tracking-wide transition-colors hover:text-foreground"
            onClick={() => setCompositionOpen((v) => !v)}
          >
            <span className="flex items-center gap-1.5">
              <TrendingUp className="h-3 w-3" />
              Composition
            </span>
            {compositionOpen ? (
              <ChevronUp className="h-3.5 w-3.5" />
            ) : (
              <ChevronDown className="h-3.5 w-3.5" />
            )}
          </button>

          {compositionOpen && (
            <div className="mt-4 grid gap-6 md:grid-cols-3">
              {/* Type distribution */}
              {typeData.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    By Type
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={typeData}
                      layout="vertical"
                      margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        horizontal={false}
                      />
                      <XAxis
                        type="number"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        type="category"
                        dataKey="name"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                        width={80}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12,
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--primary))"
                        radius={[0, 4, 4, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Difficulty distribution */}
              {difficultyData.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    By Difficulty
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={difficultyData}
                      margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12,
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--chart-2))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}

              {/* Bloom's distribution */}
              {bloomsData.length > 0 && (
                <div>
                  <p className="mb-2 text-xs font-medium text-muted-foreground">
                    By Bloom's Level
                  </p>
                  <ResponsiveContainer width="100%" height={180}>
                    <BarChart
                      data={bloomsData}
                      margin={{ left: 0, right: 10, top: 0, bottom: 0 }}
                    >
                      <CartesianGrid
                        strokeDasharray="3 3"
                        stroke="hsl(var(--border))"
                        vertical={false}
                      />
                      <XAxis
                        dataKey="name"
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <YAxis
                        tick={{
                          fontSize: 10,
                          fill: "hsl(var(--muted-foreground))",
                        }}
                        axisLine={false}
                        tickLine={false}
                      />
                      <Tooltip
                        contentStyle={{
                          backgroundColor: "hsl(var(--card))",
                          border: "1px solid hsl(var(--border))",
                          borderRadius: "var(--radius)",
                          fontSize: 12,
                          color: "hsl(var(--card-foreground))",
                        }}
                      />
                      <Bar
                        dataKey="count"
                        fill="hsl(var(--chart-3))"
                        radius={[4, 4, 0, 0]}
                      />
                    </BarChart>
                  </ResponsiveContainer>
                </div>
              )}
            </div>
          )}
        </div>
      </CardContent>
    </Card>
  );
};

export { BankAnalytics };
