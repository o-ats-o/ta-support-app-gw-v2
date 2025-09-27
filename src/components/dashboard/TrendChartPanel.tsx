"use client";

import { useState } from "react";
import type { DashboardData, GroupInfo } from "@/lib/types";
import dynamic from "next/dynamic";
import { ChartSeriesSelector } from "@/components/ui/chart-series-selector";

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
      <ChartSeriesSelector value={series} onChange={setSeries} />

      <div className="mt-2 flex justify-end mt-6 mr-4">
        <button
          type="button"
          className={`px-3 py-2 rounded-md text-xs border ${
            onlySelected
              ? "bg-emerald-600 text-white border-emerald-600 hover:bg-emerald-700"
              : "bg-white text-emerald-700 border-emerald-600 hover:bg-emerald-50"
          }`}
          onClick={() => setOnlySelected((v) => !v)}
        >
          {onlySelected ? "全グループを表示" : "選択グループを表示"}
        </button>
      </div>

      <div className="mt-3 h-[360px]">
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
