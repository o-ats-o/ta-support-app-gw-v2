"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type { ConversationLog, DashboardData, GroupInfo } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import {
  fetchGroupConversationLogsByRange,
  fetchGroupTimeseriesByRange,
  fetchGroupsByRange,
} from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";
import { useMiroSummaryManager } from "@/features/dashboard/useMiroSummaryManager";

const DEFAULT_TIME_RANGE = DEFAULT_TIME_LABEL;
const STORAGE_KEY = "dashboard:selectedGroup";

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>([]);
  const [timeseries, setTimeseries] = useState<DashboardData["timeseries"]>(
    () => createEmptyTimeseries()
  );
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [logs, setLogs] = useState<ConversationLog[]>([]);
  const [logsLoading, setLogsLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [currentRange, setCurrentRange] = useState<string>(DEFAULT_TIME_RANGE);
  const [loading, setLoading] = useState(true);
  const [isMiroTabActive, setIsMiroTabActive] = useState(false);
  const cacheRef = useRef<Map<string, GroupInfo[]>>(new Map());
  const timeseriesCacheRef = useRef<Map<string, DashboardData["timeseries"]>>(
    new Map()
  );
  const activeTimeseriesKeyRef = useRef<string | null>(null);
  const logsCacheRef = useRef<Map<string, ConversationLog[]>>(new Map());
  const activeLogsKeyRef = useRef<string | null>(null);

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
  const applyGroups = useCallback((nextGroups: GroupInfo[]) => {
    setGroups(nextGroups);
    setSelectedId((prev) =>
      nextGroups.some((g) => g.id === prev) ? prev : (nextGroups[0]?.id ?? "")
    );
  }, []);

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
        console.error("[list-ver] fetch timeseries failed", {
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

  const fetchGroupsForRange = useCallback(
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
          console.log("[list-ver] cache hit", {
            date,
            range,
            key,
            count: cached.length,
          });
          setLoading(false);
          applyGroups(cached);
          void ensureTimeseriesForRange({
            date,
            range,
            groups: cached,
            force,
          });
          return;
        }
      }
      setLoading(true);
      console.log("[list-ver] fetching /api/sessions", {
        date,
        range,
        key,
        force,
      });
      try {
        const nextGroups = await fetchGroupsByRange({
          date,
          timeRange: range,
        });
        console.log("[list-ver] fetch success", { count: nextGroups.length });
        cacheRef.current.set(key, nextGroups);
        applyGroups(nextGroups);
        void ensureTimeseriesForRange({
          date,
          range,
          groups: nextGroups,
          force,
        });
      } catch (err) {
        console.error("[list-ver] fetch failed", err);
        const fallback = cacheRef.current.get(key);
        if (fallback) {
          void ensureTimeseriesForRange({
            date,
            range,
            groups: fallback,
          });
        }
      } finally {
        setLoading(false);
      }
    },
    [applyGroups, ensureTimeseriesForRange, getCacheKey]
  );

  const handleTimeChange = useCallback(
    (range: string) => {
      if (!range) return;
      console.log("[list-ver] time changed", {
        from: currentRange,
        to: range,
        date: selectedDate,
      });
      setCurrentRange(range);
      void fetchGroupsForRange({ date: selectedDate, range });
    },
    [currentRange, fetchGroupsForRange, selectedDate]
  );

  const handleDateChange = useCallback(
    (date: string) => {
      setSelectedDate(date);
      void fetchGroupsForRange({ date, range: currentRange });
    },
    [currentRange, fetchGroupsForRange]
  );

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

  return (
    <div className="min-h-screen">
      <AppHeader date={selectedDate} onDateChange={handleDateChange} />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <GroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTimeChange={handleTimeChange}
            timeRange={currentRange}
            loading={loading}
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
