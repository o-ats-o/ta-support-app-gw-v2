"use client";

import { useMemo } from "react";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupInfo, MiroDiffSummary } from "@/lib/types";
import { INITIAL_MIRO_SUMMARY } from "@/features/dashboard/miroSummary";

type Props = {
  selected: GroupInfo;
  date?: string;
  timeRange?: string;
  summary?: MiroDiffSummary | null;
  loading?: boolean;
  error?: string | null;
};

const diffTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function formatPercent(numerator: number, denominator: number) {
  if (denominator <= 0) return "0.0%";
  const percent = (numerator / denominator) * 100;
  return `${(Math.round(percent * 10) / 10).toFixed(1)}%`;
}

export default function MiroWorkDetail({
  selected,
  date,
  timeRange,
  summary,
  loading = false,
  error,
}: Props) {
  const hasRange = Boolean(date && timeRange);

  const effectiveError = useMemo(() => {
    if (!hasRange) {
      return "時間帯を選択すると差分を表示できます。";
    }
    return error ?? null;
  }, [hasRange, error]);

  const baseSummary = summary ?? INITIAL_MIRO_SUMMARY;

  const diffAtLabel = useMemo(() => {
    if (!baseSummary.lastDiffAt) return null;
    const dateObj = new Date(baseSummary.lastDiffAt);
    if (Number.isNaN(dateObj.getTime())) {
      return baseSummary.lastDiffAt;
    }
    try {
      return diffTimeFormatter.format(dateObj);
    } catch {
      return baseSummary.lastDiffAt;
    }
  }, [baseSummary.lastDiffAt]);

  const summaryItems = useMemo(
    () => [
      {
        key: "added" as const,
        label: "追加",
        icon: "+",
        color: "text-emerald-600",
        count: baseSummary.added,
      },
      {
        key: "updated" as const,
        label: "編集",
        icon: "✎",
        color: "text-blue-600",
        count: baseSummary.updated,
      },
      {
        key: "deleted" as const,
        label: "削除",
        icon: "🗑",
        color: "text-red-600",
        count: baseSummary.deleted,
      },
    ],
    [baseSummary.added, baseSummary.updated, baseSummary.deleted]
  );

  const showSkeleton = loading && summary == null;
  const emptyMessage =
    !loading && !effectiveError && baseSummary.diffCount === 0
      ? "選択した時間帯で新しい差分は検出されませんでした。"
      : null;

  return (
    <Card className="flex h-[480px] flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-base">Miro作業量詳細</div>
          <div className="text-sm text-muted-foreground">
            総数: {baseSummary.total}件
          </div>
          {diffAtLabel ? (
            <div className="mt-1 text-xs text-muted-foreground">
              最終差分: {diffAtLabel}
            </div>
          ) : (
            <div className="mt-1 text-xs text-muted-foreground">
              最終差分はまだ取得できていません
            </div>
          )}
          {baseSummary.boardId ? (
            <div className="text-xs text-muted-foreground">
              Board ID: <span className="font-mono">{baseSummary.boardId}</span>
            </div>
          ) : null}
        </div>
        <div className="text-xs text-muted-foreground">
          対象グループ: {selected.name}
        </div>
      </div>

      {effectiveError ? (
        <div className="mt-3 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {effectiveError}
        </div>
      ) : emptyMessage ? (
        <div className="mt-3 rounded-md border border-muted-foreground/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}

      <div className="mt-4 grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaryItems.map((item) => {
          const percent = formatPercent(item.count, baseSummary.total);
          return (
            <Card
              key={item.key}
              className="flex h-[180px] flex-col justify-center gap-3 bg-muted/40 p-4"
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="font-medium text-black dark:text-white">
                  {item.label}
                </span>
              </div>
              <div className={`mt-4 text-3xl font-bold ${item.color}`}>
                {showSkeleton ? <Skeleton className="h-9 w-16" /> : item.count}
              </div>
              <div className="mt-2 text-sm text-muted-foreground">
                {showSkeleton ? <Skeleton className="h-4 w-16" /> : percent}
              </div>
            </Card>
          );
        })}
      </div>
    </Card>
  );
}
