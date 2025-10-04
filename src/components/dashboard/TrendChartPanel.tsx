"use client";

import { useState } from "react";
import type { DashboardData, GroupInfo } from "@/lib/types";
import dynamic from "next/dynamic";
import { Card } from "@/components/ui/card";
import { ChartSeriesSelector } from "@/components/ui/chart-series-selector";

const MultiLineChart = dynamic(() => import("./charts/MultiLineChart"), {
  ssr: false,
});

type Props = {
  data: DashboardData;
  groups: GroupInfo[];
  selected: GroupInfo;
  defaultSeries?: "speech" | "sentiment" | "miroOps";
  timeseriesLoading?: boolean;
};

export default function TrendChartPanel({
  data,
  groups,
  selected,
  defaultSeries = "speech",
  timeseriesLoading = false,
}: Props) {
  const colors = Object.fromEntries(groups.map((g) => [g.id, g.color]));
  const [series, setSeries] = useState<"speech" | "sentiment" | "miroOps">(
    defaultSeries
  );
  const [onlySelected, setOnlySelected] = useState(false);

  return (
    <Card className="flex h-full min-h-0 flex-col p-4">
      <div className="font-semibold text-md">時間推移グラフ</div>
      <div className="-mt-3">
        <ChartSeriesSelector value={series} onChange={setSeries} />
      </div>

      <div className="mt-2 flex justify-end mr-4">
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

      <div
        className="relative -mt-2 flex-1 min-h-[320px]"
        aria-busy={timeseriesLoading}
        aria-live="polite"
      >
        {timeseriesLoading && (
          <div className="absolute inset-0 z-10 flex items-center justify-center bg-white/80 dark:bg-slate-900/80 backdrop-blur-sm">
            <div
              className="h-12 w-12 rounded-full border-4 border-emerald-500 border-t-transparent animate-spin"
              role="status"
              aria-label="時間推移を読み込み中"
            />
          </div>
        )}
        <MultiLineChart
          data={data.timeseries[series]}
          colors={colors}
          groups={groups}
          yDomain={series === "sentiment" ? [-1, 1] : undefined}
          initialHiddenIds={
            // ボタン状態に応じて初期非表示を切替。
            // 「選択グループを表示」= true のときは他を非表示、
            // 「全グループを表示」= false のときは全て表示。
            onlySelected
              ? groups.filter((g) => g.id !== selected.id).map((g) => g.id)
              : []
          }
        />
      </div>
    </Card>
  );
}
