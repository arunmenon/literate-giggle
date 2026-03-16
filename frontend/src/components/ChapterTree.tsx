import React, { useState } from "react";
import type { ChapterCoverage } from "../types";
import { Badge, Button } from "./ui";
import { cn } from "../lib/utils";
import { ChevronDown, ChevronRight, BookOpen } from "lucide-react";

const STATUS_DOT: Record<ChapterCoverage["status"], string> = {
  green: "bg-emerald-500",
  amber: "bg-amber-500",
  red: "bg-red-500",
  empty: "bg-gray-300 dark:bg-gray-600",
};

export interface ChapterTreeProps {
  chapters: ChapterCoverage[];
  selectedChapterId?: number | null;
  onChapterSelect: (chapterId: number) => void;
  className?: string;
}

const ChapterTree: React.FC<ChapterTreeProps> = ({
  chapters,
  selectedChapterId,
  onChapterSelect,
  className,
}) => {
  const [expandedIds, setExpandedIds] = useState<Set<number>>(new Set());

  const toggleExpand = (id: number) => {
    setExpandedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  if (chapters.length === 0) {
    return (
      <div
        className={cn("flex flex-col items-center py-6 text-center", className)}
      >
        <BookOpen className="mb-2 h-6 w-6 text-muted-foreground/40" />
        <p className="text-xs text-muted-foreground">No chapters available</p>
      </div>
    );
  }

  return (
    <div className={cn("space-y-0.5", className)}>
      {chapters.map((ch) => {
        const isExpanded = expandedIds.has(ch.chapter_id);
        const isSelected = selectedChapterId === ch.chapter_id;
        const hasMeta =
          Object.keys(ch.by_difficulty).length > 0 ||
          Object.keys(ch.by_type).length > 0;

        return (
          <div key={ch.chapter_id}>
            {/* Chapter row */}
            <button
              className={cn(
                "flex w-full items-center gap-2 rounded-md px-2 py-1.5 text-left text-sm transition-colors",
                isSelected
                  ? "bg-primary/10 text-primary font-medium"
                  : "hover:bg-muted/60",
              )}
              onClick={() => onChapterSelect(ch.chapter_id)}
            >
              {/* Expand toggle */}
              {hasMeta ? (
                <span
                  className="shrink-0 rounded p-0.5 hover:bg-muted"
                  onClick={(e) => {
                    e.stopPropagation();
                    toggleExpand(ch.chapter_id);
                  }}
                  role="button"
                  tabIndex={0}
                  onKeyDown={(e) => {
                    if (e.key === "Enter" || e.key === " ") {
                      e.stopPropagation();
                      toggleExpand(ch.chapter_id);
                    }
                  }}
                >
                  {isExpanded ? (
                    <ChevronDown className="h-3 w-3 text-muted-foreground" />
                  ) : (
                    <ChevronRight className="h-3 w-3 text-muted-foreground" />
                  )}
                </span>
              ) : (
                <span className="w-4 shrink-0" />
              )}

              {/* Status dot */}
              <span
                className={cn(
                  "h-2 w-2 shrink-0 rounded-full",
                  STATUS_DOT[ch.status],
                )}
              />

              {/* Name */}
              <span className="min-w-0 flex-1 truncate">{ch.chapter_name}</span>

              {/* Count badge */}
              <Badge
                variant={ch.question_count > 0 ? "secondary" : "outline"}
                className="ml-auto shrink-0 text-[10px] px-1.5 py-0"
              >
                {ch.question_count}
              </Badge>
            </button>

            {/* Expanded details */}
            {isExpanded && hasMeta && (
              <div className="ml-8 mt-1 mb-1 space-y-1 rounded-md bg-muted/30 px-3 py-2 text-xs text-muted-foreground">
                {ch.textbook_ref && (
                  <p>
                    <span className="font-medium">Ref:</span> {ch.textbook_ref}
                  </p>
                )}
                {Object.keys(ch.by_difficulty).length > 0 && (
                  <p>
                    <span className="font-medium">Difficulty:</span>{" "}
                    {Object.entries(ch.by_difficulty)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </p>
                )}
                {Object.keys(ch.by_type).length > 0 && (
                  <p>
                    <span className="font-medium">Types:</span>{" "}
                    {Object.entries(ch.by_type)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </p>
                )}
                {Object.keys(ch.by_blooms).length > 0 && (
                  <p>
                    <span className="font-medium">Bloom's:</span>{" "}
                    {Object.entries(ch.by_blooms)
                      .map(([k, v]) => `${k}: ${v}`)
                      .join(", ")}
                  </p>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
};

export { ChapterTree };
