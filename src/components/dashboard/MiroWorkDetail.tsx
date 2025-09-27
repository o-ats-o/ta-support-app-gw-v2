"use client";

import { Card } from "@/components/ui/card";
import type { DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
};

function formatPercent(n: number) {
  return `${(Math.round(n * 10) / 10).toFixed(1)}%`;
}

export default function MiroWorkDetail({ selected }: Props) {
  const total = selected.metrics.miroOpsCount;

  // 簡易分配（合計がズレないように最後で調整）
  const addCount = Math.floor(total * 0.53);
  const editCount = Math.floor(total * 0.33);
  const deleteCount = Math.max(0, total - addCount - editCount);

  const items = [
    {
      key: "add",
      label: "追加",
      icon: "+",
      color: "text-emerald-600",
      count: addCount,
    },
    {
      key: "edit",
      label: "編集",
      icon: "✎",
      color: "text-blue-600",
      count: editCount,
    },
    {
      key: "delete",
      label: "削除",
      icon: "🗑",
      color: "text-red-600",
      count: deleteCount,
    },
  ] as const;

  return (
    <Card className="p-4 h-[480px]">
      <div className="flex items-baseline gap-3">
        <div className="font-semibold text-base">Miro作業量詳細</div>
        <div className="text-sm text-muted-foreground">総数: {total}件</div>
      </div>

      <div className="mt-4 grid grid-cols-1 md:grid-cols-3 gap-4">
        {items.map((it) => {
          const percent = total > 0 ? (it.count / total) * 100 : 0;
          return (
            <Card
              key={it.key}
              className="p-4 h-[180px] justify-center gap-3 bg-muted/40"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xl" aria-hidden>
                  {it.icon}
                </span>
                <span className="font-medium text-black">{it.label}</span>
              </div>
              <div className={`mt-4 text-3xl font-bold ${it.color}`}>
                {it.count}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {formatPercent(percent)}
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}
