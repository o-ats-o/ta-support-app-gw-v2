"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type {
  ConversationLog,
  GroupInfo,
  RecommendationGroupItem,
} from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import {
  fetchGroupConversationLogsByRange,
  fetchGroupRecommendationsByRange,
} from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";
import { useTimeseriesQuery } from "@/features/dashboard/useTimeseriesQuery";

const DEFAULT_HIGHLIGHT_COUNT = 2;
const STORAGE_KEY = "recommend:selectedGroup";

export default function RecommendClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [recommendations, setRecommendations] = useState<
    RecommendationGroupItem[]
  >([]);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [timeRange, setTimeRange] = useState<string>(DEFAULT_TIME_LABEL);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
  const cacheRef = useRef<Map<string, RecommendationGroupItem[]>>(new Map());
  const logsCacheRef = useRef<Map<string, ConversationLog[]>>(new Map());
  const activeLogsKeyRef = useRef<string | null>(null);

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

  const getCacheKey = useCallback(
    (date: string, range: string) => `${date}::${range}`,
    []
  );

  const getLogsCacheKey = useCallback(
    (date: string, range: string, group?: GroupInfo | null) => {
      const identifier =
        group?.rawId?.trim() || group?.name?.trim() || group?.id;
      return `${date}::${range}::${identifier ?? "unknown"}`;
    },
    []
  );

  const applyRecommendations = useCallback(
    (items: RecommendationGroupItem[]): GroupInfo[] => {
      setRecommendations(items);
      if (items.length === 0) {
        setGroups([]);
        setSelectedId("");
        return [];
      }

      const nextGroups = items.map((item) => item.group);
      setGroups(nextGroups);

      setSelectedId((prev) =>
        nextGroups.some((g) => g.id === prev) ? prev : (nextGroups[0]?.id ?? "")
      );
      return nextGroups;
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

  const fetchRecommendations = useCallback(
    async ({
      date,
      range,
      force = false,
    }: {
      date: string;
      range: string;
      force?: boolean;
    }) => {
      if (!date || !range) return;
      const key = getCacheKey(date, range);

      if (!force) {
        const cached = cacheRef.current.get(key);
        if (cached) {
          console.log("[recommend-ver] cache hit", {
            key,
            cached: cached.length,
          });
          setError(null);
          setLoading(false);
          applyRecommendations(cached);
          return;
        }
      }

      setLoading(true);
      setError(null);
      console.log("[recommend-ver] fetching recommendations", {
        date,
        range,
        key,
      });
      try {
        const items = await fetchGroupRecommendationsByRange({
          date,
          timeRange: range,
        });
        cacheRef.current.set(key, items);
        applyRecommendations(items);
        console.log("[recommend-ver] fetch success", { count: items.length });
      } catch (err) {
        console.error("[recommend-ver] fetch failed", err);
        const fallback = cacheRef.current.get(key);
        if (fallback) {
          applyRecommendations(fallback);
        }
        const message =
          err instanceof Error ? err.message : "データの取得に失敗しました";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [applyRecommendations, getCacheKey]
  );

  useEffect(() => {
    void fetchRecommendations({ date: selectedDate, range: timeRange });
  }, [fetchRecommendations, selectedDate, timeRange]);

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

  const handleDateChange = useCallback(
    (date: string) => {
      console.log("[recommend-ver] date changed", {
        from: selectedDate,
        to: date,
      });
      setSelectedDate(date);
    },
    [selectedDate]
  );

  const handleSelect = useCallback((id: string) => {
    setSelectedId(id);
  }, []);

  const handleDetailTabChange = useCallback((tab: string) => {
    setIsMiroTabActive(tab === "miro");
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader date={selectedDate} onDateChange={handleDateChange} />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <RecommendGroupList
            recommendations={recommendations}
            selectedId={selectedId}
            onSelect={handleSelect}
            onTimeChange={handleTimeChange}
            timeRange={timeRange}
            loading={loading}
            error={error}
            highlightCount={DEFAULT_HIGHLIGHT_COUNT}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          <GroupDetail
            data={data}
            selected={selected}
            loading={loading}
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
