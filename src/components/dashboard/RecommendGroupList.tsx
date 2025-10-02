"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import GroupListHeader from "@/components/ui/group-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { GroupInfo, RecommendationGroupItem } from "@/lib/types";
import { AlertCircle, AlertTriangle, Star } from "lucide-react";

type Props = {
  recommendations: RecommendationGroupItem[];
  selectedId: string;
  onSelect: (id: string) => void;
  onTimeChange?: (timeRange: string) => void;
  timeRange?: string;
  loading?: boolean;
  error?: string | null;
  highlightCount?: number;
  refreshing?: boolean;
};

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  const hasDelta = typeof delta === "number" && !Number.isNaN(delta);
  const isPositive = hasDelta && delta! > 0;
  const isNegative = hasDelta && delta! < 0;
  const deltaText = !hasDelta
    ? null
    : isPositive
      ? `+${delta}`
      : isNegative
        ? `${delta}`
        : "±0";
  const deltaClass = isPositive
    ? "text-emerald-600"
    : isNegative
      ? "text-red-600"
      : "text-muted-foreground";
  return (
    <div className="flex items-baseline gap-1 text-[13px]">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
      {hasDelta && deltaText !== null && (
        <span className={cn("tabular-nums", deltaClass)}>{deltaText}</span>
      )}
    </div>
  );
}

function GroupRow({
  group,
  active,
  onClick,
  reason,
  variant = "normal",
}: {
  group: GroupInfo;
  active: boolean;
  onClick: () => void;
  reason?: string;
  variant?: "normal" | "recommended";
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full px-3 py-2 text-left rounded-md transition-colors border border-transparent",
        active ? "ring-2 ring-indigo-300" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center gap-2">
        {variant === "recommended" && (
          <AlertTriangle className="h-4 w-4 text-red-500" />
        )}
        <span
          className="h-2 w-2 rounded-full"
          style={{ backgroundColor: group.color }}
        />
        <span className="font-medium">{group.name}</span>
      </div>
      {reason && (
        <div className="text-[13px] text-muted-foreground mt-1">
          推薦理由: {reason}
        </div>
      )}
      <div className="mt-2 grid grid-cols-3 gap-8 justify-items-center text-center w-fit mx-auto">
        <Metric
          label="発話"
          value={`${group.metrics.speechCount}回`}
          delta={group.metrics.speechDelta}
        />
        <Metric
          label="感情"
          value={group.metrics.sentimentAvg.toFixed(2)}
          delta={group.metrics.sentimentDelta}
        />
        <Metric
          label="Miro"
          value={`${group.metrics.miroOpsCount}件`}
          delta={group.metrics.miroOpsDelta}
        />
      </div>
    </button>
  );
}

function LoadingList({ count }: { count: number }) {
  return (
    <ul className="space-y-2 px-3">
      {Array.from({ length: count }).map((_, idx) => (
        <li key={idx}>
          <Skeleton className="h-24 w-full rounded-md" />
        </li>
      ))}
    </ul>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <div className="text-sm text-muted-foreground px-3 py-6">{children}</div>
  );
}

export default function RecommendGroupList({
  recommendations,
  selectedId,
  onSelect,
  onTimeChange,
  timeRange,
  loading = false,
  error = null,
  highlightCount = 2,
  refreshing = false,
}: Props) {
  const highlight = Math.max(0, highlightCount);
  const recommended = recommendations.slice(0, highlight);
  const others = recommendations.slice(highlight);
  const showLoading = loading || refreshing;

  return (
    <Card className="h-full">
      <GroupListHeader timeLabel={timeRange} onTimeChange={onTimeChange} />

      <div className="-mt-6">
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 mb-2">
          <Star className="h-4 w-4" />
          <span className="text-sm font-medium">優先観察推薦グループ</span>
        </div>

        {error ? (
          <div className="mx-3 mb-3 flex items-center gap-2 rounded-md border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
            <AlertCircle className="h-4 w-4" />
            <span>{error}</span>
          </div>
        ) : showLoading ? (
          <LoadingList count={highlight || 2} />
        ) : recommended.length === 0 ? (
          <EmptyMessage>該当するグループがありません。</EmptyMessage>
        ) : (
          <ul className="space-y-2 px-3">
            {recommended.map((item) => (
              <li key={item.rawGroupId || item.group.id}>
                <GroupRow
                  group={item.group}
                  active={selectedId === item.group.id}
                  onClick={() => onSelect(item.group.id)}
                  variant="recommended"
                  reason={item.reasons.join("、") || undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>

      <div className="-mt-2">
        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 mb-2">
          その他のグループ
        </div>
        {showLoading ? (
          <LoadingList count={Math.max(others.length, 3)} />
        ) : others.length === 0 ? (
          <EmptyMessage>その他のグループはありません。</EmptyMessage>
        ) : (
          <ul className="space-y-1 px-3">
            {others.map((item) => (
              <li key={item.rawGroupId || item.group.id}>
                <GroupRow
                  group={item.group}
                  active={selectedId === item.group.id}
                  onClick={() => onSelect(item.group.id)}
                  reason={item.reasons.join("、") || undefined}
                />
              </li>
            ))}
          </ul>
        )}
      </div>
    </Card>
  );
}
