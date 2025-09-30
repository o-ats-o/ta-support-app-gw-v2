import type {
  DashboardData,
  GroupId,
  GroupInfo,
  RecommendationGroupItem,
  TimeSeriesPoint,
} from "./types";
import { GROUP_COLORS, createEmptyTimeseries } from "./types";

const API_BASE_URL = (() => {
  const value = process.env.NEXT_PUBLIC_API_BASE_URL;
  if (!value) {
    throw new Error(
      "NEXT_PUBLIC_API_BASE_URL is not set. Please define it in your environment (e.g., .env.local)."
    );
  }
  const trimmed = value.trim();
  return trimmed.endsWith("/") ? trimmed : `${trimmed}/`;
})();

const API_BASE_IS_ABSOLUTE = /^[a-zA-Z][a-zA-Z\d+\-.]*:/.test(API_BASE_URL);

function buildApiUrl(path: string, params: URLSearchParams): string {
  const normalizedPath = path.replace(/^\/+/, "");
  const search = params.toString();

  if (API_BASE_IS_ABSOLUTE) {
    const url = new URL(normalizedPath, API_BASE_URL);
    url.search = search;
    return url.toString();
  }

  const finalPath = `${API_BASE_URL}${normalizedPath}`;
  return search ? `${finalPath}?${search}` : finalPath;
}

const SESSIONS_PATH = "api/sessions";
const RECOMMENDATIONS_PATH = "api/groups/recommendations";
const TIMESERIES_PATH = "api/groups/timeseries";
const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/;

export type SessionIsoRange = {
  start: string;
  end: string;
};

export type JstDateTimeRange = {
  date: string; // YYYY-MM-DD
  timeRange: string; // HH:MM〜HH:MM
};

type ApiMetrics = {
  utterances?: number;
  miro?: number;
  sentiment_avg?: number;
};

type ApiGroupItem = {
  group_id: string;
  metrics?: ApiMetrics;
  prev_metrics?: ApiMetrics;
  deltas?: ApiMetrics;
};

type ApiRecommendationItem = ApiGroupItem & {
  score?: number;
  rank?: number;
  reasons?: string[];
};

type ApiTimeseriesBucketItem = {
  group_id: string;
  utterances?: number;
  miro?: number;
  sentiment_avg?: number;
};

type ApiTimeseriesBucket = {
  start?: string;
  end?: string;
  items?: ApiTimeseriesBucketItem[];
};

type ApiTimeseriesResponse = {
  window_ms?: number;
  buckets?: ApiTimeseriesBucket[];
};

const JST_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tokyo",
});

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

function formatBucketLabel(input?: string): string {
  if (!input) return "";
  const date = new Date(input);
  if (Number.isNaN(date.getTime())) {
    return input;
  }
  try {
    return JST_TIME_FORMATTER.format(date);
  } catch {
    return date.toISOString().slice(11, 16);
  }
}

function toFiniteNumber(value: unknown): number {
  const num = typeof value === "number" ? value : Number(value);
  return Number.isFinite(num) ? num : 0;
}

function collectRawGroupIds(groups: readonly GroupInfo[]): string[] {
  const unique = new Set<string>();
  for (const g of groups) {
    const raw = g.rawId?.trim();
    if (raw) {
      unique.add(raw);
      continue;
    }
    // フォールバック: Group {id} 形式 または ID 自体
    if (g.name) unique.add(g.name);
    unique.add(`Group ${g.id}`);
    unique.add(g.id);
  }
  return Array.from(unique);
}

function buildTimeseriesUrl(
  groupIds: readonly string[],
  { start, end }: SessionIsoRange
): string {
  const params = new URLSearchParams();
  params.set("group_ids", groupIds.join(","));
  params.set("start", start);
  if (end) params.set("end", end);
  return buildApiUrl(TIMESERIES_PATH, params);
}

async function requestTimeseries(
  input: { groupIds: readonly string[] } & SessionIsoRange
): Promise<ApiTimeseriesResponse> {
  const { groupIds, start, end } = input;
  const url = buildTimeseriesUrl(groupIds, { start, end });
  const res = await fetch(url, { cache: "no-store" });
  if (!res.ok) {
    throw new Error(`Failed to fetch timeseries: ${res.status}`);
  }
  return (await res.json()) as ApiTimeseriesResponse;
}

function mapTimeseriesResponse(
  response: ApiTimeseriesResponse,
  groups: readonly GroupInfo[]
): DashboardData["timeseries"] {
  if (!response || !Array.isArray(response.buckets)) {
    return createEmptyTimeseries();
  }

  const groupLookup = new Map<string, GroupId>();
  for (const g of groups) {
    if (g.rawId) {
      groupLookup.set(g.rawId, g.id);
      groupLookup.set(g.rawId.trim(), g.id);
    }
    groupLookup.set(`Group ${g.id}`, g.id);
    groupLookup.set(g.id, g.id);
  }

  const speech: TimeSeriesPoint[] = [];
  const sentiment: TimeSeriesPoint[] = [];
  const miroOps: TimeSeriesPoint[] = [];

  for (const bucket of response.buckets) {
    const label = formatBucketLabel(bucket?.end ?? bucket?.start);
    const speechPoint: TimeSeriesPoint = { time: label };
    const sentimentPoint: TimeSeriesPoint = { time: label };
    const miroPoint: TimeSeriesPoint = { time: label };

    for (const g of groups) {
      speechPoint[g.id] = 0;
      sentimentPoint[g.id] = 0;
      miroPoint[g.id] = 0;
    }

    for (const item of bucket.items ?? []) {
      const gid =
        groupLookup.get(item.group_id) ??
        groupLookup.get(item.group_id.trim()) ??
        toGroupId(item.group_id);
      if (!gid) continue;
      speechPoint[gid] = toFiniteNumber(item.utterances);
      sentimentPoint[gid] = toFiniteNumber(item.sentiment_avg);
      miroPoint[gid] = toFiniteNumber(item.miro);
    }

    speech.push(speechPoint);
    sentiment.push(sentimentPoint);
    miroOps.push(miroPoint);
  }

  return { speech, sentiment, miroOps };
}

async function requestGroupTimeseries(
  range: SessionIsoRange,
  groups: readonly GroupInfo[]
): Promise<DashboardData["timeseries"]> {
  const groupIds = collectRawGroupIds(groups);
  if (groupIds.length === 0) {
    return createEmptyTimeseries();
  }

  const response = await requestTimeseries({
    groupIds,
    start: range.start,
    end: range.end,
  });
  return mapTimeseriesResponse(response, groups);
}

function mapApiItemToGroupInfo(item: ApiGroupItem): GroupInfo | null {
  const gid = toGroupId(item.group_id);
  if (!gid) return null;
  return {
    id: gid,
    rawId: item.group_id,
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
  return buildApiUrl(SESSIONS_PATH, params);
}

function buildRecommendationsUrl(
  { start, end }: SessionIsoRange,
  limit?: number
): string {
  const params = new URLSearchParams({ start });
  if (end) params.set("end", end);
  if (typeof limit === "number" && limit > 0) {
    params.set("limit", String(limit));
  }
  return buildApiUrl(RECOMMENDATIONS_PATH, params);
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

async function requestRecommendations(
  range: SessionIsoRange,
  options?: { limit?: number }
): Promise<RecommendationGroupItem[]> {
  const res = await fetch(
    buildRecommendationsUrl(range, options?.limit),
    {
      cache: "no-store",
    }
  );
  if (!res.ok) {
    throw new Error(`Failed to fetch recommendations: ${res.status}`);
  }

  const json = (await res.json()) as ApiRecommendationItem[];
  return json
    .map((item, index) => {
      const group = mapApiItemToGroupInfo(item);
      if (!group) return null;
      const numericRank = Number(item.rank);
      const rank = Number.isFinite(numericRank)
        ? Math.max(1, Math.round(numericRank))
        : index + 1;
      const numericScore = Number(item.score);
      const score = Number.isFinite(numericScore)
        ? numericScore
        : Number.POSITIVE_INFINITY;
      const reasons = Array.isArray(item.reasons)
        ? item.reasons.filter((r): r is string => typeof r === "string")
        : [];
      return {
        group,
        rawGroupId: item.group_id,
        score,
        rank,
        reasons,
      } satisfies RecommendationGroupItem;
    })
    .filter((v): v is RecommendationGroupItem => Boolean(v))
    .sort((a, b) =>
      a.rank !== b.rank
        ? a.rank - b.rank
        : a.score - b.score
    );
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

export async function fetchGroupRecommendations(
  range: string,
  options?: { limit?: number }
): Promise<RecommendationGroupItem[]> {
  return requestRecommendations(timeRangeToIso(range), options);
}

export async function fetchGroupRecommendationsByRange(
  range: JstDateTimeRange,
  options?: { limit?: number }
): Promise<RecommendationGroupItem[]> {
  return requestRecommendations(jstDateTimeRangeToUtcIso(range), options);
}

export async function fetchGroupTimeseries(
  range: SessionIsoRange,
  groups: readonly GroupInfo[]
): Promise<DashboardData["timeseries"]> {
  if (!groups || groups.length === 0) {
    return createEmptyTimeseries();
  }
  return requestGroupTimeseries(range, groups);
}

export async function fetchGroupTimeseriesByRange(
  range: JstDateTimeRange,
  groups: readonly GroupInfo[]
): Promise<DashboardData["timeseries"]> {
  if (!groups || groups.length === 0) {
    return createEmptyTimeseries();
  }
  return requestGroupTimeseries(jstDateTimeRangeToUtcIso(range), groups);
}
