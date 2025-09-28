"use client";

import { useMemo, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { AppHeader } from "@/components/ui/app-header";

export default function RecommendClient() {
  const data = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>(data.groups[0].id);
  const selected = data.groups.find((g) => g.id === selectedId)!;

  return (
    <div className="min-h-screen">
      <AppHeader
        date={new Date().toISOString().slice(0, 10)}
        onDateChange={() => {}}
        onRefresh={() => {}}
      />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <RecommendGroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTimeChange={(range) => {
              // /recommend-ver 用のエンドポイントを叩く想定
              // ここではダミー実装（実際は fetch 等で API 呼び出し）
              console.log("[recommend-ver] fetch with time range:", range);
            }}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail data={data} selected={selected} />
        </div>
      </main>
    </div>
  );
}
