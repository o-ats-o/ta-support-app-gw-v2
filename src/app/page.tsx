"use client";

import { useMemo, useState } from "react";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";

export default function Home() {
  const data = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>(data.groups[0].id);
  const selected = data.groups.find((g) => g.id === selectedId)!;

  return (
    <div className="min-h-screen p-4">
      <header className="h-12 rounded-md bg-emerald-600 text-white flex items-center px-4 font-semibold">
        TA機関指導支援システム
        <button className="ml-auto text-sm bg-white/15 rounded px-3 py-1">
          更新
        </button>
      </header>

      <main className="grid grid-cols-1 lg:grid-cols-[420px_minmax(0,1fr)] gap-4 mt-4">
        <div className="lg:sticky lg:top-4 self-start">
          <GroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
          />
        </div>
        <GroupDetail data={data} selected={selected} />
      </main>
    </div>
  );
}
