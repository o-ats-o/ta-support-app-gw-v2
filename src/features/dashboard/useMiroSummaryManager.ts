import { useCallback, useEffect, useMemo } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { fetchMiroDiffsForGroup } from "@/lib/api";
import type { GroupInfo, MiroDiffSummary } from "@/lib/types";
import {
  buildMiroCacheKey,
  buildMiroSummary,
  computeMiroRange,
  formatMiroErrorMessage,
} from "./miroSummary";

const DEFAULT_CONCURRENCY = 2;
const MIRO_SUMMARY_BASE_KEY = ["miroSummary"] as const;

export type UseMiroSummaryManagerOptions = {
  active: boolean;
  groups: readonly GroupInfo[];
  selectedGroup: GroupInfo | null | undefined;
  date?: string;
  timeRange?: string;
  concurrency?: number;
};

export type UseMiroSummaryManagerResult = {
  summary: MiroDiffSummary | null;
  loading: boolean;
  error: string | null;
  refresh: (options?: { force?: boolean }) => Promise<void>;
};

export function useMiroSummaryManager({
  active,
  groups,
  selectedGroup,
  date,
  timeRange,
  concurrency = DEFAULT_CONCURRENCY,
}: UseMiroSummaryManagerOptions): UseMiroSummaryManagerResult {
  const queryClient = useQueryClient();

  const range = useMemo(() => computeMiroRange(date, timeRange), [date, timeRange]);

  const queryKey = useMemo(() => {
    if (!selectedGroup || !date || !timeRange) {
      return [...MIRO_SUMMARY_BASE_KEY, "inactive"] as const;
    }
    return [
      ...MIRO_SUMMARY_BASE_KEY,
      buildMiroCacheKey(selectedGroup, date, timeRange),
    ] as const;
  }, [selectedGroup, date, timeRange]);

  const effectiveConcurrency = useMemo(() => {
    if (!Number.isFinite(concurrency)) {
      return DEFAULT_CONCURRENCY;
    }
    const parsed = Math.max(1, Math.trunc(concurrency));
    return parsed;
  }, [concurrency]);

  const enabled = Boolean(active && selectedGroup && range && date && timeRange);

  const {
    data: fetchedSummary,
    error: queryError,
    isPending,
    isFetching,
    refetch,
  } = useQuery<MiroDiffSummary>({
    queryKey,
    queryFn: async ({ signal }) => {
      if (!selectedGroup || !range) {
        throw new Error("有効な範囲が指定されていません。");
      }
      const abortController = new AbortController();
      const handleAbort = () => abortController.abort();
      if (signal) {
        if (signal.aborted) {
          abortController.abort();
        } else {
          signal.addEventListener("abort", handleAbort);
        }
      }

      try {
        const diffs = await fetchMiroDiffsForGroup(selectedGroup, {
          since: range.previousStartIso,
          until: range.currentEndIso,
          limit: 500,
          signal: abortController.signal,
        });
        return buildMiroSummary(diffs, range);
      } finally {
        if (signal) {
          signal.removeEventListener("abort", handleAbort);
        }
      }
    },
    enabled,
    staleTime: 60 * 1000,
    gcTime: 1000 * 60 * 10,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  const baseError = useMemo(() => {
    if (!active) {
      return null;
    }
    if (!selectedGroup) {
      return "グループが選択されていません。";
    }
    if (!date || !timeRange) {
      return "時間帯を選択すると差分を表示できます。";
    }
    if (!range) {
      return "時間帯の形式が正しくありません。";
    }
    if (queryError) {
      return formatMiroErrorMessage(queryError);
    }
    return null;
  }, [active, selectedGroup, date, timeRange, range, queryError]);

  const loading = active && enabled ? isPending || isFetching : false;
  const summary = active && enabled ? fetchedSummary ?? null : null;
  const error = baseError;

  useEffect(() => {
    if (!active || !range || !date || !timeRange || !selectedGroup) {
      return;
    }
    if (!Array.isArray(groups) || groups.length <= 1) {
      return;
    }

    const others = groups.filter((group) => group.id !== selectedGroup.id);
    if (others.length === 0) {
      return;
    }

    let cancelled = false;
    const abortController = new AbortController();

    const worker = async (group: GroupInfo) => {
      await queryClient.prefetchQuery({
        queryKey: [
          ...MIRO_SUMMARY_BASE_KEY,
          buildMiroCacheKey(group, date, timeRange),
        ],
        queryFn: async ({ signal }) => {
          const controller = new AbortController();
          const handleAbort = () => controller.abort();
          if (signal) {
            if (signal.aborted) {
              controller.abort();
            } else {
              signal.addEventListener("abort", handleAbort);
            }
          }
          const outerAbort = () => controller.abort();
          if (abortController.signal.aborted) {
            controller.abort();
          } else {
            abortController.signal.addEventListener("abort", outerAbort);
          }

          try {
            const diffs = await fetchMiroDiffsForGroup(group, {
              since: range.previousStartIso,
              until: range.currentEndIso,
              limit: 500,
              signal: controller.signal,
            });
            return buildMiroSummary(diffs, range);
          } finally {
            if (signal) {
              signal.removeEventListener("abort", handleAbort);
            }
            abortController.signal.removeEventListener("abort", outerAbort);
          }
        },
        staleTime: 1000 * 60 * 10,
        gcTime: 1000 * 60 * 10,
        retry: 1,
      });
    };

    const runPrefetch = async () => {
      const queue = [...others];
      const workerCount = Math.max(
        1,
        Math.min(effectiveConcurrency, queue.length)
      );

      const workers = Array.from({ length: workerCount }, async () => {
        while (!cancelled && queue.length > 0) {
          const next = queue.shift();
          if (!next) {
            break;
          }
          try {
            await worker(next);
          } catch {
            // ignore background errors
          }
        }
      });

      await Promise.all(workers);
    };

    void runPrefetch();

    return () => {
      cancelled = true;
      abortController.abort();
    };
  }, [
    active,
    range,
    date,
    timeRange,
    selectedGroup,
    groups,
    effectiveConcurrency,
    queryClient,
  ]);

  const refresh = useCallback(
    async ({ force = true }: { force?: boolean } = {}) => {
      if (!enabled) {
        return;
      }
      if (force) {
        await queryClient.invalidateQueries({ queryKey, exact: true });
      } else {
        await refetch({ cancelRefetch: false });
      }
    },
    [enabled, queryClient, queryKey, refetch]
  );

  return {
    summary,
    loading,
    error,
    refresh,
  };
}
