"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";
import {
  buildTimeseriesIdentifiersKey,
  buildTimeseriesQueryKey,
  useTimeseriesQuery,
} from "@/features/dashboard/useTimeseriesQuery";
import { useRecommendationsQuery } from "@/features/dashboard/useRecommendationsQuery";
import { useConversationLogsQuery } from "@/features/dashboard/useConversationLogsQuery";
import { fetchGroupTimeseriesByRange } from "@/lib/api";

const DEFAULT_HIGHLIGHT_COUNT = 2;
const STORAGE_KEY = "recommend:selectedGroup";

export default function RecommendClient() {
  const base = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [timeRange, setTimeRange] = useState<string>(DEFAULT_TIME_LABEL);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
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
  const recommendationsRefreshing =
    recommendationsFetching && !recommendationsLoading;

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

  const selected = useMemo(() => {
    if (!groups.length) return undefined;
    return groups.find((g) => g.id === selectedId) ?? groups[0];
  }, [groups, selectedId]);

  const {
    data: logsData,
    isPending: logsPending,
    isFetching: logsFetching,
    error: logsError,
    refetch: refetchLogs,
  } = useConversationLogsQuery({
    date: selectedDate,
    range: timeRange,
    group: selected,
    bucketCount: 5,
  });

  useEffect(() => {
    if (!logsError) return;
    console.error("[recommend-ver] logs query failed", logsError);
  }, [logsError]);

  const logs = useMemo(() => logsData ?? [], [logsData]);
  const logsLoading = logsPending || (logsFetching && logs.length === 0);

  const data = useMemo(
    () => ({ ...base, groups, timeseries, logs }),
    [base, groups, timeseries, logs]
  );

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

  const handleTimeChange = useCallback(
    (range: string) => {
      if (!range || range === timeRange) return;
      console.log("[recommend-ver] time changed", {
        from: timeRange,
        to: range,
      });

      const identifiers = buildTimeseriesIdentifiersKey(groups);
      if (identifiers && selectedDate) {
        void queryClient.prefetchQuery({
          queryKey: buildTimeseriesQueryKey(selectedDate, range, identifiers),
          queryFn: () =>
            fetchGroupTimeseriesByRange(
              { date: selectedDate, timeRange: range },
              groups ?? []
            ),
          staleTime: 60 * 1000,
        });
      }

      setTimeRange(range);
    },
    [groups, queryClient, selectedDate, timeRange]
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
    void refetchLogs({ cancelRefetch: false });
  }, [queryClient, refetchLogs, refetchRecommendations]);

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
            refreshing={recommendationsRefreshing}
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
