import React from "react";
import type { ChapterCoverage, Question } from "../types";
import { Badge, Button } from "./ui";
import { cn } from "../lib/utils";
import { Filter, X } from "lucide-react";

// ── Filter state ──

export interface QuestionFilterState {
  chapters: number[];
  difficulties: string[];
  types: string[];
  blooms: string[];
}

export const EMPTY_FILTERS: QuestionFilterState = {
  chapters: [],
  difficulties: [],
  types: [],
  blooms: [],
};

// ── Props ──

export interface QuestionFiltersProps {
  filters: QuestionFilterState;
  onChange: (filters: QuestionFilterState) => void;
  chapters: ChapterCoverage[];
  questions: Question[];
  className?: string;
}

// ── Helpers ──

function countByField(
  questions: Question[],
  field: keyof Question,
): Record<string, number> {
  const counts: Record<string, number> = {};
  for (const q of questions) {
    const val = String(q[field] ?? "unknown");
    counts[val] = (counts[val] || 0) + 1;
  }
  return counts;
}

function hasActiveFilters(filters: QuestionFilterState): boolean {
  return (
    filters.chapters.length > 0 ||
    filters.difficulties.length > 0 ||
    filters.types.length > 0 ||
    filters.blooms.length > 0
  );
}

// ── Apply filters to questions (exported utility) ──

export function applyFilters(
  questions: Question[],
  filters: QuestionFilterState,
  chapterMap: Map<number, string>,
): Question[] {
  return questions.filter((q) => {
    if (filters.chapters.length > 0) {
      const chapterMatch = filters.chapters.some((chId) => {
        const chapterName = chapterMap.get(chId);
        return (
          chapterName &&
          q.topic?.toLowerCase().includes(chapterName.toLowerCase())
        );
      });
      if (!chapterMatch) return false;
    }
    if (
      filters.difficulties.length > 0 &&
      !filters.difficulties.includes(q.difficulty)
    ) {
      return false;
    }
    if (filters.types.length > 0 && !filters.types.includes(q.question_type)) {
      return false;
    }
    if (filters.blooms.length > 0 && !filters.blooms.includes(q.blooms_level)) {
      return false;
    }
    return true;
  });
}

// ── Checkbox group ──

function FilterSection({
  title,
  options,
  selected,
  onToggle,
}: {
  title: string;
  options: { value: string; label: string; count: number }[];
  selected: string[];
  onToggle: (value: string) => void;
}) {
  if (options.length === 0) return null;

  return (
    <div>
      <p className="mb-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wide">
        {title}
      </p>
      <div className="space-y-0.5">
        {options.map((opt) => {
          const isActive = selected.includes(opt.value);
          return (
            <label
              key={opt.value}
              className={cn(
                "flex cursor-pointer items-center gap-2 rounded-md px-2 py-1 text-sm transition-colors",
                isActive ? "bg-primary/10 text-primary" : "hover:bg-muted/60",
              )}
            >
              <input
                type="checkbox"
                checked={isActive}
                onChange={() => onToggle(opt.value)}
                className="h-3.5 w-3.5 rounded border-input accent-primary"
              />
              <span className="min-w-0 flex-1 truncate">{opt.label}</span>
              <span className="shrink-0 text-[10px] tabular-nums text-muted-foreground">
                {opt.count}
              </span>
            </label>
          );
        })}
      </div>
    </div>
  );
}

// ── Main component ──

const QuestionFilters: React.FC<QuestionFiltersProps> = ({
  filters,
  onChange,
  chapters,
  questions,
  className,
}) => {
  const difficultyCounts = countByField(questions, "difficulty");
  const typeCounts = countByField(questions, "question_type");
  const bloomsCounts = countByField(questions, "blooms_level");

  const toggleChapter = (chapterId: number) => {
    const next = filters.chapters.includes(chapterId)
      ? filters.chapters.filter((id) => id !== chapterId)
      : [...filters.chapters, chapterId];
    onChange({ ...filters, chapters: next });
  };

  const toggleValue = (
    key: "difficulties" | "types" | "blooms",
    value: string,
  ) => {
    const list = filters[key];
    const next = list.includes(value)
      ? list.filter((v) => v !== value)
      : [...list, value];
    onChange({ ...filters, [key]: next });
  };

  const clearAll = () => onChange(EMPTY_FILTERS);

  const active = hasActiveFilters(filters);

  // Build option lists with live counts
  const chapterOptions = chapters.map((ch) => ({
    value: String(ch.chapter_id),
    label: ch.chapter_name,
    count: ch.question_count,
  }));

  const difficultyOptions = Object.entries(difficultyCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([val, count]) => ({
      value: val,
      label: val.charAt(0).toUpperCase() + val.slice(1),
      count,
    }));

  const typeOptions = Object.entries(typeCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([val, count]) => ({
      value: val,
      label: val.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase()),
      count,
    }));

  const bloomsOptions = Object.entries(bloomsCounts)
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([val, count]) => ({
      value: val,
      label: val.charAt(0).toUpperCase() + val.slice(1),
      count,
    }));

  return (
    <div className={cn("space-y-4", className)}>
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-1.5 text-sm font-medium">
          <Filter className="h-3.5 w-3.5" />
          Filters
        </div>
        {active && (
          <Button
            variant="ghost"
            size="sm"
            className="h-6 px-2 text-xs"
            onClick={clearAll}
          >
            Clear All
          </Button>
        )}
      </div>

      {/* Active filter chips */}
      {active && (
        <div className="flex flex-wrap gap-1">
          {filters.chapters.map((id) => {
            const ch = chapters.find((c) => c.chapter_id === id);
            return (
              <Badge
                key={`ch-${id}`}
                variant="secondary"
                className="cursor-pointer gap-1 pr-1 text-[10px]"
                onClick={() => toggleChapter(id)}
              >
                {ch?.chapter_name ?? `Ch ${id}`}
                <X className="h-2.5 w-2.5" />
              </Badge>
            );
          })}
          {filters.difficulties.map((v) => (
            <Badge
              key={`d-${v}`}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1 text-[10px]"
              onClick={() => toggleValue("difficulties", v)}
            >
              {v}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.types.map((v) => (
            <Badge
              key={`t-${v}`}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1 text-[10px]"
              onClick={() => toggleValue("types", v)}
            >
              {v.replace(/_/g, " ")}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
          {filters.blooms.map((v) => (
            <Badge
              key={`b-${v}`}
              variant="secondary"
              className="cursor-pointer gap-1 pr-1 text-[10px]"
              onClick={() => toggleValue("blooms", v)}
            >
              {v}
              <X className="h-2.5 w-2.5" />
            </Badge>
          ))}
        </div>
      )}

      {/* Filter sections */}
      {chapters.length > 0 && (
        <FilterSection
          title="Chapter"
          options={chapterOptions}
          selected={filters.chapters.map(String)}
          onToggle={(v) => toggleChapter(Number(v))}
        />
      )}

      <FilterSection
        title="Difficulty"
        options={difficultyOptions}
        selected={filters.difficulties}
        onToggle={(v) => toggleValue("difficulties", v)}
      />

      <FilterSection
        title="Question Type"
        options={typeOptions}
        selected={filters.types}
        onToggle={(v) => toggleValue("types", v)}
      />

      <FilterSection
        title="Bloom's Level"
        options={bloomsOptions}
        selected={filters.blooms}
        onToggle={(v) => toggleValue("blooms", v)}
      />
    </div>
  );
};

export { QuestionFilters };
