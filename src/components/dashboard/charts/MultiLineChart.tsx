"use client";

import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  Line,
} from "recharts";
import type { GroupInfo, TimeSeriesPoint } from "@/lib/types";

type Props = {
  data: TimeSeriesPoint[];
  groups: GroupInfo[];
  colors: Record<string, string>;
};

export default function MultiLineChart({ data, groups, colors }: Props) {
  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart data={data} margin={{ left: 8, right: 16, top: 8 }}>
        <XAxis dataKey="time" stroke="hsl(var(--muted-foreground))" />
        <YAxis stroke="hsl(var(--muted-foreground))" allowDecimals />
        <ReTooltip cursor={{ strokeDasharray: "3 3" }} />
        <Legend />
        {groups.map((g) => (
          <Line
            key={g.id}
            type="monotone"
            dataKey={g.id}
            stroke={colors[g.id]}
            dot={false}
            strokeWidth={2}
            isAnimationActive={false}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
