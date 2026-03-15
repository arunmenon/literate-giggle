import React from "react";
import { cn, getMasteryHex } from "../../lib/utils";

export interface MasteryHeatmapCell {
  topic: string;
  masteryLevel: string;
  score?: number;
}

export interface MasteryHeatmapProps {
  data: MasteryHeatmapCell[];
  columns?: number;
  className?: string;
  onCellClick?: (cell: MasteryHeatmapCell) => void;
}

const masteryLabels: Record<string, string> = {
  not_started: "Not Started",
  beginner: "Beginner",
  developing: "Developing",
  proficient: "Proficient",
  mastered: "Mastered",
};

const MasteryHeatmap: React.FC<MasteryHeatmapProps> = ({
  data,
  columns = 4,
  className,
  onCellClick,
}) => {
  return (
    <div className={cn("space-y-3", className)}>
      <div
        className="grid gap-2"
        style={{ gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))` }}
      >
        {data.map((cell) => (
          <button
            key={cell.topic}
            onClick={() => onCellClick?.(cell)}
            className={cn(
              "group relative rounded-lg p-3 text-left text-white transition-all duration-200 hover:scale-[1.02] hover:shadow-md",
              onCellClick && "cursor-pointer",
            )}
            style={{ backgroundColor: getMasteryHex(cell.masteryLevel) }}
            type="button"
          >
            <p className="text-xs font-medium truncate leading-tight">
              {cell.topic}
            </p>
            <p className="text-[10px] opacity-80 mt-0.5">
              {masteryLabels[cell.masteryLevel] ?? cell.masteryLevel}
            </p>
            {cell.score !== undefined && (
              <p className="text-lg font-bold font-display mt-1">
                {Math.round(cell.score)}%
              </p>
            )}
          </button>
        ))}
      </div>
      {/* Legend */}
      <div className="flex items-center gap-3 text-xs text-muted-foreground">
        {Object.entries(masteryLabels).map(([level, label]) => (
          <div key={level} className="flex items-center gap-1">
            <span
              className="h-2.5 w-2.5 rounded-sm"
              style={{ backgroundColor: getMasteryHex(level) }}
            />
            <span>{label}</span>
          </div>
        ))}
      </div>
    </div>
  );
};

export { MasteryHeatmap };
