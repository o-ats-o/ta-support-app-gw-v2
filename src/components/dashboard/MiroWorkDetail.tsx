"use client";

import { useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import type { GroupInfo, MiroDiffSummary } from "@/lib/types";
import { INITIAL_MIRO_SUMMARY } from "@/features/dashboard/miroSummary";
import { cn } from "@/lib/utils";

type Props = {
  selected: GroupInfo;
  date?: string;
  timeRange?: string;
  summary?: MiroDiffSummary | null;
  loading?: boolean;
  error?: string | null;
};

type DiffCategory = "added" | "updated" | "deleted";

const CATEGORY_CONFIG: Record<DiffCategory, { label: string; icon: string; color: string }> = {
  added: { label: "追加", icon: "+", color: "text-emerald-600" },
  updated: { label: "編集", icon: "✎", color: "text-blue-600" },
  deleted: { label: "削除", icon: "🗑", color: "text-red-600" },
};

const diffTimeFormatter = new Intl.DateTimeFormat("ja-JP", {
  dateStyle: "medium",
  timeStyle: "short",
  timeZone: "Asia/Tokyo",
});

function formatDiffTimestampLabel(value?: string | null): string | null {
  if (!value) return null;
  const dateObj = new Date(value);
  if (Number.isNaN(dateObj.getTime())) {
    return value;
  }
  try {
    return diffTimeFormatter.format(dateObj);
  } catch {
    return value;
  }
}

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
  const detailMap = baseSummary.details ?? INITIAL_MIRO_SUMMARY.details;
  const { added: addedDetails, updated: updatedDetails, deleted: deletedDetails } =
    detailMap;

  const [activeCategory, setActiveCategory] = useState<DiffCategory | null>(null);

  useEffect(() => {
    if (!activeCategory) return;
    const lengthLookup: Record<DiffCategory, number> = {
      added: addedDetails.length,
      updated: updatedDetails.length,
      deleted: deletedDetails.length,
    };
    if (lengthLookup[activeCategory] === 0) {
      setActiveCategory(null);
    }
  }, [
    activeCategory,
    addedDetails.length,
    updatedDetails.length,
    deletedDetails.length,
  ]);

  const summaryItems = useMemo(
    () => [
      {
        key: "added" as const,
        ...CATEGORY_CONFIG.added,
        count: baseSummary.added,
        items: addedDetails,
      },
      {
        key: "updated" as const,
        ...CATEGORY_CONFIG.updated,
        count: baseSummary.updated,
        items: updatedDetails,
      },
      {
        key: "deleted" as const,
        ...CATEGORY_CONFIG.deleted,
        count: baseSummary.deleted,
        items: deletedDetails,
      },
    ],
    [
      baseSummary.added,
      baseSummary.updated,
      baseSummary.deleted,
      addedDetails,
      updatedDetails,
      deletedDetails,
    ]
  );

  const showSkeleton = loading && summary == null;
  const isRefreshing = loading && summary != null;
  const emptyMessage =
    !loading && !effectiveError && baseSummary.diffCount === 0
      ? "選択した時間帯で新しい差分は検出されませんでした。"
      : null;

  const selectedItems =
    activeCategory === "added"
      ? addedDetails
      : activeCategory === "updated"
      ? updatedDetails
      : activeCategory === "deleted"
      ? deletedDetails
      : [];

  const selectedSummaryItem = summaryItems.find(
    (item) => item.key === activeCategory
  );
  const selectedCount = selectedItems.length;
  const blockDetails = Boolean(effectiveError) && summary == null;
  const showErrorBanner = Boolean(effectiveError) && summary != null;

  return (
    <Card className="flex h-full min-h-0 flex-col p-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <div className="font-semibold text-base">Miro作業量詳細</div>
          <div className="text-sm text-muted-foreground">
            総数: {baseSummary.total}件
          </div>
        </div>
        {isRefreshing ? (
          <div className="flex items-center text-xs text-emerald-500">
            更新中…
          </div>
        ) : null}
      </div>

      {effectiveError ? (
        <div className="mt-1 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-900/40 dark:bg-red-950/40 dark:text-red-200">
          {effectiveError}
        </div>
      ) : emptyMessage ? (
        <div className="-mt-3 rounded-md border border-muted-foreground/40 bg-muted/30 px-3 py-2 text-sm text-muted-foreground">
          {emptyMessage}
        </div>
      ) : null}

      <div className="-mt-2 grid grid-cols-1 gap-4 md:grid-cols-3">
        {summaryItems.map((item) => {
          const percent = formatPercent(item.count, baseSummary.total);
          const isActive = activeCategory === item.key;
          const isDisabled = item.count <= 0 && item.items.length <= 0;
          return (
            <Card
              key={item.key}
              role="button"
              tabIndex={isDisabled ? -1 : 0}
              aria-pressed={isActive}
              aria-disabled={isDisabled}
              onClick={() => {
                if (isDisabled) return;
                setActiveCategory((prev) =>
                  prev === item.key ? null : item.key
                );
              }}
              onKeyDown={(event) => {
                if (isDisabled) return;
                if (event.key === "Enter" || event.key === " ") {
                  event.preventDefault();
                  setActiveCategory((prev) =>
                    prev === item.key ? null : item.key
                  );
                }
              }}
              className={cn(
                "flex h-[180px] flex-col justify-center gap-3 bg-muted/40 p-4 transition focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500 focus-visible:ring-offset-2",
                isDisabled
                  ? "cursor-not-allowed opacity-60"
                  : "cursor-pointer hover:bg-muted",
                isActive
                  ? "border-emerald-500 ring-2 ring-emerald-500"
                  : "border-transparent"
              )}
            >
              <div className="flex items-center gap-2 text-muted-foreground">
                <span className="text-xl" aria-hidden>
                  {item.icon}
                </span>
                <span className="font-medium text-black dark:text-white">
                  {item.label}
                </span>
              </div>
              <div className={cn("mt-4 text-3xl font-bold", item.color)}>
                {showSkeleton ? <Skeleton className="h-9 w-16" /> : item.count}
              </div>
              <div className="text-sm text-muted-foreground">
                {showSkeleton ? (
                  <Skeleton className="mt-2 h-4 w-16" />
                ) : (
                  <span>{percent}</span>
                )}
              </div>
            </Card>
          );
        })}
      </div>

      <div className="flex-1 min-h-[260px] max-h-[420px] flex flex-col overflow-hidden rounded-xl border border-muted-foreground/40 bg-muted/20">
        <div className="flex items-center justify-between border-b border-muted-foreground/40 px-4 py-3">
          <div className="font-semibold text-sm">
            {activeCategory && selectedSummaryItem
              ? `${selectedSummaryItem.label}の詳細`
              : "差分の詳細"}
          </div>
          <div className="flex items-center gap-2 text-xs text-muted-foreground">
            {showErrorBanner ? (
              <span className="text-amber-600">注意</span>
            ) : null}
            {activeCategory && selectedSummaryItem ? (
              <span>
                {selectedSummaryItem.label}
                {selectedCount ? ` (${selectedCount}件)` : ""}
              </span>
            ) : (
              <span className="text-muted-foreground/70">
                カード選択で詳細を表示
              </span>
            )}
          </div>
        </div>
        <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {showSkeleton ? (
              <div className="space-y-2">
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
                <Skeleton className="h-16 w-full" />
              </div>
            ) : blockDetails ? (
              <div className="rounded-md border border-muted-foreground/40 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                {effectiveError}
              </div>
            ) : (
              <>
                {showErrorBanner && effectiveError ? (
                  <div className="rounded-md border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-700 dark:border-amber-900/40 dark:bg-amber-950/30 dark:text-amber-200">
                    {effectiveError}
                  </div>
                ) : null}
                {activeCategory && selectedSummaryItem ? (
                  selectedItems.length > 0 ? (
                    selectedItems.map((item, index) => {
                      const diffLabel = formatDiffTimestampLabel(item.diffAt);
                      return (
                        <div
                          key={`${item.id}-${item.diffAt ?? "unknown"}-${index}`}
                          className="rounded-lg border border-muted-foreground/40 bg-background/70 px-3 py-3 text-sm shadow-sm"
                        >
                          <div className="flex flex-wrap items-start justify-between gap-3">
                            <div className="space-y-1">
                              <div className="flex items-center gap-2">
                                {item.type ? (
                                  <Badge variant="outline">{item.type}</Badge>
                                ) : null}
                                <span className="font-medium leading-snug">
                                  {item.title}
                                </span>
                              </div>
                              {item.subtitle ? (
                                <div className="text-xs text-muted-foreground">
                                  {item.subtitle}
                                </div>
                              ) : null}
                            </div>
                            {diffLabel ? (
                              <div className="text-xs text-muted-foreground whitespace-nowrap">
                                {diffLabel}
                              </div>
                            ) : null}
                          </div>
                        </div>
                      );
                    })
                  ) : (
                    <div className="rounded-md border border-dashed border-muted-foreground/40 bg-muted/20 px-3 py-6 text-center text-sm text-muted-foreground">
                      選択したカテゴリの差分はありません。
                    </div>
                  )
                ) : (
                  <div className="rounded-md border border-dashed border-muted-foreground/40 bg-background/40 px-3 py-6 text-center text-sm text-muted-foreground">
                    カードを選択すると差分の詳細が表示されます。
                  </div>
                )}
              </>
            )}
          </div>
        </div>
    </Card>
  );
}
