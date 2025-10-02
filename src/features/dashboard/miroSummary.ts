import { jstDateTimeRangeToUtcIso } from "@/lib/api";
import type { GroupInfo, MiroDiffRecord, MiroDiffSummary } from "@/lib/types";

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
};

const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/;

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

  return {
    added,
    updated,
    deleted,
    total: added + updated + deleted,
    diffCount,
    boardId,
    lastDiffAt,
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
