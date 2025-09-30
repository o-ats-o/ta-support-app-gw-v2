"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type { DashboardData, GroupInfo } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { fetchGroupTimeseriesByRange, fetchGroupsByRange } from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";

const DEFAULT_TIME_RANGE = DEFAULT_TIME_LABEL;
const STORAGE_KEY = "dashboard:selectedGroup";

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>(base.groups);
  const [timeseries, setTimeseries] = useState<DashboardData["timeseries"]>(
    () => ({
      speech: [...base.timeseries.speech],
      sentiment: [...base.timeseries.sentiment],
      miroOps: [...base.timeseries.miroOps],
    })
  );
  const [timeseriesLoading, setTimeseriesLoading] = useState(false);
  const [selectedId, setSelectedId] = useState<string>(
    base.groups[0]?.id ?? "A"
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [currentRange, setCurrentRange] = useState<string>(DEFAULT_TIME_RANGE);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, GroupInfo[]>>(new Map());
  const timeseriesCacheRef = useRef<Map<string, DashboardData["timeseries"]>>(
    new Map()
  );
  const activeTimeseriesKeyRef = useRef<string | null>(null);

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

  const applyGroups = useCallback((nextGroups: GroupInfo[]) => {
    setGroups(nextGroups);
    setSelectedId((prev) =>
      nextGroups.some((g) => g.id === prev) ? prev : (nextGroups[0]?.id ?? prev)
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
    () => ({ ...base, groups, timeseries }),
    [base, groups, timeseries]
  );
  const selected =
    data.groups.find((g) => g.id === selectedId) ?? data.groups[0];

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
          {selected && (
            <GroupDetail
              data={data}
              selected={selected}
              timeseriesLoading={timeseriesLoading}
            />
          )}
        </div>
      </main>
    </div>
  );
}
