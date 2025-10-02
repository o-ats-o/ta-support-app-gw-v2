"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type { ConversationLog, GroupInfo } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { fetchGroupConversationLogsByRange } from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";
import { useTimeseriesQuery } from "@/features/dashboard/useTimeseriesQuery";
import { useGroupsQuery } from "@/features/dashboard/useGroupsQuery";

const DEFAULT_TIME_RANGE = DEFAULT_TIME_LABEL;
const STORAGE_KEY = "dashboard:selectedGroup";

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [currentRange, setCurrentRange] = useState<string>(DEFAULT_TIME_RANGE);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
  const logsCacheRef = useRef<Map<string, ConversationLog[]>>(new Map());
  const activeLogsKeyRef = useRef<string | null>(null);
  const queryClient = useQueryClient();

  const {
    data: groupsData,
    isPending: groupsPending,
    error: groupsError,
    refetch: refetchGroups,
  } = useGroupsQuery({ date: selectedDate, range: currentRange });

  useEffect(() => {
    if (!groupsError) return;
    console.error("[list-ver] groups query failed", groupsError);
  }, [groupsError]);

  const groups = useMemo(() => groupsData ?? [], [groupsData]);
  const groupsLoading = groupsPending && groups.length === 0;

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

  const getLogsCacheKey = useCallback(
    (date: string, range: string, group?: GroupInfo | null) => {
      const identifier =
        group?.rawId?.trim() || group?.name?.trim() || group?.id;
      return `${date}::${range}::${identifier ?? "unknown"}`;
    },
    []
  );
  const data = useMemo(
    () => ({ ...base, groups, timeseries, logs }),
    [base, groups, timeseries, logs]
  );
  const selected =
    data.groups.find((g) => g.id === selectedId) ?? data.groups[0];

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
        console.error("[list-ver] fetch logs failed", {
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
      if (!range) return;
      console.log("[list-ver] time changed", {
        from: currentRange,
        to: range,
        date: selectedDate,
      });
      setCurrentRange(range);
    },
    [currentRange, selectedDate]
  );

  const handleDateChange = useCallback((date: string) => {
    setSelectedDate(date);
  }, []);

  const handleDetailTabChange = useCallback((tab: string) => {
    setIsMiroTabActive(tab === "miro");
  }, []);

  useEffect(() => {
    if (!selectedDate || !currentRange) return;
    if (!groups || groups.length === 0) {
      setLogs([]);
      setLogsLoading(false);
      return;
    }
    const group = groups.find((g) => g.id === selectedId) ?? groups[0];
    void fetchLogsForSelection({
      date: selectedDate,
      range: currentRange,
      group,
    });
  }, [currentRange, fetchLogsForSelection, groups, selectedDate, selectedId]);

  const handleRefresh = useCallback(() => {
    void refetchGroups({ cancelRefetch: false });
    void queryClient.invalidateQueries({ queryKey: ["timeseries"] });
    const group = groups.find((g) => g.id === selectedId) ?? groups[0];
    if (group) {
      void fetchLogsForSelection({
        date: selectedDate,
        range: currentRange,
        group,
        force: true,
      });
    } else {
      setLogs([]);
    }
  }, [
    currentRange,
    fetchLogsForSelection,
    groups,
    queryClient,
    refetchGroups,
    selectedDate,
    selectedId,
  ]);

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
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail
            data={data}
            selected={selected}
            loading={groupsLoading}
            timeseriesLoading={timeseriesLoading}
            logsLoading={logsLoading}
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
