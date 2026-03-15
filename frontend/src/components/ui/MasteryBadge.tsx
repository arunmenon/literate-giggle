import React from "react";
import { cn, getMasteryBgColor } from "../../lib/utils";

export interface MasteryBadgeProps {
  level: string;
  showLabel?: boolean;
  size?: "sm" | "md";
  className?: string;
}

const masteryLabels: Record<string, string> = {
  not_started: "Not Started",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

const MasteryBadge: React.FC<MasteryBadgeProps> = ({
  level,
  showLabel = true,
  size = "md",
  className,
}) => {
  const label = masteryLabels[level] ?? level;

  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 rounded-full font-medium text-white",
        getMasteryBgColor(level),
        size === "sm" ? "px-2 py-0.5 text-[10px]" : "px-3 py-1 text-xs",
        className,
      )}
    >
      <span
        className={cn(
          "rounded-full bg-white/30",
          size === "sm" ? "h-1.5 w-1.5" : "h-2 w-2",
        )}
      />
      {showLabel && label}
    </span>
  );
};

export { MasteryBadge };
