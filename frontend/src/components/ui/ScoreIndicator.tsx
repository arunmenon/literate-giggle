import React from "react";
import { cn } from "../../lib/utils";

export interface ScoreIndicatorProps {
  score: number;
  maxScore: number;
  size?: "sm" | "md" | "lg";
  showPercentage?: boolean;
  className?: string;
}

const ScoreIndicator: React.FC<ScoreIndicatorProps> = ({
  score,
  maxScore,
  size = "md",
  showPercentage = true,
  className,
}) => {
  const percentage = maxScore > 0 ? Math.round((score / maxScore) * 100) : 0;
  const circumference = 2 * Math.PI * 40;
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  const sizeMap = {
    sm: { container: "w-16 h-16", text: "text-sm", subtext: "text-[10px]" },
    md: { container: "w-24 h-24", text: "text-xl", subtext: "text-xs" },
    lg: { container: "w-32 h-32", text: "text-3xl", subtext: "text-sm" },
  };

  const colorClass =
    percentage >= 80
      ? "text-mastery-mastered"
      : percentage >= 60
        ? "text-mastery-proficient"
        : percentage >= 40
          ? "text-mastery-developing"
          : "text-mastery-beginner";

  const strokeColor =
    percentage >= 80
      ? "#22c55e"
      : percentage >= 60
        ? "#3b82f6"
        : percentage >= 40
          ? "#f97316"
          : "#ef4444";

  return (
    <div
      className={cn(
        "relative inline-flex items-center justify-center",
        sizeMap[size].container,
        className,
      )}
    >
      <svg className="absolute inset-0 -rotate-90" viewBox="0 0 100 100">
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          className="stroke-muted"
          strokeWidth="8"
        />
        <circle
          cx="50"
          cy="50"
          r="40"
          fill="none"
          stroke={strokeColor}
          strokeWidth="8"
          strokeLinecap="round"
          strokeDasharray={circumference}
          strokeDashoffset={strokeDashoffset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="text-center z-10">
        {showPercentage ? (
          <span
            className={cn(
              "font-bold font-display",
              sizeMap[size].text,
              colorClass,
            )}
          >
            {percentage}%
          </span>
        ) : (
          <div>
            <span
              className={cn(
                "font-bold font-display",
                sizeMap[size].text,
                colorClass,
              )}
            >
              {score}
            </span>
            <span
              className={cn("text-muted-foreground", sizeMap[size].subtext)}
            >
              /{maxScore}
            </span>
          </div>
        )}
      </div>
    </div>
  );
};

export { ScoreIndicator };
