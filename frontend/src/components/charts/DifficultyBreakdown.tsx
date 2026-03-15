import React from "react";
import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  Legend,
} from "recharts";

export interface DifficultyBreakdownDataPoint {
  difficulty: string;
  obtained: number;
  total: number;
}

export interface DifficultyBreakdownProps {
  data: DifficultyBreakdownDataPoint[];
  height?: number;
  className?: string;
}

const DifficultyBreakdown: React.FC<DifficultyBreakdownProps> = ({
  data,
  height = 250,
  className,
}) => {
  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={height}>
        <BarChart
          data={data}
          margin={{ top: 5, right: 20, left: 0, bottom: 5 }}
        >
          <CartesianGrid
            strokeDasharray="3 3"
            stroke="hsl(var(--border))"
            vertical={false}
          />
          <XAxis
            dataKey="difficulty"
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={{ stroke: "hsl(var(--border))" }}
            tickLine={false}
          />
          <YAxis
            tick={{ fontSize: 12, fill: "hsl(var(--muted-foreground))" }}
            axisLine={false}
            tickLine={false}
          />
          <Tooltip
            contentStyle={{
              backgroundColor: "hsl(var(--card))",
              border: "1px solid hsl(var(--border))",
              borderRadius: "var(--radius)",
              fontSize: 12,
              color: "hsl(var(--card-foreground))",
            }}
          />
          <Legend
            wrapperStyle={{
              fontSize: 12,
              color: "hsl(var(--muted-foreground))",
            }}
          />
          <Bar
            dataKey="obtained"
            name="Obtained"
            fill="hsl(var(--primary))"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="total"
            name="Total"
            fill="hsl(var(--muted))"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
};

export { DifficultyBreakdown };
