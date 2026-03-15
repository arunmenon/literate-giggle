import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatPercentage(value: number): string {
  return `${Math.round(value)}%`;
}

export function getMasteryColor(level: string): string {
  const colors: Record<string, string> = {
    not_started: "text-mastery-not_started",
    beginner: "text-mastery-beginner",
    developing: "text-mastery-developing",
    proficient: "text-mastery-proficient",
    mastered: "text-mastery-mastered",
  };
  return colors[level] ?? "text-muted-foreground";
}

export function getMasteryBgColor(level: string): string {
  const colors: Record<string, string> = {
    not_started: "bg-mastery-not_started",
    beginner: "bg-mastery-beginner",
    developing: "bg-mastery-developing",
    proficient: "bg-mastery-proficient",
    mastered: "bg-mastery-mastered",
  };
  return colors[level] ?? "bg-muted";
}

export function getMasteryHex(level: string): string {
  const colors: Record<string, string> = {
    not_started: "#9ca3af",
    beginner: "#ef4444",
    developing: "#f97316",
    proficient: "#3b82f6",
    mastered: "#22c55e",
  };
  return colors[level] ?? "#9ca3af";
}

export function getGradeColor(grade: string): string {
  const colors: Record<string, string> = {
    "A+": "text-mastery-mastered",
    A: "text-mastery-mastered",
    "B+": "text-mastery-proficient",
    B: "text-mastery-proficient",
    C: "text-mastery-developing",
    D: "text-mastery-beginner",
    F: "text-mastery-beginner",
  };
  return colors[grade] ?? "text-muted-foreground";
}
