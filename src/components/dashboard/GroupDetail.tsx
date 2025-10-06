"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import type { DashboardData, GroupInfo, MiroDiffSummary } from "@/lib/types";
import TrendChartPanel from "./TrendChartPanel";
import MiroWorkDetail from "./MiroWorkDetail";
import ConversationLogs from "./ConversationLogs";
import ScenarioPanel from "./ScenarioPanel";

const STORAGE_KEY_BASE = "groupDetail:activeTab";
const TAB_ORDER = ["trend", "logs", "scenario", "miro"] as const;
type TabValue = (typeof TAB_ORDER)[number];
type TrendSeries = "speech" | "sentiment" | "miroOps";

type Props = {
  data: DashboardData;
  selected?: GroupInfo | null;
  loading?: boolean;
  timeseriesLoading?: boolean;
  logsLoading?: boolean;
  logsRefreshing?: boolean;
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
  logsRefreshing,
  date,
  timeRange,
  miroSummary,
  miroLoading,
  miroError,
  onTabChange,
}: Props) {
  const [activeTab, setActiveTab] = useState<TabValue>("trend");
  const [trendSeries, setTrendSeries] = useState<TrendSeries>("speech");

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

  const renderPlaceholder = () => (
    <div className="flex flex-1 items-center justify-center rounded-lg border border-dashed border-muted-foreground/40 bg-muted/20 text-sm text-muted-foreground">
      {statusMessage}
    </div>
  );

  const cardHeightClasses = useMemo(() => {
    if (activeTab === "miro") {
      return "min-h-[calc(100vh-1rem)] lg:min-h-[calc(100vh-1rem)]";
    }
    return "min-h-[calc(100vh-5rem)] lg:min-h-[calc(100vh-5rem)]";
  }, [activeTab]);

  return (
    <Card
      className={cn(
        "flex flex-col overflow-hidden p-3 transition-[min-height] duration-300",
        cardHeightClasses
      )}
    >
      <div className="flex items-center gap-2">
        {hasSelection ? (
          <span className="font-semibold text-lg underline underline-offset-4 decoration-2">
            {selected?.name}
          </span>
        ) : (
          <Skeleton className="h-6 w-36" />
        )}
      </div>

      <Tabs
        value={activeTab}
        onValueChange={handleTabChange}
        className="-mt-1 flex flex-1 flex-col min-h-0"
      >
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
        <TabsContent
          value="trend"
          className="flex flex-1 flex-col pt-4 min-h-0"
        >
          {hasSelection && selected ? (
            <TrendChartPanel
              data={data}
              groups={data.groups}
              selected={selected}
              timeseriesLoading={timeseriesLoading}
              defaultSeries="speech"
              series={trendSeries}
              onSeriesChange={setTrendSeries}
            />
          ) : (
            renderPlaceholder()
          )}
        </TabsContent>
        <TabsContent
          value="miro"
          className="flex flex-1 flex-col pt-4 min-h-0"
        >
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
            renderPlaceholder()
          )}
        </TabsContent>
        <TabsContent
          value="logs"
          className="flex flex-1 flex-col pt-4 min-h-0"
        >
          {hasSelection && selected ? (
            <ConversationLogs
              data={data}
              selected={selected}
              loading={Boolean(loading) || Boolean(logsLoading)}
              refreshing={Boolean(logsRefreshing)}
            />
          ) : (
            renderPlaceholder()
          )}
        </TabsContent>
        <TabsContent
          value="scenario"
          className="flex flex-1 flex-col pt-4 min-h-0"
        >
          {hasSelection && selected ? (
            <ScenarioPanel
              data={data}
              selected={selected}
              logsLoading={Boolean(logsLoading)}
              date={date}
              timeRange={timeRange}
            />
          ) : (
            renderPlaceholder()
          )}
        </TabsContent>
      </Tabs>
    </Card>
  );
}
