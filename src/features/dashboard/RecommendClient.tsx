"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type { ConversationLog, GroupInfo } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { fetchGroupConversationLogsByRange } from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";
import { useTimeseriesQuery } from "@/features/dashboard/useTimeseriesQuery";
import { useRecommendationsQuery } from "@/features/dashboard/useRecommendationsQuery";

const DEFAULT_HIGHLIGHT_COUNT = 2;
const STORAGE_KEY = "recommend:selectedGroup";

export default function RecommendClient() {
  const base = useMemo(() => dashboardMock, []);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [timeRange, setTimeRange] = useState<string>(DEFAULT_TIME_LABEL);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
  const logsCacheRef = useRef<Map<string, ConversationLog[]>>(new Map());
  const activeLogsKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: recommendationsData,
    isPending: recommendationsPending,
    isFetching: recommendationsFetching,
    error: recommendationsError,
    refetch: refetchRecommendations,
  } = useRecommendationsQuery({ date: selectedDate, range: timeRange });

  useEffect(() => {
    if (!recommendationsError) return;
    console.error(
      "[recommend-ver] recommendations query failed",
      recommendationsError
    );
  }, [recommendationsError]);

  const recommendations = useMemo(
    () => recommendationsData ?? [],
    [recommendationsData]
  );
  const recommendationErrorMessage = useMemo(() => {
    if (!recommendationsError) return null;
    if (recommendationsError instanceof Error) {
      return recommendationsError.message;
    }
    return "推薦グループの取得に失敗しました";
  }, [recommendationsError]);
  const recommendationsLoading =
    recommendationsPending && recommendations.length === 0;

  const groups = useMemo(
    () => recommendations.map((item) => item.group),
    [recommendations]
  );

  const {
    data: timeseriesData,
    isPending: timeseriesPending,
    isFetching: timeseriesFetching,
    error: timeseriesError,
  } = useTimeseriesQuery({
    date: selectedDate,
    range: timeRange,
    groups,
  });

  useEffect(() => {
    if (!timeseriesError) return;
    console.error("[recommend-ver] timeseries query failed", timeseriesError);
  }, [timeseriesError]);

  const timeseries = timeseriesData ?? createEmptyTimeseries();
  const timeseriesLoading = timeseriesPending || timeseriesFetching;

  const data = useMemo(
    () => ({ ...base, groups, timeseries, logs }),
    [base, groups, timeseries, logs]
  );

  const selected =
    data.groups.find((g) => g.id === selectedId) ?? data.groups[0];

  const {
    summary: miroSummary,
    loading: miroLoading,
    error: miroError,
  } = useMiroSummaryManager({
    active: isMiroTabActive,
    groups,
    selectedGroup: selected,
    date: selectedDate,
    timeRange,
    concurrency: 2,
  });

  useEffect(() => {
    if (!groups.length) {
      setSelectedId("");
      return;
    }
    setSelectedId((prev) =>
      prev && groups.some((g) => g.id === prev) ? prev : groups[0].id
    );
  }, [groups]);

  useEffect(() => {
    if (typeof window === "undefined") return;
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (!stored) return;
    setSelectedId((prev) => (prev === stored ? prev : stored));
  }, []);

  useEffect(() => {
    if (!selectedId) return;
    if (typeof window === "undefined") return;
    window.localStorage.setItem(STORAGE_KEY, selectedId);
  }, [selectedId]);

  const getLogsCacheKey = useCallback(
    (date: string, range: string, group?: GroupInfo | null) => {
      const identifier =
        group?.rawId?.trim() || group?.name?.trim() || group?.id;
      return `${date}::${range}::${identifier ?? "unknown"}`;
    },
    []
  );

  const fetchLogsForSelection = useCallback(
    async ({
      date,
      range,
      group,
      force = false,
    }: {
      date: string;
      range: string;
      group?: GroupInfo | null;
      force?: boolean;
    }) => {
      if (!group) {
        setLogs([]);
        setLogsLoading(false);
        return;
      }

      const key = getLogsCacheKey(date, range, group);
      if (!force) {
        const cached = logsCacheRef.current.get(key);
        if (cached) {
          setLogs(cached);
          setLogsLoading(false);
          return;
        }
      }

      activeLogsKeyRef.current = key;
      setLogsLoading(true);
      try {
        const result = await fetchGroupConversationLogsByRange(
          { date, timeRange: range },
          group,
          { bucketCount: 5 }
        );
        if (activeLogsKeyRef.current !== key) return;
        logsCacheRef.current.set(key, result);
        setLogs(result);
      } catch (error) {
        console.error("[recommend-ver] fetch logs failed", {
          date,
          range,
          group,
          error,
        });
        if (!force) {
          const fallback = logsCacheRef.current.get(key);
          if (fallback) {
            setLogs(fallback);
          } else if (activeLogsKeyRef.current === key) {
            setLogs([]);
          }
        }
      } finally {
        if (activeLogsKeyRef.current === key) {
          setLogsLoading(false);
        }
      }
    },
    [getLogsCacheKey]
  );

  useEffect(() => {
    if (!selectedDate || !timeRange) return;
    if (!groups || groups.length === 0) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }
    const group = groups.find((g) => g.id === selectedId) ?? groups[0];
    void fetchLogsForSelection({
      date: selectedDate,
      range: timeRange,
      group,
    });
  }, [fetchLogsForSelection, groups, selectedDate, selectedId, timeRange]);

  const handleTimeChange = useCallback(
    (range: string) => {
      if (!range) return;
      console.log("[recommend-ver] time changed", {
        from: timeRange,
        to: range,
      });
      setTimeRange(range);
    },
    [timeRange]
  );

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleDetailTabChange = useCallback((tab: string) => {
    setIsMiroTabActive(tab === "miro");
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchRecommendations({ cancelRefetch: false });
    void queryClient.invalidateQueries({ queryKey: ["timeseries"] });
    const group = groups.find((g) => g.id === selectedId) ?? groups[0];
    if (group) {
      void fetchLogsForSelection({
        date: selectedDate,
        range: timeRange,
        group,
        force: true,
      });
    } else {
      setLogs([]);
    }
  }, [
    fetchLogsForSelection,
    groups,
    queryClient,
    refetchRecommendations,
    selectedDate,
    selectedId,
    timeRange,
  ]);

  const showListLoading =
    recommendationsLoading ||
    (recommendationsFetching && recommendations.length === 0);

  return (
    <div className="min-h-screen">
      <AppHeader
        date={selectedDate}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
      />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <RecommendGroupList
            recommendations={recommendations}
            selectedId={selectedId}
            onSelect={handleSelect}
            onTimeChange={handleTimeChange}
            timeRange={timeRange}
            loading={showListLoading}
            error={recommendationErrorMessage}
            highlightCount={DEFAULT_HIGHLIGHT_COUNT}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail
            data={data}
            selected={selected}
            loading={recommendationsLoading}
            timeseriesLoading={timeseriesLoading}
            logsLoading={logsLoading}
            date={selectedDate}
            timeRange={timeRange}
            miroSummary={miroSummary}
            miroLoading={miroLoading}
            miroError={miroError}
            onTabChange={handleDetailTabChange}
          />
        </div>
      </main>
    </div>
  );
}
