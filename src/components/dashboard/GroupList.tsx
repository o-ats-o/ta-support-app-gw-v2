"use client";

import type { ReactNode } from "react";
import { Card } from "@/components/ui/card";
import GroupListHeader from "@/components/ui/group-list-header";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selectedId: string;
  onSelect: (id: string) => void;
  onTimeChange?: (timeRange: string) => void;
  timeRange?: string;
  loading?: boolean;
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
  g,
  active,
  onClick,
}: {
  g: GroupInfo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full px-3 py-3 text-left rounded-md transition-colors border border-transparent",
        active ? "bg-white ring-2 ring-indigo-300" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          <span className="font-medium">{g.name}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-8 justify-items-center text-center w-fit mx-auto">
        <Metric
          label="発話"
          value={`${g.metrics.speechCount}回`}
          delta={g.metrics.speechDelta}
        />
        <Metric
          label="感情"
          value={g.metrics.sentimentAvg.toFixed(2)}
          delta={g.metrics.sentimentDelta}
        />
        <Metric
          label="Miro"
          value={`${g.metrics.miroOpsCount}件`}
          delta={g.metrics.miroOpsDelta}
        />
      </div>
    </button>
  );
}

function LoadingList({ count }: { count: number }) {
  return (
    <ul className="space-y-1 px-3 -mt-2">
      {Array.from({ length: count }).map((_, idx) => (
        <li key={idx}>
          <Skeleton className="h-20 w-full rounded-md" />
        </li>
      ))}
    </ul>
  );
}

function EmptyMessage({ children }: { children: ReactNode }) {
  return (
    <div className="px-3 -mt-2 py-6 text-sm text-muted-foreground">
      {children}
    </div>
  );
}

export function GroupList({
  data,
  selectedId,
  onSelect,
  onTimeChange,
  timeRange,
  loading = false,
  refreshing = false,
}: Props) {
  const groups = data.groups;
  const skeletonCount = Math.max(groups.length || 0, 5);
  const isEmpty = groups.length === 0;
  const showLoading = loading || refreshing;

  return (
    <Card className="h-full">
      <GroupListHeader timeLabel={timeRange} onTimeChange={onTimeChange} />
      {showLoading ? (
        <LoadingList count={skeletonCount} />
      ) : isEmpty ? (
        <EmptyMessage>該当するグループがありません。</EmptyMessage>
      ) : (
        <ul className="space-y-1 px-3 -mt-2">
          {groups.map((g) => (
            <li key={g.id}>
              <GroupRow
                g={g}
                active={selectedId === g.id}
                onClick={() => onSelect(g.id)}
              />
            </li>
          ))}
        </ul>
      )}
    </Card>
  );
}
