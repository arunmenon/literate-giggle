import React from "react";
import type { CoverageHeatmapResponse, HeatmapCell } from "../types";
import { Badge, Skeleton } from "./ui";
import { cn } from "../lib/utils";
import { AlertTriangle, Grid3X3, Plus } from "lucide-react";

// ── Props ──

export interface CoverageHeatmapProps {
  data: CoverageHeatmapResponse | null;
  loading: boolean;
  error: string | null;
  onCellClick: (chapterId: number, bloomsLevel: string, questionIds: number[]) => void;
  onFillGap: (chapterId: number, bloomsLevel: string) => void;
}

// ── Color scale ──

const BLOOMS_ORDER = ["remember", "understand", "apply", "analyze", "evaluate", "create"];

const BLOOMS_SHORT: Record<string, string> = {
  remember: "Rem",
  understand: "Und",
  apply: "App",
  analyze: "Ana",
  evaluate: "Eva",
  create: "Cre",
};

function getCellColor(count: number, maxCount: number): string {
  if (count === 0) return "";
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity <= 0.25) return "bg-emerald-100 dark:bg-emerald-950/40";
  if (intensity <= 0.5) return "bg-emerald-200 dark:bg-emerald-900/50";
  if (intensity <= 0.75) return "bg-emerald-400 dark:bg-emerald-800/60";
  return "bg-emerald-600 dark:bg-emerald-700/70";
}

function getCellTextColor(count: number, maxCount: number): string {
  if (count === 0) return "text-muted-foreground/50";
  const intensity = Math.min(count / Math.max(maxCount, 1), 1);
  if (intensity > 0.75) return "text-white dark:text-emerald-100";
  return "text-emerald-900 dark:text-emerald-100";
}

// ── Skeleton ──

function HeatmapSkeleton() {
  return (
    <div className="space-y-2">
      <Skeleton className="h-4 w-32" />
      <div className="grid grid-cols-7 gap-1">
        {Array.from({ length: 28 }).map((_, i) => (
          <Skeleton key={i} className="h-9 rounded" />
        ))}
      </div>
    </div>
  );
}

// ── Main component ──

const CoverageHeatmap: React.FC<CoverageHeatmapProps> = ({
  data,
  loading,
  error,
  onCellClick,
  onFillGap,
}) => {
  if (loading) return <HeatmapSkeleton />;

  if (error) {
    return (
      <div className="flex items-center gap-2 text-sm text-destructive">
        <AlertTriangle className="h-4 w-4" />
        Failed to load heatmap
      </div>
    );
  }

  if (!data || data.chapters.length === 0) {
    return (
      <div className="flex items-center gap-2 text-sm text-muted-foreground py-4">
        <Grid3X3 className="h-4 w-4" />
        No heatmap data available
      </div>
    );
  }

  // Build a lookup: "chapterName|bloomsLevel" -> HeatmapCell
  const cellMap = new Map<string, HeatmapCell>();
  for (const cell of data.cells) {
    cellMap.set(`${cell.chapter_name}|${cell.blooms_level}`, cell);
  }

  // Find max count for color scaling
  const maxCount = Math.max(...data.cells.map((c) => c.question_count), 1);

  // Use the ordered blooms levels from API, fallback to default order
  const bloomsLevels =
    data.blooms_levels.length > 0 ? data.blooms_levels : BLOOMS_ORDER;

  return (
    <div className="space-y-3">
      {/* Legend */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <Grid3X3 className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground">
            Chapter x Bloom's Level
          </span>
        </div>
        <div className="flex items-center gap-1.5 text-[10px] text-muted-foreground">
          <span>Less</span>
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-100 dark:bg-emerald-950/40 border border-border" />
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-200 dark:bg-emerald-900/50" />
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-400 dark:bg-emerald-800/60" />
          <span className="inline-block h-3 w-3 rounded-sm bg-emerald-600 dark:bg-emerald-700/70" />
          <span>More</span>
        </div>
      </div>

      {/* Scrollable grid */}
      <div className="overflow-x-auto -mx-1 px-1">
        <table className="w-full border-collapse min-w-[480px]">
          <thead>
            <tr>
              <th className="text-left text-[10px] font-medium text-muted-foreground uppercase tracking-wider p-1.5 w-[140px] min-w-[140px]">
                Chapter
              </th>
              {bloomsLevels.map((level) => (
                <th
                  key={level}
                  className="text-center text-[10px] font-medium text-muted-foreground uppercase tracking-wider p-1.5"
                  title={level}
                >
                  {BLOOMS_SHORT[level] || level.slice(0, 3)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.chapters.map((chapterName) => {
              // Find chapter_id from any cell for this chapter
              const anyCell = data.cells.find(
                (c) => c.chapter_name === chapterName,
              );
              const chapterId = anyCell?.chapter_id ?? 0;

              return (
                <tr key={chapterName} className="group">
                  <td className="text-xs truncate max-w-[140px] p-1.5 text-muted-foreground group-hover:text-foreground transition-colors">
                    <span title={chapterName}>{chapterName}</span>
                  </td>
                  {bloomsLevels.map((level) => {
                    const cell = cellMap.get(`${chapterName}|${level}`);
                    const count = cell?.question_count ?? 0;
                    const isEmpty = count === 0;

                    return (
                      <td key={level} className="p-0.5">
                        <button
                          type="button"
                          onClick={() =>
                            isEmpty
                              ? onFillGap(chapterId, level)
                              : onCellClick(
                                  cell!.chapter_id,
                                  level,
                                  cell!.question_ids,
                                )
                          }
                          className={cn(
                            "w-full h-9 rounded-md text-xs font-medium transition-all",
                            "flex items-center justify-center",
                            "hover:ring-2 hover:ring-primary/40 hover:ring-offset-1",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
                            isEmpty
                              ? "border border-dashed border-muted-foreground/30 text-muted-foreground/40 hover:border-primary/50 hover:text-primary/60 hover:bg-primary/5"
                              : cn(
                                  getCellColor(count, maxCount),
                                  getCellTextColor(count, maxCount),
                                ),
                          )}
                          title={
                            isEmpty
                              ? `Generate ${chapterName} - ${level}`
                              : `${count} question${count !== 1 ? "s" : ""}: ${chapterName} - ${level}`
                          }
                        >
                          {isEmpty ? (
                            <Plus className="h-3 w-3" />
                          ) : (
                            count
                          )}
                        </button>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Total */}
      <div className="flex items-center justify-end">
        <Badge variant="outline" className="text-[10px] font-mono">
          {data.total_questions} total questions
        </Badge>
      </div>
    </div>
  );
};

export { CoverageHeatmap };
