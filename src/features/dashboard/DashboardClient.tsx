"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GroupList } from "@/components/dashboard/GroupList";
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
import { useGroupsQuery } from "@/features/dashboard/useGroupsQuery";
import { useConversationLogsQuery } from "@/features/dashboard/useConversationLogsQuery";
import { fetchGroupTimeseriesByRange } from "@/lib/api";
import { usePersistentDate } from "@/features/dashboard/usePersistentDate";

const DEFAULT_TIME_RANGE = DEFAULT_TIME_LABEL;
const STORAGE_KEY = "dashboard:selectedGroup";
const DATE_STORAGE_KEY = "dashboard:selectedDate";

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = usePersistentDate(DATE_STORAGE_KEY);
  const [currentRange, setCurrentRange] = useState<string>(DEFAULT_TIME_RANGE);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
  const queryClient = useQueryClient();

  const {
    data: groupsData,
    isPending: groupsPending,
    isFetching: groupsFetching,
    error: groupsError,
    refetch: refetchGroups,
  } = useGroupsQuery({ date: selectedDate, range: currentRange });

  useEffect(() => {
    if (!groupsError) return;
    console.error("[list-ver] groups query failed", groupsError);
  }, [groupsError]);

  const groups = useMemo(() => groupsData ?? [], [groupsData]);
  const groupsLoading = groupsPending && groups.length === 0;
  const groupsRefreshing = groupsFetching && !groupsLoading;

  const {
    data: timeseriesData,
    isPending: timeseriesPending,
    isFetching: timeseriesFetching,
    error: timeseriesError,
  } = useTimeseriesQuery({
    date: selectedDate,
    range: currentRange,
    groups,
  });

  useEffect(() => {
    if (!timeseriesError) return;
    console.error("[list-ver] timeseries query failed", timeseriesError);
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
    range: currentRange,
    group: selected,
    bucketCount: 5,
  });

  useEffect(() => {
    if (!logsError) return;
    console.error("[list-ver] logs query failed", logsError);
  }, [logsError]);

  const logs = useMemo(() => logsData ?? [], [logsData]);
  const logsLoading = logsPending || (logsFetching && logs.length === 0);
  const logsRefreshing = !logsPending && logsFetching;

  const data = useMemo(
    () => ({ ...base, scenario: undefined, groups, timeseries, logs }),
    [base, groups, timeseries, logs]
  );

  useEffect(() => {
    if (!groups.length) {
      setSelectedId("");
      return;
    }
    setSelectedId((prev) =>
      prev && groups.some((g) => g.id === prev) ? prev : groups[0].id
    );
  }, [groups]);

  const {
    summary: miroSummary,
    loading: miroLoading,
    error: miroError,
  } = useMiroSummaryManager({
    active: isMiroTabActive,
    groups,
    selectedGroup: selected,
    date: selectedDate,
    timeRange: currentRange,
    concurrency: 2,
  });

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
      if (!range || range === currentRange) return;
      console.log("[list-ver] time changed", {
        from: currentRange,
        to: range,
        date: selectedDate,
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

      setCurrentRange(range);
    },
    [currentRange, groups, queryClient, selectedDate]
  );

  const handleDateChange = useCallback(
    (date: string) => {
      if (!date) return;
      setSelectedDate(date);
    },
    [setSelectedDate]
  );

  const handleDetailTabChange = useCallback((tab: string) => {
    setIsMiroTabActive(tab === "miro");
  }, []);

  const handleRefresh = useCallback(() => {
    void refetchGroups({ cancelRefetch: false });
    void queryClient.invalidateQueries({ queryKey: ["timeseries"] });
    void refetchLogs({ cancelRefetch: false });
  }, [queryClient, refetchGroups, refetchLogs]);

  return (
    <div className="min-h-screen">
      <AppHeader
        date={selectedDate}
        onDateChange={handleDateChange}
        onRefresh={handleRefresh}
      />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <GroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTimeChange={handleTimeChange}
            timeRange={currentRange}
            loading={groupsLoading}
            refreshing={groupsRefreshing}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail
            data={data}
            selected={selected}
            loading={groupsLoading}
            timeseriesLoading={timeseriesLoading}
            logsLoading={logsLoading}
            logsRefreshing={logsRefreshing}
            date={selectedDate}
            timeRange={currentRange}
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
