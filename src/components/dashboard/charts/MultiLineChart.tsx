"use client";

import { useEffect, useState } from "react";
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
import CustomTooltip from "./CustomTooltip";
import type { GroupInfo, TimeSeriesPoint } from "@/lib/types";

type Props = {
  data: TimeSeriesPoint[];
  groups: GroupInfo[];
  colors: Record<string, string>;
  yDomain?: [number | string, number | string];
  // 初期状態で非表示にする系列のID一覧（プロップ変更時に再適用）
  initialHiddenIds?: string[];
};

export default function MultiLineChart({
  data,
  groups,
  colors,
  yDomain,
  initialHiddenIds,
}: Props) {
  const [hidden, setHidden] = useState<Record<string, boolean>>({});

  // 初期非表示の指定が変更されたら反映する
  useEffect(() => {
    if (!initialHiddenIds) return;
    const next: Record<string, boolean> = {};
    for (const g of groups) {
      next[g.id] = initialHiddenIds.includes(g.id);
    }
    setHidden(next);
  }, [initialHiddenIds, groups]);

  const toggleSeries = (key?: string | number) => {
    if (!key) return;
    const k = String(key);
    setHidden((prev) => ({ ...prev, [k]: !prev[k] }));
  };

  const axisColor = "#6b5b4b"; // 軸ライン色
  const tickColor = "#6b6b6b"; // 目盛文字色
  const gridColor = "#d1d5db"; // グリッド色（薄いグレー）

  // ツールチップは別ファイルの CustomTooltip を使用

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
          tick={{ fontSize: 16, fill: tickColor, dy: 6 }}
          tickLine={true}
          axisLine={{ stroke: axisColor, strokeWidth: 3 }}
          tickMargin={8}
        />
        <YAxis
          stroke={axisColor}
          allowDecimals
          domain={yDomain ?? [0, "dataMax + 1"]}
          tick={{ fontSize: 16, fill: tickColor }}
          tickLine={true}
          axisLine={{ stroke: axisColor, strokeWidth: 3 }}
        />
        <ReTooltip
          cursor={{ strokeDasharray: "3 3" }}
          position={{ y: 8 }}
          wrapperStyle={{ zIndex: 9999 }}
          content={<CustomTooltip />}
        />
        <Legend
          onClick={(e: unknown) => {
            const key =
              (e as { dataKey?: string | number; value?: string | number })
                ?.dataKey ??
              (e as { dataKey?: string | number; value?: string | number })
                ?.value;
            toggleSeries(key);
          }}
          formatter={(value: string | number) => `Group ${String(value)}`}
          wrapperStyle={{ cursor: "pointer", paddingTop: 24 }}
          verticalAlign="bottom"
        />
        {groups.map((g) => (
          <Line
            key={g.id}
            type="monotone"
            dataKey={g.id}
            stroke={colors[g.id]}
            dot={{ r: 4, strokeWidth: 2, fill: "#fff" }}
            activeDot={{ r: 5, strokeWidth: 2, fill: "#000" }}
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
