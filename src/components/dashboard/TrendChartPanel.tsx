"use client";

import { useState } from "react";
import type { DashboardData, GroupInfo } from "@/lib/types";
import dynamic from "next/dynamic";

const MultiLineChart = dynamic(() => import("./charts/MultiLineChart"), {
  ssr: false,
});

type Props = {
  data: DashboardData;
  groups: GroupInfo[];
  selected: GroupInfo;
  defaultSeries?: "speech" | "sentiment" | "miroOps";
};

export default function TrendChartPanel({
  data,
  groups,
  selected,
  defaultSeries = "speech",
}: Props) {
  const colors = Object.fromEntries(groups.map((g) => [g.id, g.color]));
  const [series, setSeries] = useState<"speech" | "sentiment" | "miroOps">(
    defaultSeries
  );
  const [onlySelected, setOnlySelected] = useState(false);

  return (
    <div>
      <div className="flex gap-2">
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-xs ${
            series === "speech" ? "bg-secondary" : "border"
          }`}
          onClick={() => setSeries("speech")}
        >
          発話回数
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-xs ${
            series === "sentiment" ? "bg-secondary" : "border"
          }`}
          onClick={() => setSeries("sentiment")}
        >
          感情
        </button>
        <button
          type="button"
          className={`px-3 py-1 rounded-md text-xs ${
            series === "miroOps" ? "bg-secondary" : "border"
          }`}
          onClick={() => setSeries("miroOps")}
        >
          Miro作業量
        </button>
        <div className="ml-auto">
          <button
            type="button"
            className={`px-3 py-1 rounded-md text-xs ${
              onlySelected ? "bg-secondary" : "border"
            }`}
            onClick={() => setOnlySelected((v) => !v)}
          >
            {onlySelected ? "全グループを表示" : "選択グループを表示"}
          </button>
        </div>
      </div>

      <div className="mt-3 h-[320px]">
        <MultiLineChart
          data={data.timeseries[series]}
          colors={colors}
          groups={onlySelected ? [selected] : groups}
          yDomain={series === "sentiment" ? [-1, 1] : undefined}
        />
      </div>
    </div>
  );
}
