import React from "react";
import { cn } from "../lib/utils";

interface TeacherBadgeProps {
  teacherName: string;
  color: string;
  className?: string;
}

const TeacherBadge: React.FC<TeacherBadgeProps> = ({
  teacherName,
  color,
  className,
}) => {
  return (
    <span
      className={cn(
        "inline-flex items-center gap-1.5 text-xs text-muted-foreground",
        className,
      )}
    >
      <span
        className="h-2 w-2 shrink-0 rounded-full"
        style={{ backgroundColor: color }}
        aria-hidden="true"
      />
      <span className="truncate">{teacherName}</span>
    </span>
  );
};

export default TeacherBadge;
