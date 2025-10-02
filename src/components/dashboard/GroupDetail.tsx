"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import type { DashboardData, GroupInfo, MiroDiffSummary } from "@/lib/types";
import TrendChartPanel from "./TrendChartPanel";
import MiroWorkDetail from "./MiroWorkDetail";
import ConversationLogs from "./ConversationLogs";
import ScenarioPanel from "./ScenarioPanel";

const STORAGE_KEY_BASE = "groupDetail:activeTab";
const TAB_ORDER = ["trend", "logs", "scenario", "miro"] as const;
type TabValue = (typeof TAB_ORDER)[number];

type Props = {
  data: DashboardData;
  selected?: GroupInfo | null;
  loading?: boolean;
  timeseriesLoading?: boolean;
  logsLoading?: boolean;
  date?: string;
  timeRange?: string;
  miroSummary?: MiroDiffSummary | null;
  miroLoading?: boolean;
  miroError?: string | null;
  onTabChange?: (tab: TabValue) => void;
};

export function GroupDetail({
  data,
  selected,
  loading = false,
  timeseriesLoading,
  logsLoading,
  date,
  timeRange,
  miroSummary,
  miroLoading,
  miroError,
  onTabChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("trend");

  const storageKey = useMemo(() => {
    if (typeof window === "undefined") {
      return STORAGE_KEY_BASE;
    }
    const path = window.location?.pathname ?? "";
    return `${STORAGE_KEY_BASE}:${path}`;
  }, []);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(storageKey);
    if (stored && (TAB_ORDER as readonly string[]).includes(stored)) {
      setActiveTab(stored as TabValue);
    }
  }, [storageKey]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    window.localStorage.setItem(storageKey, activeTab);
  }, [activeTab, storageKey]);

  const handleTabChange = useCallback((value: string) => {
    if ((TAB_ORDER as readonly string[]).includes(value)) {
      setActiveTab(value as TabValue);
    }
  }, []);

  useEffect(() => {
    if (!onTabChange) return;
    onTabChange(activeTab);
  }, [activeTab, onTabChange]);

  const hasSelection = Boolean(selected);
  const statusMessage = loading
    ? "データを読み込んでいます…"
    : "グループを選択してください";

  const renderPlaceholder = (height: number) => (
    <div className="relative rounded-md" style={{ height: `${height}px` }}>
      <Skeleton className="h-full w-full" />
      <div className="absolute inset-0 flex items-center justify-center text-sm text-muted-foreground">
        {statusMessage}
      </div>
    </div>
  );

  return (
    <Card className="p-3 h-full">
      <div className="flex items-center gap-2">
        {hasSelection ? (
          <span className="font-semibold text-lg underline underline-offset-4 decoration-2">
            {selected?.name}
          </span>
        ) : (
          <Skeleton className="h-6 w-36" />
        )}
      </div>

      <Tabs value={activeTab} onValueChange={handleTabChange} className="-mt-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trend" disabled={!hasSelection}>
            時間推移グラフ
          </TabsTrigger>
          <TabsTrigger value="logs" disabled={!hasSelection}>
            会話履歴
          </TabsTrigger>
          <TabsTrigger value="scenario" disabled={!hasSelection}>
            声かけシナリオ
          </TabsTrigger>
          <TabsTrigger value="miro" disabled={!hasSelection}>
            Miro作業量詳細
          </TabsTrigger>
        </TabsList>
        <TabsContent value="trend" className="pt-4">
          {hasSelection && selected ? (
            <TrendChartPanel
              data={data}
              groups={data.groups}
              selected={selected}
              timeseriesLoading={timeseriesLoading}
              defaultSeries="speech"
            />
          ) : (
            renderPlaceholder(360)
          )}
        </TabsContent>
        <TabsContent value="miro" className="pt-4">
          {hasSelection && selected ? (
            <MiroWorkDetail
              selected={selected}
              date={date}
              timeRange={timeRange}
              summary={miroSummary}
              loading={Boolean(miroLoading)}
              error={miroError}
            />
          ) : (
            renderPlaceholder(480)
          )}
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          {hasSelection && selected ? (
            <ConversationLogs
              data={data}
              selected={selected}
              loading={Boolean(loading) || Boolean(logsLoading)}
            />
          ) : (
            renderPlaceholder(380)
          )}
        </TabsContent>
        <TabsContent value="scenario" className="pt-4">
          {hasSelection && selected ? (
            <ScenarioPanel
              data={data}
              selected={selected}
              logsLoading={Boolean(logsLoading)}
              date={date}
              timeRange={timeRange}
            />
          ) : (
            renderPlaceholder(200)
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
