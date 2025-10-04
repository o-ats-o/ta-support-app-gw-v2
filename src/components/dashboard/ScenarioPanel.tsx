"use client";

import { useCallback, useMemo } from "react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";
import { useScenarioQuery } from "@/features/dashboard/useScenarioQuery";
import type { DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
  logsLoading?: boolean;
  date?: string;
  timeRange?: string;
  windowMinutes?: number;
};

export default function ScenarioPanel({
  data,
  selected,
  logsLoading,
  date,
  timeRange,
  windowMinutes = 10,
}: Props) {
  const logs = useMemo(() => data.logs ?? [], [data.logs]);
  const {
    data: scenario,
    error,
    isPending,
    isFetching,
    refetch,
    hasTranscript,
  } = useScenarioQuery({
    group: selected,
    logs,
    enabled: !logsLoading,
    date,
    timeRange,
    windowMinutes,
  });

  const loading = isPending || (isFetching && !scenario);

  const handleRegenerate = useCallback(() => {
    if (!hasTranscript) return;
    void refetch();
  }, [hasTranscript, refetch]);

  const buttonDisabled = !hasTranscript || Boolean(logsLoading) || isPending;
  const buttonLabel = isPending ? "生成中…" : "再生成";

  let content: React.ReactNode;
  if (logsLoading) {
    content = (
      <div className="text-sm text-muted-foreground">
        会話履歴を読み込んでいます…
      </div>
    );
  } else if (!hasTranscript) {
    content = (
      <div className="text-sm text-muted-foreground">
        対象グループの会話履歴がまだありません
      </div>
    );
  } else if (loading) {
    content = (
      <div className="space-y-3">
        <Skeleton className="h-4 w-3/4" />
        <Skeleton className="h-4 w-5/6" />
        <Skeleton className="h-4 w-2/3" />
      </div>
    );
  } else if (error) {
    content = (
      <div className="text-sm text-red-600">
        シナリオの生成に失敗しました。
        {error instanceof Error && error.message ? (
          <span className="ml-1 text-red-500/80">{error.message}</span>
        ) : (
          <span className="ml-1">再度お試しください。</span>
        )}
      </div>
    );
  } else if (scenario) {
    content = (
      <ul className="space-y-4">
        {scenario.bullets.map((b, i) => (
          <li key={i} className="text-[15px] leading-7">
            ・{b.text}
          </li>
        ))}
      </ul>
    );
  } else {
    content = (
      <div className="text-sm text-muted-foreground">シナリオがありません</div>
    );
  }

  return (
    <Card className="flex h-full min-h-0 flex-col p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-base">声かけシナリオ</div>
        <Button
          type="button"
          variant="outline"
          className="bg-white text-emerald-700 border-emerald-600 hover:bg-emerald-50"
          onClick={handleRegenerate}
          disabled={buttonDisabled}
        >
          {buttonLabel}
        </Button>
      </div>
      <div className="mt-4 flex-1 min-h-[300px] overflow-y-auto">
        {content}
      </div>
    </Card>
  );
}
