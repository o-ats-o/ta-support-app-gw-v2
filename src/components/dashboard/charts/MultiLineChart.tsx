"use client";

import { useState } from "react";
import {
  ResponsiveContainer,
  LineChart,
  XAxis,
  YAxis,
  Tooltip as ReTooltip,
  Legend,
  Line,
  CartesianGrid,
} from "recharts";
import type { GroupInfo, TimeSeriesPoint } from "@/lib/types";

type Props = {
  data: TimeSeriesPoint[];
  groups: GroupInfo[];
  colors: Record<string, string>;
  yDomain?: [number | string, number | string];
};

export default function MultiLineChart({
  data,
  groups,
  colors,
  yDomain,
}: Props) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  const toggleSeries = (key?: string | number) => {
    if (!key) return;
    const k = String(key);
    setHidden((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const axisColor = "#6b5b4b"; // 軸ライン色
  const tickColor = "#6b6b6b"; // 目盛文字色
  const gridColor = "#d1d5db"; // グリッド色（薄いグレー）

  return (
    <ResponsiveContainer width="100%" height="100%">
      <LineChart
        data={data}
        margin={{ left: 0, right: 28, top: 32, bottom: 32 }}
      >
        <CartesianGrid
          strokeDasharray="3 6"
          stroke={gridColor}
          strokeOpacity={0.8}
        />
        <XAxis
          dataKey="time"
          stroke={axisColor}
          tick={{ fontSize: 16, fill: tickColor }}
          tickLine={false}
          axisLine={{ stroke: axisColor, strokeWidth: 3 }}
        />
        <YAxis
          stroke={axisColor}
          allowDecimals
          domain={yDomain ?? [0, "dataMax + 1"]}
          tick={{ fontSize: 16, fill: tickColor }}
          tickLine={false}
          axisLine={{ stroke: axisColor, strokeWidth: 3 }}
        />
        <ReTooltip
          cursor={{ strokeDasharray: "3 3" }}
          position={{ y: 8 }}
          wrapperStyle={{ zIndex: 9999 }}
        />
        <Legend
          onClick={(e) =>
            toggleSeries((e as any)?.dataKey ?? (e as any)?.value)
          }
          formatter={(value: any) => `Group ${String(value)}`}
          wrapperStyle={{ cursor: "pointer" }}
          verticalAlign="bottom"
        />
        {groups.map((g) => (
          <Line
            key={g.id}
            type="monotone"
            dataKey={g.id}
            stroke={colors[g.id]}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "#fff" }}
            strokeWidth={2}
            strokeLinecap="round"
            isAnimationActive={false}
            hide={!!hidden[g.id]}
          />
        ))}
      </LineChart>
    </ResponsiveContainer>
  );
}
