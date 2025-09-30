"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import { createEmptyTimeseries } from "@/lib/types";
import type {
  DashboardData,
  GroupInfo,
  RecommendationGroupItem,
} from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import {
  fetchGroupRecommendationsByRange,
  fetchGroupTimeseriesByRange,
} from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";

const DEFAULT_HIGHLIGHT_COUNT = 2;
const STORAGE_KEY = "recommend:selectedGroup";

export default function RecommendClient() {
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
  const [recommendations, setRecommendations] = useState<
    RecommendationGroupItem[]
  >([]);
  const [selectedId, setSelectedId] = useState<string>(
    base.groups[0]?.id ?? "A"
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [timeRange, setTimeRange] = useState<string>(DEFAULT_TIME_LABEL);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const cacheRef = useRef<Map<string, RecommendationGroupItem[]>>(new Map());
  const timeseriesCacheRef = useRef<Map<string, DashboardData["timeseries"]>>(
    new Map()
  );
  const activeTimeseriesKeyRef = useRef<string | null>(null);

  const data = useMemo(
    () => ({ ...base, groups, timeseries }),
    [base, groups, timeseries]
  );

  const selected =
    data.groups.find((g) => g.id === selectedId) ??
    data.groups[0] ??
    base.groups[0];

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

  const applyRecommendations = useCallback(
    (items: RecommendationGroupItem[]): GroupInfo[] => {
      setRecommendations(items);
      if (items.length > 0) {
        const nextGroups = items.map((item) => item.group);
        setGroups(nextGroups);
        setSelectedId((prev) =>
          nextGroups.some((g) => g.id === prev)
            ? prev
            : (nextGroups[0]?.id ?? prev)
        );
        return nextGroups;
      }

      setGroups(base.groups);
      setSelectedId((prev) =>
        base.groups.some((g) => g.id === prev)
          ? prev
          : (base.groups[0]?.id ?? prev)
      );
      return base.groups;
    },
    [base]
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
