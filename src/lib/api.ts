import type { GroupId, GroupInfo } from "./types";
import { GROUP_COLORS } from "./types";

const API_BASE_URL = (() => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Please define it in your environment (e.g., .env.local)."
    );
  }
  return value.endsWith("/") ? value : `${value}/`;
})();

const SESSIONS_PATH = "api/sessions";
const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/;

export type SessionIsoRange = {
  start: string;
  end: string;
};

export type JstDateTimeRange = {
  date: string; // YYYY-MM-DD
  timeRange: string; // HH:MM〜HH:MM
};

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
  const m = input.match(/([A-G])$/i);
  if (!m) return null;
  const id = m[1].toUpperCase();
  return (VALID_IDS as readonly string[]).includes(id)
    ? (id as GroupId)
    : null;
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

function buildSessionsUrl({ start, end }: SessionIsoRange): string {
  const params = new URLSearchParams({
    start_time: start,
    end_time: end,
  });
  const url = new URL(SESSIONS_PATH, API_BASE_URL);
  url.search = params.toString();
  return url.toString();
}

async function requestGroupInfos(range: SessionIsoRange): Promise<GroupInfo[]> {
  const res = await fetch(buildSessionsUrl(range), { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch sessions: ${res.status}`);
  }

  const json = (await res.json()) as ApiGroupItem[];
  return json
    .map(mapApiItemToGroupInfo)
    .filter((v): v is GroupInfo => Boolean(v))
    .sort((a, b) => a.id.localeCompare(b.id));
}

function fallbackRange(): SessionIsoRange {
  const end = new Date();
  const start = new Date(end.getTime() - 5 * 60 * 1000);
  return { start: start.toISOString(), end: end.toISOString() };
}

export function timeRangeToIso(range: string): SessionIsoRange {
  const m = range.match(TIME_RANGE_RE);
  if (!m) return fallbackRange();

  const now = new Date();
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

export function jstDateTimeRangeToUtcIso({
  date,
  timeRange,
}: JstDateTimeRange): SessionIsoRange {
  const m = timeRange.match(TIME_RANGE_RE);
  const [y, mo, da] = date.split("-").map((s) => Number(s));

  if (!m || !y || !mo || !da) {
    return fallbackRange();
  }

  const sh = Number(m[1]);
  const sm = Number(m[2]);
  const eh = Number(m[3]);
  const em = Number(m[4]);

  const toUtcIso = (hour: number, minute: number) => {
    const utcMs = Date.UTC(y, mo - 1, da, hour - 9, minute, 0, 0);
    return new Date(utcMs).toISOString();
  };

  return { start: toUtcIso(sh, sm), end: toUtcIso(eh, em) };
}

export async function fetchGroups(range: string): Promise<GroupInfo[]> {
  return requestGroupInfos(timeRangeToIso(range));
}

export async function fetchGroupsByRange(
  range: JstDateTimeRange
): Promise<GroupInfo[]> {
  return requestGroupInfos(jstDateTimeRangeToUtcIso(range));
}
