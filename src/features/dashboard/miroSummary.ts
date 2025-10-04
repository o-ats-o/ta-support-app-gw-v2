import { jstDateTimeRangeToUtcIso } from "@/lib/api";
import type {
  GroupInfo,
  MiroDiffRecord,
  MiroDiffSummary,
  MiroDiffSummaryDetail,
} from "@/lib/types";

export type MiroComputedRange = {
  currentStartIso: string;
  currentEndIso: string;
  previousStartIso: string;
  currentStartMs: number;
  currentEndMs: number;
};

export const INITIAL_MIRO_SUMMARY: MiroDiffSummary = {
  added: 0,
  updated: 0,
  deleted: 0,
  total: 0,
  diffCount: 0,
  details: {
    added: [],
    updated: [],
    deleted: [],
  },
};

const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/;

type InternalDetail = MiroDiffSummaryDetail & { timestampMs: number };

const HTML_TAG_RE = /<[^>]+>/g;
const WHITESPACE_RE = /\s+/g;

function sanitizeRichText(value: string): string {
  const trimmed = value.trim();
  if (!trimmed) return "";

  if (typeof window !== "undefined" && typeof DOMParser !== "undefined") {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(trimmed, "text/html");
      const text = doc.body?.textContent ?? "";
      const normalized = text.replace(WHITESPACE_RE, " ").trim();
      if (normalized) {
        return normalized;
      }
    } catch {
      // フォールバックへ
    }
  }

  return trimmed.replace(HTML_TAG_RE, " ").replace(WHITESPACE_RE, " ").trim();
}

function truncateLabel(value: string, maxLength = 160): string {
  if (value.length <= maxLength) {
    return value;
  }
  return `${value.slice(0, Math.max(0, maxLength - 1)).trimEnd()}…`;
}

function pickFirstString(...candidates: unknown[]): string | null {
  for (const candidate of candidates) {
    if (typeof candidate !== "string") continue;
    const sanitized = sanitizeRichText(candidate);
    if (sanitized) {
      return sanitized;
    }
  }
  return null;
}

function extractItemText(item: Record<string, unknown>): string | null {
  const data = (item as { data?: unknown }).data;
  if (data && typeof data === "object" && !Array.isArray(data)) {
    const candidate = pickFirstString(
      (data as { content?: unknown }).content,
      (data as { plainText?: unknown }).plainText,
      (data as { title?: unknown }).title,
      (data as { text?: unknown }).text,
      (data as { description?: unknown }).description
    );
    if (candidate) {
      return candidate;
    }
  }

  return pickFirstString(
    (item as { title?: unknown }).title,
    (item as { text?: unknown }).text,
    (item as { content?: unknown }).content,
    (item as { caption?: unknown }).caption,
    (item as { name?: unknown }).name
  );
}

function extractItemLink(item: Record<string, unknown>): string | undefined {
  const links = (item as { links?: unknown }).links;
  if (!links || typeof links !== "object" || Array.isArray(links)) {
    return undefined;
  }
  const selfLink = (links as { self?: unknown }).self;
  if (typeof selfLink === "string" && selfLink.trim().length > 0) {
    return selfLink.trim();
  }
  return undefined;
}

function normalizeId(input: unknown): string | undefined {
  if (typeof input === "string") {
    const trimmed = input.trim();
    return trimmed || undefined;
  }
  if (typeof input === "number" && Number.isFinite(input)) {
    return String(input);
  }
  return undefined;
}

function buildDetailFromItem(
  item: Record<string, unknown>,
  diffAt: string,
  diffMs: number
): InternalDetail | null {
  const id = normalizeId((item as { id?: unknown }).id);
  if (!id) {
    return null;
  }

  const rawType = (item as { type?: unknown }).type;
  const type =
    typeof rawType === "string" && rawType.trim().length > 0
      ? rawType.trim()
      : undefined;

  const text = extractItemText(item);
  const title = truncateLabel(text ?? (type ? `${type} (${id})` : `ID: ${id}`));
  const subtitleParts: string[] = [];
  if (type) {
    subtitleParts.push(`タイプ: ${type}`);
  }
  subtitleParts.push(`ID: ${id}`);
  const subtitle = subtitleParts.join(" / ") || undefined;
  const link = extractItemLink(item);

  return {
    id,
    type,
    title,
    subtitle,
    diffAt,
    link,
    timestampMs: diffMs,
  };
}

export function computeMiroRange(
  date?: string,
  timeRange?: string
): MiroComputedRange | null {
  if (!date || !timeRange) return null;
  if (!TIME_RANGE_RE.test(timeRange)) return null;

  const { start, end } = jstDateTimeRangeToUtcIso({ date, timeRange });
  const startMs = Date.parse(start);
  const endMs = Date.parse(end);
  if (!Number.isFinite(startMs) || !Number.isFinite(endMs) || startMs >= endMs) {
    return null;
  }
  const duration = endMs - startMs;
  const previousStartIso = new Date(startMs - duration).toISOString();
  return {
    currentStartIso: start,
    currentEndIso: end,
    previousStartIso,
    currentStartMs: startMs,
    currentEndMs: endMs,
  };
}

export function buildMiroSummary(
  diffs: MiroDiffRecord[],
  range: MiroComputedRange
): MiroDiffSummary {
  let added = 0;
  let updated = 0;
  let deleted = 0;
  let diffCount = 0;
  let boardId: string | undefined;
  let lastDiffAt: string | undefined;
  let lastDiffMs = -Infinity;
  const detailBuckets: Record<"added" | "updated" | "deleted", InternalDetail[]> = {
    added: [],
    updated: [],
    deleted: [],
  };

  for (const diff of diffs) {
    if (!boardId && diff.boardId) {
      boardId = diff.boardId;
    }
    const diffMs = Date.parse(diff.diffAt ?? "");
    if (!Number.isFinite(diffMs)) continue;
    if (diffMs < range.currentStartMs || diffMs > range.currentEndMs) continue;

    diffCount += 1;
    added += Array.isArray(diff.added) ? diff.added.length : 0;
    updated += Array.isArray(diff.updated) ? diff.updated.length : 0;
    deleted += Array.isArray(diff.deleted) ? diff.deleted.length : 0;

    if (Array.isArray(diff.added)) {
      for (const item of diff.added) {
        const detail = buildDetailFromItem(
          item as unknown as Record<string, unknown>,
          diff.diffAt,
          diffMs
        );
        if (detail) {
          detailBuckets.added.push(detail);
        }
      }
    }

    if (Array.isArray(diff.updated)) {
      for (const item of diff.updated) {
        const detail = buildDetailFromItem(
          item as unknown as Record<string, unknown>,
          diff.diffAt,
          diffMs
        );
        if (detail) {
          detailBuckets.updated.push(detail);
        }
      }
    }

    if (Array.isArray(diff.deleted)) {
      for (const item of diff.deleted) {
        const detail = buildDetailFromItem(
          item as unknown as Record<string, unknown>,
          diff.diffAt,
          diffMs
        );
        if (detail) {
          detailBuckets.deleted.push(detail);
        }
      }
    }

    if (diffMs > lastDiffMs) {
      lastDiffMs = diffMs;
      lastDiffAt = diff.diffAt;
    }
  }

  if (!boardId) {
    boardId = diffs.find((d) => typeof d.boardId === "string")?.boardId;
  }

  if (!lastDiffAt) {
    lastDiffAt = diffs
      .map((d) => d.diffAt)
      .filter((value): value is string => typeof value === "string" && value.length > 0)
      .sort()
      .at(-1);
  }

  const sortDetails = (
    list: InternalDetail[]
  ): MiroDiffSummaryDetail[] =>
    list
      .slice()
      .sort((a, b) => b.timestampMs - a.timestampMs)
      .map(({ timestampMs: _timestamp, ...rest }) => rest);

  return {
    added,
    updated,
    deleted,
    total: added + updated + deleted,
    diffCount,
    boardId,
    lastDiffAt,
    details: {
      added: sortDetails(detailBuckets.added),
      updated: sortDetails(detailBuckets.updated),
      deleted: sortDetails(detailBuckets.deleted),
    },
  };
}

export function getGroupIdentifier(group: GroupInfo): string {
  const candidates = [
    typeof group.rawId === "string" ? group.rawId.trim() : undefined,
    typeof group.name === "string" ? group.name.trim() : undefined,
    group.id,
    `Group ${group.id}`,
  ];
  for (const candidate of candidates) {
    if (candidate && candidate.length > 0) {
      return candidate;
    }
  }
  return group.id;
}

export function buildMiroCacheKey(
  group: GroupInfo,
  date: string,
  timeRange: string
): string {
  const identifier = getGroupIdentifier(group);
  return `${date}::${timeRange}::${identifier}`;
}

export function formatMiroErrorMessage(error: unknown): string {
  const status = (error as { status?: number } | null)?.status;
  const message =
    error instanceof Error && typeof error.message === "string" && error.message
      ? error.message
      : "Miroの差分データを取得できませんでした。";
  if (status === 404 || /Mapping not found/i.test(message)) {
    return "Miroボードのマッピングが見つかりません。バックエンドで POST /api/miro/sync を実行して登録してください。";
  }
  return message;
}
