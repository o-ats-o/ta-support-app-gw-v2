"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type {
  ConversationLog,
  DashboardData,
  GroupInfo,
  RecommendationGroupItem,
} from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import {
  fetchGroupConversationLogsByRange,
  fetchGroupRecommendationsByRange,
  fetchGroupTimeseriesByRange,
} from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";

const DEFAULT_HIGHLIGHT_COUNT = 2;
const STORAGE_KEY = "recommend:selectedGroup";

export default function RecommendClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [timeseries, setTimeseries] = useState<DashboardData["timeseries"]>(
    () => createEmptyTimeseries()
  );
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
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
  const timeseriesCacheRef = useRef<Map<string, DashboardData["timeseries"]>>(
    new Map()
  );
  const activeTimeseriesKeyRef = useRef<string | null>(null);
  const logsCacheRef = useRef<Map<string, ConversationLog[]>>(new Map());
  const activeLogsKeyRef = useRef<string | null>(null);

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

  const getTimeseriesCacheKey = useCallback(
    (date: string, range: string, groupList: readonly GroupInfo[]) => {
      const baseKey = `${date}::${range}`;
      if (!groupList || groupList.length === 0) {
        return `${baseKey}::empty`;
      }
      const ids = groupList
        .map((g) => g.rawId ?? g.name ?? `Group ${g.id}`)
        .map((id) => id.trim())
        .filter((id): id is string => Boolean(id) && id.length > 0)
        .sort((a, b) => a.localeCompare(b));
      return `${baseKey}::${ids.join("|")}`;
    },
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

  const ensureTimeseriesForRange = useCallback(
    async ({
      date,
      range,
      groups: groupList,
      force = false,
    }: {
      date: string;
      range: string;
      groups: readonly GroupInfo[];
      force?: boolean;
    }) => {
      if (!groupList || groupList.length === 0) {
        setTimeseries(createEmptyTimeseries());
        setTimeseriesLoading(false);
        return;
      }

      const key = getTimeseriesCacheKey(date, range, groupList);
      if (!force) {
        const cached = timeseriesCacheRef.current.get(key);
        if (cached) {
          setTimeseries(cached);
          setTimeseriesLoading(false);
          return;
        }
      }

      activeTimeseriesKeyRef.current = key;
      setTimeseriesLoading(true);
      try {
        const ts = await fetchGroupTimeseriesByRange(
          { date, timeRange: range },
          groupList
        );
        if (activeTimeseriesKeyRef.current !== key) return;
        timeseriesCacheRef.current.set(key, ts);
        setTimeseries(ts);
      } catch (error) {
        console.error("[recommend-ver] fetch timeseries failed", {
          date,
          range,
          error,
        });
        if (!force) {
          const fallback = timeseriesCacheRef.current.get(key);
          if (fallback) {
            setTimeseries(fallback);
          }
        }
      } finally {
        if (activeTimeseriesKeyRef.current === key) {
          setTimeseriesLoading(false);
        }
      }
    },
    [getTimeseriesCacheKey]
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
          const nextGroups = applyRecommendations(cached);
          void ensureTimeseriesForRange({
            date,
            range,
            groups: nextGroups,
            force,
          });
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
        const nextGroups = applyRecommendations(items);
        void ensureTimeseriesForRange({
          date,
          range,
          groups: nextGroups,
          force,
        });
        console.log("[recommend-ver] fetch success", { count: items.length });
      } catch (err) {
        console.error("[recommend-ver] fetch failed", err);
        const fallback = cacheRef.current.get(key);
        if (fallback) {
          const nextGroups = applyRecommendations(fallback);
          void ensureTimeseriesForRange({
            date,
            range,
            groups: nextGroups,
          });
        }
        const message =
          err instanceof Error ? err.message : "データの取得に失敗しました";
        setError(message);
      } finally {
        setLoading(false);
      }
    },
    [applyRecommendations, ensureTimeseriesForRange, getCacheKey]
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
