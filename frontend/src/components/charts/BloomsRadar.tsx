import React from "react";
import {
  RadarChart,
  Radar,
  PolarGrid,
  PolarAngleAxis,
  PolarRadiusAxis,
  ResponsiveContainer,
  Tooltip,
} from "recharts";

export interface BloomsRadarDataPoint {
  level: string;
  score: number;
  fullMark?: number;
}

export interface BloomsRadarProps {
  data: BloomsRadarDataPoint[];
  height?: number;
  className?: string;
}

const defaultBloomsLevels = [
  "Remember",
  "Understand",
  "Apply",
  "Analyze",
  "Evaluate",
  "Create",
];

const BloomsRadar: React.FC<BloomsRadarProps> = ({
  data,
  height = 280,
  className,
}) => {
  const chartData = defaultBloomsLevels.map((level) => {
    const entry = data.find(
      (d) => d.level.toLowerCase() === level.toLowerCase(),
    );
    return {
      level,
      score: entry?.score ?? 0,
      fullMark: entry?.fullMark ?? 100,
    };
  });

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <RadarChart data={chartData} cx="50%" cy="50%" outerRadius="75%">
          <PolarGrid stroke="hsl(var(--border))" />
          <PolarAngleAxis
            dataKey="level"
            tick={{ fontSize: 11, fill: "hsl(var(--muted-foreground))" }}
          />
          <PolarRadiusAxis
            angle={90}
            domain={[0, 100]}
            tick={{ fontSize: 10, fill: "hsl(var(--muted-foreground))" }}
            tickFormatter={(value: number) => `${value}`}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "hsl(var(--card-foreground))",
            }}
            formatter={(value) => [`${value}%`, "Score"]}
          />
          <Radar
            name="Score"
            dataKey="score"
            stroke="hsl(var(--primary))"
            fill="hsl(var(--primary))"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </RadarChart>
      </ResponsiveContainer>
    </div>
  );
};

export { BloomsRadar };
