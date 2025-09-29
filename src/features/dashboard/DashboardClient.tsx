"use client";

import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import type { GroupInfo } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";
import { fetchGroupsByRange } from "@/lib/api";
import { DEFAULT_TIME_LABEL } from "@/components/ui/group-list-header";

const DEFAULT_TIME_RANGE = DEFAULT_TIME_LABEL;
const STORAGE_KEY = "dashboard:selectedGroup";

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>(base.groups);
  const [selectedId, setSelectedId] = useState<string>(
    base.groups[0]?.id ?? "A"
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );
  const [currentRange, setCurrentRange] = useState<string>(DEFAULT_TIME_RANGE);
  const [loading, setLoading] = useState(false);
  const cacheRef = useRef<Map<string, GroupInfo[]>>(new Map());

  const getCacheKey = useCallback(
    (date: string, range: string) => `${date}::${range}`,
    []
  );

  const applyGroups = useCallback((nextGroups: GroupInfo[]) => {
    setGroups(nextGroups);
    setSelectedId((prev) =>
      nextGroups.some((g) => g.id === prev) ? prev : (nextGroups[0]?.id ?? prev)
    );
  }, []);

  const data = useMemo(() => ({ ...base, groups }), [base, groups]);
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
      } catch (err) {
        console.error("[list-ver] fetch failed", err);
      } finally {
        setLoading(false);
      }
    },
    [applyGroups, getCacheKey]
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
          {selected && <GroupDetail data={data} selected={selected} />}
        </div>
      </main>
    </div>
  );
}
