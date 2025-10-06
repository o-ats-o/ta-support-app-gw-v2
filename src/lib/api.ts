import type {
  ConversationLog,
  DashboardData,
  GroupId,
  GroupInfo,
  MiroDiffRecord,
  MiroItemRecord,
  RecommendationGroupItem,
  TalkScenario,
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
const UTTERANCES_PATH = "api/utterances";
const MIRO_DIFFS_PATH = "api/miro/diffs";
const MIRO_ITEMS_PATH = "api/miro/items";
const SCENARIO_PATH = "api/generate-scenario";
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

type ApiUtterance = {
  session_id?: string;
  group_id?: string;
  utterance_text?: string;
  created_at?: string;
  speaker?: number | string | null;
};

type ApiMiroDeletedItem = {
  id?: string | number | null;
  type?: string | null;
};

type ApiMiroDiff = {
  boardId?: string;
  board_id?: string;
  diffAt?: string;
  diff_at?: string;
  added?: unknown[];
  updated?: unknown[];
  deleted?: ApiMiroDeletedItem[];
};

type ApiMiroItem = {
  id?: string;
  item_id?: string;
  type?: string;
  data?: Record<string, unknown>;
  firstSeenAt?: string;
  first_seen_at?: string;
  lastSeenAt?: string;
  last_seen_at?: string;
  deletedAt?: string | null;
  deleted_at?: string | null;
};

const JST_TIME_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
  timeZone: "Asia/Tokyo",
});

const JST_TIME_WITH_SECONDS_FORMATTER = new Intl.DateTimeFormat("ja-JP", {
  hour: "2-digit",
  minute: "2-digit",
  second: "2-digit",
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

function buildGroupIdCandidates(group: GroupInfo): string[] {
  const candidates = [
    group.rawId,
    typeof group.rawId === "string" ? group.rawId.trim() : undefined,
    group.name,
    typeof group.name === "string" ? group.name.trim() : undefined,
    group.id,
    `Group ${group.id}`,
  ];

  const unique = new Set<string>();
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const trimmed = candidate.trim();
    if (!trimmed) continue;
    unique.add(trimmed);
  }
  return Array.from(unique);
}

function normalizeSpeakerId(input: unknown): string {
  if (typeof input === "number" && Number.isFinite(input)) {
    return `S${Math.max(0, Math.trunc(Math.abs(input)))}`;
  }

  if (typeof input === "string") {
    const trimmed = input.trim();
    if (!trimmed) return "S?";
    if (/^S\d+$/i.test(trimmed)) {
      return `S${trimmed.replace(/^S/i, "")}`;
    }
    const numeric = Number(trimmed);
    if (Number.isFinite(numeric)) {
      return `S${Math.max(0, Math.trunc(Math.abs(numeric)))}`;
    }
  }

  return "S?";
}

type NormalizedUtterance = {
  timestampMs: number;
  speakerId: string;
  text: string;
  timestampLabel: string;
};

function mapUtterancesToConversationLogs({
  utterances,
  startMs,
  endMs,
  bucketCount,
  bucketDurationMs,
}: {
  utterances: ApiUtterance[];
  startMs: number;
  endMs: number;
  bucketCount: number;
  bucketDurationMs: number;
}): ConversationLog[] {
  if (
    !Array.isArray(utterances) ||
    utterances.length === 0 ||
    !Number.isFinite(startMs) ||
    !Number.isFinite(endMs) ||
    startMs >= endMs ||
    bucketCount <= 0
  ) {
    return [];
  }

  const duration = bucketDurationMs > 0 ? bucketDurationMs : 5 * 60 * 1000;

  const normalized: NormalizedUtterance[] = [];
  for (const item of utterances) {
    if (!item?.created_at) continue;
    const created = new Date(item.created_at);
    const createdMs = created.getTime();
    if (!Number.isFinite(createdMs)) continue;
    if (createdMs < startMs || createdMs >= endMs) continue;

    const text =
      typeof item.utterance_text === "string"
        ? item.utterance_text
        : item.utterance_text != null
        ? String(item.utterance_text)
        : "";

    normalized.push({
      timestampMs: createdMs,
      speakerId: normalizeSpeakerId(item.speaker),
      text,
      timestampLabel: JST_TIME_WITH_SECONDS_FORMATTER.format(created),
    });
  }

  if (normalized.length === 0) {
    return [];
  }

  normalized.sort((a, b) => a.timestampMs - b.timestampMs);

  const buckets = Array.from({ length: bucketCount }, (_, idx) => {
    const bucketStart = startMs + idx * duration;
    const bucketEnd = bucketStart + duration;
    return {
      start: bucketStart,
      end: bucketEnd,
      labelStart: JST_TIME_FORMATTER.format(new Date(bucketStart)),
      labelEnd: JST_TIME_FORMATTER.format(new Date(bucketEnd)),
      turns: [] as ConversationLog["turns"],
    };
  });

  for (const item of normalized) {
    let index = Math.floor((item.timestampMs - startMs) / duration);
    if (!Number.isFinite(index)) continue;
    if (index < 0) {
      index = 0;
    } else if (index >= buckets.length) {
      index = buckets.length - 1;
    }
    buckets[index]?.turns.push({
      speakerId: item.speakerId,
      text: item.text,
      timestamp: item.timestampLabel,
    });
  }

  return buckets
    .filter((bucket) => bucket.turns.length > 0)
    .map((bucket) => ({
      timeLabel: `${bucket.labelStart}〜${bucket.labelEnd}`,
      turns: bucket.turns,
    }));
}

function sanitizeMiroItem(
  entry: unknown
): MiroDiffRecord["added"][number] | null {
  if (!entry || typeof entry !== "object") {
    return null;
  }
  return entry as MiroDiffRecord["added"][number];
}

function sanitizeMiroDeletedItem(
  entry: ApiMiroDeletedItem | undefined
): MiroDiffRecord["deleted"][number] | null {
  if (!entry) return null;
  const rawId = entry.id;
  const id =
    typeof rawId === "string"
      ? rawId.trim()
      : typeof rawId === "number" && Number.isFinite(rawId)
      ? String(rawId)
      : "";
  if (!id) return null;
  const rawType = entry.type;
  const type =
    typeof rawType === "string" && rawType.trim().length > 0
      ? rawType.trim()
      : undefined;
  return { id, type };
}

function toRecord(value: unknown): Record<string, unknown> | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    return null;
  }
  return value as Record<string, unknown>;
}

function normalizeMiroId(value: unknown): string | undefined {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed || undefined;
  }
  if (typeof value === "number" && Number.isFinite(value)) {
    return String(value);
  }
  return undefined;
}

function normalizeMiroType(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return trimmed || undefined;
}

function normalizeChangedPaths(value: unknown): string[] | undefined {
  if (!Array.isArray(value)) return undefined;
  const results = value
    .map((item) => (typeof item === "string" ? item.trim() : ""))
    .filter((item) => item.length > 0);
  return results.length > 0 ? results : [];
}

function pickString(value: unknown): string | null {
  if (typeof value === "string") {
    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : null;
  }
  return null;
}

function sanitizeMiroUpdatedItem(
  entry: unknown
): MiroDiffRecord["updated"][number] | null {
  const obj = toRecord(entry);
  if (!obj) return null;

  const rawBefore =
    toRecord((obj as { before?: unknown; before_data?: unknown }).before) ??
    toRecord((obj as { before_data?: unknown }).before_data);
  const rawAfter =
    toRecord((obj as { after?: unknown; after_data?: unknown }).after) ??
    toRecord((obj as { after_data?: unknown }).after_data);

  const rawId =
    normalizeMiroId((obj as { id?: unknown }).id) ??
    (rawAfter ? normalizeMiroId((rawAfter as { id?: unknown }).id) : undefined) ??
    (rawBefore ? normalizeMiroId((rawBefore as { id?: unknown }).id) : undefined);
  if (!rawId) {
    return null;
  }

  const rawType =
    normalizeMiroType((obj as { type?: unknown }).type) ??
    (rawAfter ? normalizeMiroType((rawAfter as { type?: unknown }).type) : undefined) ??
    (rawBefore ? normalizeMiroType((rawBefore as { type?: unknown }).type) : undefined);

  const beforeText =
    pickString((obj as { beforeText?: unknown }).beforeText) ??
    pickString((obj as { before_text?: unknown }).before_text);
  const afterText =
    pickString((obj as { afterText?: unknown }).afterText) ??
    pickString((obj as { after_text?: unknown }).after_text);

  const changedPaths =
    normalizeChangedPaths((obj as { changedPaths?: unknown }).changedPaths) ??
    normalizeChangedPaths((obj as { changed_paths?: unknown }).changed_paths);

  const base: Record<string, unknown> = {};
  for (const [key, value] of Object.entries(obj)) {
    if (key === "before" || key === "before_data" || key === "after" || key === "after_data") {
      continue;
    }
    if (key === "beforeText" || key === "before_text" || key === "afterText" || key === "after_text") {
      continue;
    }
    if (key === "changedPaths" || key === "changed_paths") {
      continue;
    }
    base[key] = value;
  }

  if (rawType) {
    base.type = rawType;
  }

  base.id = rawId;

  const normalizedAfter = rawAfter ?? base;

  return {
    ...base,
    before: rawBefore ?? null,
    after: normalizedAfter,
    beforeText,
    afterText,
    changedPaths: changedPaths ?? undefined,
  } as MiroDiffRecord["updated"][number];
}

function mapApiMiroDiff(input: ApiMiroDiff | null | undefined): MiroDiffRecord | null {
  if (!input) return null;
  const boardIdRaw =
    (typeof input.boardId === "string" && input.boardId.trim()) ||
    (typeof input.board_id === "string" && input.board_id.trim()) ||
    "";
  const diffAtRaw =
    (typeof input.diffAt === "string" && input.diffAt.trim()) ||
    (typeof input.diff_at === "string" && input.diff_at.trim()) ||
    "";

  if (!boardIdRaw || !diffAtRaw) {
    return null;
  }

  const added = Array.isArray(input.added)
    ? input.added
        .map(sanitizeMiroItem)
        .filter((v): v is MiroDiffRecord["added"][number] => Boolean(v))
    : [];
  const updated = Array.isArray(input.updated)
    ? input.updated
        .map(sanitizeMiroUpdatedItem)
        .filter((v): v is MiroDiffRecord["updated"][number] => Boolean(v))
    : [];
  const deleted = Array.isArray(input.deleted)
    ? input.deleted
        .map(sanitizeMiroDeletedItem)
        .filter((v): v is MiroDiffRecord["deleted"][number] => Boolean(v))
    : [];

  return {
    boardId: boardIdRaw,
    diffAt: diffAtRaw,
    added,
    updated,
    deleted,
  } satisfies MiroDiffRecord;
}

function mapApiMiroItem(input: ApiMiroItem | null | undefined): MiroItemRecord | null {
  if (!input) return null;
  const idRaw =
    (typeof input.id === "string" && input.id.trim()) ||
    (typeof input.item_id === "string" && input.item_id.trim()) ||
    "";
  if (!idRaw) {
    return null;
  }

  const type =
    typeof input.type === "string" && input.type.trim().length > 0
      ? input.type.trim()
      : undefined;

  const data =
    input.data && typeof input.data === "object" && !Array.isArray(input.data)
      ? (input.data as Record<string, unknown>)
      : {};

  const firstSeenAt =
    (typeof input.firstSeenAt === "string" && input.firstSeenAt.trim()) ||
    (typeof input.first_seen_at === "string" && input.first_seen_at.trim()) ||
    undefined;

  const lastSeenAt =
    (typeof input.lastSeenAt === "string" && input.lastSeenAt.trim()) ||
    (typeof input.last_seen_at === "string" && input.last_seen_at.trim()) ||
    undefined;

  const deletedRaw =
    (typeof input.deletedAt === "string" && input.deletedAt.trim()) ||
    (typeof input.deleted_at === "string" && input.deleted_at.trim()) ||
    (input.deletedAt === null || input.deleted_at === null ? null : undefined);

  return {
    id: idRaw,
    type,
    data,
    firstSeenAt,
    lastSeenAt,
    deletedAt: deletedRaw,
  } satisfies MiroItemRecord;
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

export async function fetchGroupConversationLogsByRange(
  range: JstDateTimeRange,
  group: GroupInfo,
  options?: {
    limit?: number;
    offset?: number;
    bucketCount?: number;
  }
): Promise<ConversationLog[]> {
  if (!group) {
    return [];
  }

  const bucketCount = Math.max(1, options?.bucketCount ?? 5);
  const { start, end } = jstDateTimeRangeToUtcIso(range);
  const startDate = new Date(start);
  const endDate = new Date(end);
  const startMs = startDate.getTime();
  const endMs = endDate.getTime();

  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return [];
  }

  const fallbackDuration = 5 * 60 * 1000;
  let bucketDurationMs = endMs - startMs;
  if (!Number.isFinite(bucketDurationMs) || bucketDurationMs <= 0) {
    bucketDurationMs = fallbackDuration;
  }

  const expandedStartMs = endMs - bucketCount * bucketDurationMs;
  const limit = Math.max(1, Math.min(options?.limit ?? bucketCount * 60, 500));
  const offset = Math.max(0, options?.offset ?? 0);

  const rangeStartIso = new Date(expandedStartMs).toISOString();
  const rangeEndIso = endDate.toISOString();

  const candidates = buildGroupIdCandidates(group);
  if (candidates.length === 0) {
    return [];
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const params = new URLSearchParams();
      params.set("group_id", candidate);
      params.set("limit", String(limit));
      params.set("offset", String(offset));
      params.set("start_time", rangeStartIso);
      params.set("end_time", rangeEndIso);

      const url = buildApiUrl(UTTERANCES_PATH, params);
      const res = await fetch(url, { cache: "no-store" });
      if (!res.ok) {
        lastError = new Error(`Failed to fetch utterances: ${res.status}`);
        continue;
      }

      const payload = await res.json();
      const utterances = Array.isArray(payload)
        ? (payload as ApiUtterance[])
        : [];

      return mapUtterancesToConversationLogs({
        utterances,
        startMs: expandedStartMs,
        endMs,
        bucketCount,
        bucketDurationMs,
      });
    } catch (error) {
      lastError = error;
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to fetch utterances");
  }

  return [];
}

type ApiScenarioResponse = {
  scenario?: unknown;
  title?: unknown;
  error?: unknown;
  message?: unknown;
  markdown?: unknown;
};

function splitScenarioText(value: string): string[] {
  return value
    .split(/\r?\n+/)
    .map((line) => line.trim())
    .filter((line) => line.length > 0);
}

function normalizeScenarioBullet(input: unknown): string[] {
  const results: string[] = [];

  const appendFromUnknown = (value: unknown) => {
    if (!value) return;
    if (Array.isArray(value)) {
      for (const item of value) {
        appendFromUnknown(item);
      }
      return;
    }
    if (typeof value === "string") {
      results.push(...splitScenarioText(value));
      return;
    }
    if (typeof value === "object") {
      const maybeText = (value as { text?: unknown }).text;
      if (typeof maybeText === "string") {
        results.push(...splitScenarioText(maybeText));
      }
      const maybeBullets = (value as { bullets?: unknown }).bullets;
      if (maybeBullets) {
        appendFromUnknown(maybeBullets);
      }
      const maybeScenario = (value as { scenario?: unknown }).scenario;
      if (maybeScenario) {
        appendFromUnknown(maybeScenario);
      }
      const maybeContent = (value as { content?: unknown }).content;
      if (maybeContent) {
        appendFromUnknown(maybeContent);
      }
    }
  };

  appendFromUnknown(input);
  return results;
}

function sanitizeScenarioLine(line: string): string | null {
  const trimmed = line.trim();
  if (!trimmed) return null;
  const withoutHeading = trimmed.replace(
    /^(?:[-*・●○◆◇▶▷◉◯◎□■☆★✔️✅❌\d一二三四五六七八九十①②③④⑤⑥⑦⑧⑨⑩]+[\).．、:\s]*)/u,
    ""
  );
  const normalized = withoutHeading.trim();
  return normalized.length > 0 ? normalized : null;
}

const DEFAULT_SCENARIO_TITLE = "声かけシナリオ";

export async function generateTalkScenarioFromTranscript(
  transcript: string,
  options?: { signal?: AbortSignal }
): Promise<TalkScenario> {
  const trimmedTranscript = transcript.trim();
  if (!trimmedTranscript) {
    throw new Error("Transcript is required to generate scenario");
  }

  const res = await fetch(buildApiUrl(SCENARIO_PATH, new URLSearchParams()), {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ transcript: trimmedTranscript }),
    cache: "no-store",
    signal: options?.signal,
  });

  if (!res.ok) {
    let message = `Failed to generate scenario: ${res.status}`;
    try {
      const errorBody = (await res.json()) as ApiScenarioResponse;
      if (typeof errorBody?.error === "string" && errorBody.error.trim()) {
        message = errorBody.error.trim();
      } else if (
        typeof errorBody?.message === "string" &&
        errorBody.message.trim()
      ) {
        message = errorBody.message.trim();
      }
    } catch {
      try {
        const text = await res.text();
        if (text.trim()) {
          message = text.trim();
        }
      } catch {
        // ignore secondary parse errors
      }
    }

    const error = new Error(message) as Error & { status?: number };
    error.status = res.status;
    throw error;
  }

  let json: ApiScenarioResponse | null = null;
  try {
    json = (await res.json()) as ApiScenarioResponse;
  } catch {
    json = null;
  }

  if (json && typeof json.error === "string" && json.error.trim()) {
    throw new Error(json.error.trim());
  }

  const rawScenario = (json?.scenario ?? json) as unknown;
  const rawTitle =
    typeof json?.title === "string" && json.title.trim()
      ? json.title.trim()
      : typeof (rawScenario as { title?: unknown })?.title === "string"
      ? ((rawScenario as { title: string }).title || "").trim()
      : undefined;

  let markdown: string | undefined;
  const extractMarkdown = (value: unknown): string | undefined => {
    if (!value) return undefined;
    if (typeof value === "string") {
      const trimmed = value.trim();
      return trimmed.length > 0 ? trimmed : undefined;
    }
    if (Array.isArray(value)) {
      const combined = value
        .map((item) => extractMarkdown(item))
        .filter((item): item is string => Boolean(item))
        .join("\n\n");
      return combined.length > 0 ? combined : undefined;
    }
    if (typeof value === "object") {
      const obj = value as {
        markdown?: unknown;
        content?: unknown;
        text?: unknown;
      };
      return (
        extractMarkdown(obj.markdown) ||
        extractMarkdown(obj.content) ||
        extractMarkdown(obj.text)
      );
    }
    return undefined;
  };

  markdown =
    extractMarkdown(json?.markdown) ??
    extractMarkdown((rawScenario as { markdown?: unknown })?.markdown);

  const candidates = normalizeScenarioBullet(rawScenario);

  const bullets = candidates
    .map(sanitizeScenarioLine)
    .filter((line): line is string => Boolean(line));

  if (bullets.length === 0 && typeof rawScenario === "string") {
    const fallback = sanitizeScenarioLine(rawScenario);
    if (fallback) {
      bullets.push(fallback);
    }
  }

  if (!markdown) {
    if (typeof rawScenario === "string" && rawScenario.trim()) {
      markdown = rawScenario.trim();
    } else if (bullets.length > 0) {
      markdown = bullets.map((line) => `- ${line}`).join("\n");
    }
  }

  if (bullets.length === 0) {
    throw new Error("Scenario response contained no content");
  }

  const title = rawTitle && rawTitle.length > 0 ? rawTitle : DEFAULT_SCENARIO_TITLE;

  return {
    title,
    bullets: bullets.map((text) => ({ text, markdown: text })),
    markdown,
  } satisfies TalkScenario;
}

type FetchMiroDiffsParams = {
  groupId: string;
  since?: string;
  until?: string;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

type FetchMiroItemsParams = {
  groupId: string;
  includeDeleted?: boolean;
  limit?: number;
  offset?: number;
  signal?: AbortSignal;
};

async function requestMiroDiffs({
  groupId,
  since,
  until,
  limit,
  offset,
  signal,
}: FetchMiroDiffsParams): Promise<MiroDiffRecord[]> {
  const trimmedGroupId = groupId?.trim();
  if (!trimmedGroupId) {
    throw new Error("groupId is required to fetch Miro diffs");
  }

  const params = new URLSearchParams();
  params.set("group_id", trimmedGroupId);
  if (since) params.set("since", since);
  if (until) params.set("until", until);
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.trunc(limit)));
  }
  if (typeof offset === "number" && Number.isFinite(offset) && offset > 0) {
    params.set("offset", String(Math.trunc(offset)));
  }

  const url = buildApiUrl(MIRO_DIFFS_PATH, params);
  const res = await fetch(url, { cache: "no-store", signal });

  if (!res.ok) {
    let body: unknown = null;
    let message = `Failed to fetch Miro diffs: ${res.status}`;
    try {
      body = await res.json();
      if (body && typeof body === "object") {
        const errorText =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : typeof (body as { detail?: unknown }).detail === "string"
            ? (body as { detail: string }).detail
            : undefined;
        if (errorText) {
          message = errorText;
        }
      }
    } catch {
      try {
        const text = await res.text();
        if (text) {
          body = text;
          message = text;
        }
      } catch {
        // ignore body parse errors
      }
    }

    const error = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  const payload = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => mapApiMiroDiff(item as ApiMiroDiff))
    .filter((v): v is MiroDiffRecord => Boolean(v));
}

export async function fetchMiroDiffs(
  params: FetchMiroDiffsParams
): Promise<MiroDiffRecord[]> {
  return requestMiroDiffs(params);
}

export async function fetchMiroDiffsForGroup(
  group: GroupInfo,
  params?: Omit<FetchMiroDiffsParams, "groupId">
): Promise<MiroDiffRecord[]> {
  const candidates = buildGroupIdCandidates(group);
  if (candidates.length === 0) {
    return [];
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      return await fetchMiroDiffs({ groupId: candidate, ...(params ?? {}) });
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 404 || status === 400) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to fetch Miro diffs");
  }

  return [];
}

async function requestMiroItems({
  groupId,
  includeDeleted,
  limit,
  offset,
  signal,
}: FetchMiroItemsParams): Promise<MiroItemRecord[]> {
  const trimmedGroupId = groupId?.trim();
  if (!trimmedGroupId) {
    throw new Error("groupId is required to fetch Miro items");
  }

  const params = new URLSearchParams();
  params.set("group_id", trimmedGroupId);
  if (typeof includeDeleted === "boolean") {
    params.set("include_deleted", includeDeleted ? "true" : "false");
  }
  if (typeof limit === "number" && Number.isFinite(limit) && limit > 0) {
    params.set("limit", String(Math.trunc(limit)));
  }
  if (typeof offset === "number" && Number.isFinite(offset) && offset > 0) {
    params.set("offset", String(Math.trunc(offset)));
  }

  const url = buildApiUrl(MIRO_ITEMS_PATH, params);
  const res = await fetch(url, { cache: "no-store", signal });

  if (!res.ok) {
    let body: unknown = null;
    let message = `Failed to fetch Miro items: ${res.status}`;
    try {
      body = await res.json();
      if (body && typeof body === "object") {
        const errorText =
          typeof (body as { error?: unknown }).error === "string"
            ? (body as { error: string }).error
            : typeof (body as { detail?: unknown }).detail === "string"
            ? (body as { detail: string }).detail
            : undefined;
        if (errorText) {
          message = errorText;
        }
      }
    } catch {
      try {
        const text = await res.text();
        if (text) {
          body = text;
          message = text;
        }
      } catch {
        // ignore body parse errors
      }
    }

    const error = new Error(message) as Error & {
      status?: number;
      body?: unknown;
    };
    error.status = res.status;
    error.body = body;
    throw error;
  }

  const payload = (await res.json().catch(() => [])) as unknown;
  if (!Array.isArray(payload)) {
    return [];
  }
  return payload
    .map((item) => mapApiMiroItem(item as ApiMiroItem))
    .filter((v): v is MiroItemRecord => Boolean(v));
}

export async function fetchMiroItems(
  params: FetchMiroItemsParams
): Promise<MiroItemRecord[]> {
  return requestMiroItems(params);
}

export async function fetchMiroLatestDiff(
  groupId: string,
  options?: Omit<FetchMiroDiffsParams, "groupId">
): Promise<MiroDiffRecord | null> {
  const { limit, ...rest } = options ?? {};
  const effectiveLimit =
    typeof limit === "number" && Number.isFinite(limit) && limit > 0
      ? Math.trunc(limit)
      : 1;
  const diffs = await requestMiroDiffs({
    groupId,
    limit: effectiveLimit,
    ...rest,
  });
  return diffs[0] ?? null;
}

export async function fetchMiroLatestDiffForGroup(
  group: GroupInfo,
  options?: Omit<FetchMiroDiffsParams, "groupId">
): Promise<MiroDiffRecord | null> {
  const candidates = buildGroupIdCandidates(group);
  if (candidates.length === 0) {
    return null;
  }

  let lastError: unknown = null;
  for (const candidate of candidates) {
    try {
      const diff = await fetchMiroLatestDiff(candidate, options);
      return diff;
    } catch (error) {
      const status = (error as { status?: number } | null)?.status;
      if (status === 404 || status === 400) {
        lastError = error;
        continue;
      }
      throw error;
    }
  }

  if (lastError) {
    throw lastError instanceof Error
      ? lastError
      : new Error("Failed to fetch Miro diffs");
  }
  return null;
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
