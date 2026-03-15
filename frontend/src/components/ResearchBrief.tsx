import React, { useState } from "react";
import type { ResearchResult } from "../types";
import {
  Card,
  CardHeader,
  CardTitle,
  CardContent,
  Badge,
  Textarea,
} from "./ui";
import { cn } from "../lib/utils";
import {
  Brain,
  BookOpen,
  Target,
  ChevronDown,
  ChevronRight,
  Sparkles,
} from "lucide-react";

interface ResearchBriefProps {
  researchResult: ResearchResult;
  onNotesChange?: (notes: string) => void;
  showNotes: boolean;
  className?: string;
}

function ResearchBrief({
  researchResult,
  onNotesChange,
  showNotes,
  className,
}: ResearchBriefProps) {
  const [showMisconceptions, setShowMisconceptions] = useState(false);
  const [notes, setNotes] = useState("");

  const { chapter_info, suggested_distribution, key_concepts, misconceptions } =
    researchResult;

  const maxDistValue = Math.max(...Object.values(suggested_distribution), 1);

  return (
    <Card className={cn("border-primary/20", className)}>
      <CardHeader className="pb-3">
        <div className="flex items-center gap-2">
          <div className="rounded-lg bg-primary/10 p-1.5">
            <Sparkles className="h-4 w-4 text-primary" />
          </div>
          <CardTitle className="text-base">AI Research Brief</CardTitle>
        </div>
      </CardHeader>
      <CardContent className="space-y-4">
        {/* Key Concepts */}
        {key_concepts.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Brain className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Key Concepts
              </span>
            </div>
            <div className="flex flex-wrap gap-1.5">
              {key_concepts.map((concept) => (
                <Badge key={concept} variant="secondary" className="text-xs">
                  {concept}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Learning Outcomes */}
        {chapter_info.learning_outcomes.length > 0 && (
          <div className="space-y-2">
            <div className="flex items-center gap-1.5">
              <Target className="h-3.5 w-3.5 text-muted-foreground" />
              <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Learning Outcomes
              </span>
            </div>
            <ul className="space-y-1 pl-4">
              {chapter_info.learning_outcomes.slice(0, 5).map((outcome, i) => (
                <li
                  key={i}
                  className="text-sm text-foreground list-disc marker:text-muted-foreground/50"
                >
                  {outcome}
                </li>
              ))}
              {chapter_info.learning_outcomes.length > 5 && (
                <li className="text-xs text-muted-foreground list-none">
                  +{chapter_info.learning_outcomes.length - 5} more
                </li>
              )}
            </ul>
          </div>
        )}

        {/* Board-Specific Question Patterns */}
        {chapter_info.question_patterns && (
          <div className="rounded-md border border-blue-200 dark:border-blue-800 bg-blue-50/50 dark:bg-blue-950/30 p-3">
            <div className="flex items-center gap-1.5 mb-1">
              <BookOpen className="h-3.5 w-3.5 text-blue-600 dark:text-blue-400" />
              <span className="text-xs font-medium text-blue-700 dark:text-blue-300 uppercase tracking-wider">
                Board-Specific Patterns
              </span>
            </div>
            <p className="text-sm text-blue-900 dark:text-blue-100">
              {chapter_info.question_patterns}
            </p>
          </div>
        )}

        {/* Common Misconceptions (collapsible) */}
        {misconceptions.length > 0 && (
          <div className="space-y-2">
            <button
              type="button"
              onClick={() => setShowMisconceptions(!showMisconceptions)}
              className="flex items-center gap-1.5 text-xs font-medium text-muted-foreground uppercase tracking-wider hover:text-foreground transition-colors"
            >
              {showMisconceptions ? (
                <ChevronDown className="h-3.5 w-3.5" />
              ) : (
                <ChevronRight className="h-3.5 w-3.5" />
              )}
              Common Misconceptions ({misconceptions.length})
            </button>
            {showMisconceptions && (
              <div className="rounded-md border border-amber-200 dark:border-amber-800 bg-amber-50/50 dark:bg-amber-950/30 p-3">
                <ul className="space-y-1">
                  {misconceptions.map((m, i) => (
                    <li
                      key={i}
                      className="text-sm text-amber-900 dark:text-amber-100 flex items-start gap-2"
                    >
                      <span className="text-amber-500 mt-0.5 flex-shrink-0">
                        !
                      </span>
                      {m}
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Suggested Difficulty Distribution */}
        {Object.keys(suggested_distribution).length > 0 && (
          <div className="space-y-2">
            <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Suggested Distribution
            </span>
            <div className="space-y-1.5">
              {Object.entries(suggested_distribution).map(([key, value]) => (
                <div key={key} className="flex items-center gap-2">
                  <span className="text-xs text-muted-foreground w-16 capitalize flex-shrink-0">
                    {key}
                  </span>
                  <div className="flex-1 h-2 bg-muted rounded-full overflow-hidden">
                    <div
                      className={cn(
                        "h-full rounded-full transition-all",
                        key === "easy"
                          ? "bg-green-500"
                          : key === "medium"
                            ? "bg-amber-500"
                            : key === "hard"
                              ? "bg-red-500"
                              : "bg-primary",
                      )}
                      style={{
                        width: `${(value / maxDistValue) * 100}%`,
                      }}
                    />
                  </div>
                  <span className="text-xs font-medium text-foreground w-8 text-right">
                    {value}%
                  </span>
                </div>
              ))}
            </div>
          </div>
        )}

        {/* Teacher Notes Textarea */}
        {showNotes && onNotesChange && (
          <div className="space-y-2 border-t pt-3">
            <label className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
              Teacher Notes
            </label>
            <Textarea
              placeholder="Add constraints or focus areas (e.g., 'students struggled with factoring', 'focus on word problems')"
              value={notes}
              onChange={(e) => {
                setNotes(e.target.value);
                onNotesChange(e.target.value);
              }}
              className="min-h-[60px] text-sm"
            />
            {researchResult.teacher_notes_incorporated && (
              <p className="text-xs text-muted-foreground">
                Previously incorporated:{" "}
                <span className="italic">
                  {researchResult.teacher_notes_incorporated}
                </span>
              </p>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}

export { ResearchBrief };
export type { ResearchBriefProps };
