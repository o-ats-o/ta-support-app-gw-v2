"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import RecommendGroupList from "@/components/dashboard/RecommendGroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import type { GroupInfo, RecommendationGroupItem } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { fetchGroupRecommendationsByRange } from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";

const DEFAULT_HIGHLIGHT_COUNT = 2;

export default function RecommendClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>(base.groups);
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

  const data = useMemo(() => ({ ...base, groups }), [base, groups]);

  const selected =
    data.groups.find((g) => g.id === selectedId) ??
    data.groups[0] ??
    base.groups[0];

  const getCacheKey = useCallback(
    (date: string, range: string) => `${date}::${range}`,
    []
  );

  const applyRecommendations = useCallback(
    (items: RecommendationGroupItem[]) => {
      setRecommendations(items);
      const nextGroups = items.map((item) => item.group);
      if (nextGroups.length > 0) {
        setGroups(nextGroups);
        setSelectedId((prev) =>
          nextGroups.some((g) => g.id === prev)
            ? prev
            : (nextGroups[0]?.id ?? prev)
        );
      } else {
        setGroups(base.groups);
        setSelectedId((prev) =>
          base.groups.some((g) => g.id === prev)
            ? prev
            : (base.groups[0]?.id ?? prev)
        );
      }
    },
    [base]
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
          {selected && <GroupDetail data={data} selected={selected} />}
        </div>
      </main>
    </div>
  );
}
