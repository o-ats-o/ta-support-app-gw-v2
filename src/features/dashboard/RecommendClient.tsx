"use client";

import { useMemo, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";

export default function RecommendClient() {
  const data = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>(data.groups[0].id);
  const selected = data.groups.find((g) => g.id === selectedId)!;

  return (
    <div className="min-h-screen">
      <header className="fixed top-0 left-0 right-0 z-50 h-12 bg-emerald-600 text-white flex items-center px-4 font-semibold w-full">
        TA機関指導支援システム
        <button className="ml-auto text-sm bg-white/15 rounded px-3 py-1">
          更新
        </button>
      </header>

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
