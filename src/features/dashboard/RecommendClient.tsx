"use client";

import { useCallback, useMemo, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { AppHeader } from "@/components/ui/app-header";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";

export default function RecommendClient() {
  const data = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>(data.groups[0].id);
  const [timeRange, setTimeRange] = useState<string>(DEFAULT_TIME_LABEL);
  const selected = data.groups.find((g) => g.id === selectedId)!;

  const handleTimeChange = useCallback((range: string) => {
    setTimeRange(range);
    // /recommend-ver 用のエンドポイントを叩く想定
    console.log("[recommend-ver] fetch with time range:", range);
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader
        date={new Date().toISOString().slice(0, 10)}
        onDateChange={() => {}}
      />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <RecommendGroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTimeChange={handleTimeChange}
            timeRange={timeRange}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail data={data} selected={selected} />
        </div>
      </main>
    </div>
  );
}
