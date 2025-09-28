"use client";

import { useCallback, useMemo, useState } from "react";
import { GroupList } from "@/components/dashboard/GroupList";
import { GroupDetail } from "@/components/dashboard/GroupDetail";
import { dashboardMock } from "@/lib/mock";
import type { GroupId, GroupInfo } from "@/lib/types";
import { GROUP_COLORS } from "@/lib/types";
import { AppHeader } from "@/components/ui/app-header";

type ApiGroupItem = {
  group_id: string;
  metrics: { utterances: number; miro: number; sentiment_avg: number };
  prev_metrics: { utterances: number; miro: number; sentiment_avg: number };
  deltas: { utterances: number; miro: number; sentiment_avg: number };
};

const VALID_IDS: readonly GroupId[] = [
  "A",
  "B",
  "C",
  "D",
  "E",
  "F",
  "G",
] as const;

function toGroupId(input: string): GroupId | null {
  // 許容: "A" もしくは "Group A" 形式
  const m = input.match(/([A-G])$/i);
  if (!m) return null;
  const id = m[1].toUpperCase();
  return (VALID_IDS as readonly string[]).includes(id) ? (id as GroupId) : null;
}

function timeRangeToIso(range: string): { start: string; end: string } {
  const m = range.match(/^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/);
  const now = new Date();
  if (!m) {
    const end = now;
    const start = new Date(end.getTime() - 5 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const y = now.getFullYear();
  const mon = now.getMonth();
  const d = now.getDate();
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);
  const start = new Date(y, mon, d, sh, sm, 0, 0);
  const end = new Date(y, mon, d, eh, em, 0, 0);
  return { start: start.toISOString(), end: end.toISOString() };
}

function mapApiItemToGroupInfo(item: ApiGroupItem): GroupInfo | null {
  const gid = toGroupId(item.group_id);
  if (!gid) return null;
  return {
    id: gid,
    name: `Group ${gid}`,
    color: GROUP_COLORS[gid],
    metrics: {
      speechCount: Number(item.metrics?.utterances ?? 0),
      speechDelta: Number(item.deltas?.utterances ?? 0),
      sentimentAvg: Number(item.metrics?.sentiment_avg ?? 0),
      sentimentDelta: Number(item.deltas?.sentiment_avg ?? 0),
      miroOpsCount: Number(item.metrics?.miro ?? 0),
      miroOpsDelta: Number(item.deltas?.miro ?? 0),
    },
  };
}

async function fetchGroups(range: string): Promise<GroupInfo[]> {
  const { start, end } = timeRangeToIso(range);
  const url = `/api/sessions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  const json = (await res.json()) as ApiGroupItem[];
  const mapped = json
    .map(mapApiItemToGroupInfo)
    .filter((v): v is GroupInfo => Boolean(v))
    .sort((a, b) => a.id.localeCompare(b.id));
  return mapped;
}

function jstDateTimeRangeToUtcIso(params: {
  date: string;
  timeRange: string;
}): { start: string; end: string } {
  const { date, timeRange } = params;
  const m = timeRange.match(/^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/);
  const [y, mo, da] = date.split("-").map((s) => Number(s));
  if (!m || !y || !mo || !da) {
    const end = new Date();
    const start = new Date(end.getTime() - 5 * 60 * 1000);
    return { start: start.toISOString(), end: end.toISOString() };
  }
  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);
  const toUtcIso = (hour: number, minute: number) => {
    // JST(+09:00) → UTC へ変換
    const utcMs = Date.UTC(y, mo - 1, da, hour - 9, minute, 0, 0);
    return new Date(utcMs).toISOString();
  };
  return { start: toUtcIso(sh, sm), end: toUtcIso(eh, em) };
}

async function fetchGroupsByRange(range: {
  date: string;
  timeRange: string;
}): Promise<GroupInfo[]> {
  const { start, end } = jstDateTimeRangeToUtcIso(range);
  const url = `/api/sessions?start_time=${encodeURIComponent(start)}&end_time=${encodeURIComponent(end)}`;
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) throw new Error(`Failed to fetch sessions: ${res.status}`);
  const json = (await res.json()) as ApiGroupItem[];
  const mapped = json
    .map(mapApiItemToGroupInfo)
    .filter((v): v is GroupInfo => Boolean(v))
    .sort((a, b) => a.id.localeCompare(b.id));
  return mapped;
}

export default function DashboardClient() {
  const base = useMemo(() => dashboardMock, []);
  const [groups, setGroups] = useState<GroupInfo[]>(base.groups);
  const [selectedId, setSelectedId] = useState<string>(
    base.groups[0]?.id ?? "A"
  );
  const [selectedDate, setSelectedDate] = useState<string>(
    new Date().toISOString().slice(0, 10)
  );

  const data = useMemo(() => ({ ...base, groups }), [base, groups]);
  const selected =
    data.groups.find((g) => g.id === selectedId) ?? data.groups[0];

  const handleTimeChange = useCallback(async (range: string) => {
    try {
      // 時間だけ渡ってきた場合は「当日（JST）」としてUTCに変換
      const d = new Date();
      const y = d.getFullYear();
      const mo = String(d.getMonth() + 1).padStart(2, "0");
      const da = String(d.getDate()).padStart(2, "0");
      const nextGroups = await fetchGroupsByRange({
        date: `${y}-${mo}-${da}`,
        timeRange: range,
      });
      setGroups(nextGroups);
      setSelectedId((prev) =>
        nextGroups.some((g) => g.id === prev)
          ? prev
          : (nextGroups[0]?.id ?? prev)
      );
    } catch (err) {
      console.error("[list-ver] fetch failed", err);
    }
  }, []);

  const handleDateChange = useCallback(async (date: string) => {
    try {
      const nextGroups = await fetchGroupsByRange({
        date: date,
        timeRange: "00:00〜23:59", // 日付変更時は時間範囲を固定
      });
      setGroups(nextGroups);
      setSelectedId((prev) =>
        nextGroups.some((g) => g.id === prev)
          ? prev
          : (nextGroups[0]?.id ?? prev)
      );
    } catch (err) {
      console.error("[list-ver] fetch failed", err);
    }
  }, []);

  return (
    <div className="min-h-screen">
      <AppHeader
        date={selectedDate}
        onDateChange={handleDateChange}
        onRefresh={async () => {
          // 最新の選択時間帯があればそれで再フェッチする設計も可
          await handleTimeChange("10:40〜10:45");
        }}
      />

      <main className="pt-14 px-4 pb-4 grid grid-cols-1 lg:grid-cols-[520px_minmax(0,1fr)] gap-2">
        <div>
          <GroupList
            data={data}
            selectedId={selectedId}
            onSelect={setSelectedId}
            onTimeChange={handleTimeChange}
          />
        </div>
        <div className="lg:sticky lg:top-14 self-start">
          {selected && <GroupDetail data={data} selected={selected} />}
        </div>
      </main>
    </div>
  );
}
