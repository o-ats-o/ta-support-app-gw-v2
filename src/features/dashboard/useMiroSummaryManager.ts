import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { fetchMiroDiffsForGroup } from "@/lib/api";
import type { GroupInfo, MiroDiffSummary } from "@/lib/types";
import {
  MiroComputedRange,
  buildMiroCacheKey,
  buildMiroSummary,
  computeMiroRange,
  formatMiroErrorMessage,
} from "./miroSummary";

type CacheEntry = {
  summary: MiroDiffSummary | null;
  error: string | null;
  timestamp: number;
};

const summaryCache = new Map<string, CacheEntry>();

const DEFAULT_CONCURRENCY = 2;

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

function getCachedEntry(key: string | null): CacheEntry | undefined {
  if (!key) return undefined;
  return summaryCache.get(key);
}

export function useMiroSummaryManager({
  active,
  groups,
  selectedGroup,
  date,
  timeRange,
  concurrency = DEFAULT_CONCURRENCY,
}: UseMiroSummaryManagerOptions): UseMiroSummaryManagerResult {
  const [summary, setSummary] = useState<MiroDiffSummary | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const range = useMemo(() => computeMiroRange(date, timeRange), [date, timeRange]);
  const activeKey = useMemo(() => {
    if (!selectedGroup || !date || !timeRange) {
      return null;
    }
    return buildMiroCacheKey(selectedGroup, date, timeRange);
  }, [selectedGroup, date, timeRange]);

  const effectiveConcurrency = useMemo(() => {
    if (!Number.isFinite(concurrency)) {
      return DEFAULT_CONCURRENCY;
    }
    const parsed = Math.max(1, Math.trunc(concurrency));
    return parsed;
  }, [concurrency]);

  const activeControllerRef = useRef<AbortController | null>(null);
  const backgroundControllersRef = useRef<Map<string, AbortController>>(new Map());
  const backgroundTokenRef = useRef(0);

  const applyCacheToState = useCallback(
    (entry?: CacheEntry) => {
      if (!entry) return;
      setSummary(entry.summary);
      setError(entry.error);
      setLoading(false);
    },
    []
  );

  const loadSummary = useCallback(
    async ({ force = false }: { force?: boolean } = {}) => {
      if (!active) {
        return;
      }
      if (!selectedGroup || !range || !activeKey) {
        return;
      }

      const cached = getCachedEntry(activeKey);
      if (cached && !force) {
        applyCacheToState(cached);
        return;
      }

      const controller = new AbortController();
      activeControllerRef.current?.abort();
      activeControllerRef.current = controller;

      setLoading(true);
      if (!cached || cached.error) {
        setError(null);
      }

      try {
        const diffs = await fetchMiroDiffsForGroup(selectedGroup, {
          since: range.previousStartIso,
          until: range.currentEndIso,
          limit: 500,
          signal: controller.signal,
        });
        if (controller.signal.aborted) {
          return;
        }
        const nextSummary = buildMiroSummary(diffs, range);
        const entry: CacheEntry = {
          summary: nextSummary,
          error: null,
          timestamp: Date.now(),
        };
        summaryCache.set(activeKey, entry);
        applyCacheToState(entry);
      } catch (err) {
        if (controller.signal.aborted) {
          return;
        }
        const message = formatMiroErrorMessage(err);
        const entry: CacheEntry = {
          summary: null,
          error: message,
          timestamp: Date.now(),
        };
        summaryCache.set(activeKey, entry);
        applyCacheToState(entry);
      } finally {
        if (!controller.signal.aborted) {
          setLoading(false);
          activeControllerRef.current = null;
        }
      }
    },
    [active, activeKey, applyCacheToState, range, selectedGroup]
  );

  const prefetchOthers = useCallback(
    async (
      computedRange: MiroComputedRange,
      currentDate: string,
      currentTimeRange: string,
      baseKey: string,
      baseGroupId: GroupInfo["id"]
    ) => {
      backgroundTokenRef.current += 1;
      const token = backgroundTokenRef.current;

      backgroundControllersRef.current.forEach((controller) => controller.abort());
      backgroundControllersRef.current.clear();

      const tasks = groups
        .filter((group) => group.id !== baseGroupId)
        .map((group) => ({ group, key: buildMiroCacheKey(group, currentDate, currentTimeRange) }))
        .filter(({ key }) => key !== baseKey)
        .filter(({ key }) => !summaryCache.has(key));

      if (tasks.length === 0) {
        return;
      }

      const queue = [...tasks];
      const workerCount = Math.max(1, Math.min(effectiveConcurrency, queue.length));

      const workers = Array.from({ length: workerCount }, () =>
        (async function worker() {
          while (queue.length > 0 && backgroundTokenRef.current === token) {
            const task = queue.shift();
            if (!task) break;
            const { group, key } = task;

            if (summaryCache.has(key)) {
              continue;
            }

            const controller = new AbortController();
            backgroundControllersRef.current.set(key, controller);

            try {
              const diffs = await fetchMiroDiffsForGroup(group, {
                since: computedRange.previousStartIso,
                until: computedRange.currentEndIso,
                limit: 500,
                signal: controller.signal,
              });
              if (controller.signal.aborted || backgroundTokenRef.current !== token) {
                continue;
              }
              const nextSummary = buildMiroSummary(diffs, computedRange);
              summaryCache.set(key, {
                summary: nextSummary,
                error: null,
                timestamp: Date.now(),
              });
            } catch (err) {
              if (controller.signal.aborted || backgroundTokenRef.current !== token) {
                continue;
              }
              const message = formatMiroErrorMessage(err);
              summaryCache.set(key, {
                summary: null,
                error: message,
                timestamp: Date.now(),
              });
            } finally {
              backgroundControllersRef.current.delete(key);
            }
          }
        })()
      );

      await Promise.allSettled(workers);

      if (backgroundTokenRef.current === token) {
        backgroundControllersRef.current.clear();
      }
    },
    [effectiveConcurrency, groups]
  );

  useEffect(() => {
    if (!active) {
      activeControllerRef.current?.abort();
      backgroundControllersRef.current.forEach((controller) => controller.abort());
      backgroundControllersRef.current.clear();
      setLoading(false);
      return;
    }
  }, [active]);

  useEffect(() => {
    if (!activeKey) {
      if (active) {
        setSummary(null);
        setError(null);
        setLoading(false);
      }
      return;
    }
    const cached = getCachedEntry(activeKey);
    if (cached) {
      applyCacheToState(cached);
    } else if (active) {
      setSummary(null);
      setError(null);
    }
  }, [active, activeKey, applyCacheToState]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (!selectedGroup) {
      setSummary(null);
      setError("グループが選択されていません。");
      setLoading(false);
      return;
    }
    if (!date || !timeRange || !range) {
      setSummary(null);
      setError("時間帯を選択すると差分を表示できます。");
      setLoading(false);
      return;
    }

    void loadSummary();

    return () => {
      activeControllerRef.current?.abort();
    };
  }, [active, selectedGroup, date, timeRange, range, loadSummary]);

  useEffect(() => {
    if (!active) {
      return;
    }
    if (!range || !selectedGroup || !activeKey) {
      return;
    }
    if (!date || !timeRange) {
      return;
    }
    if (!Array.isArray(groups) || groups.length <= 1) {
      return;
    }
    if (!summaryCache.has(activeKey)) {
      return;
    }

    void prefetchOthers(range, date, timeRange, activeKey, selectedGroup.id);
  }, [
    active,
    range,
    selectedGroup,
    activeKey,
    date,
    timeRange,
    groups,
    prefetchOthers,
  ]);

  useEffect(() => {
    const controllers = backgroundControllersRef.current;
    return () => {
      activeControllerRef.current?.abort();
      controllers.forEach((controller) => controller.abort());
      controllers.clear();
    };
  }, []);

  const refresh = useCallback(
    async ({ force = true }: { force?: boolean } = {}) => {
      await loadSummary({ force });
    },
    [loadSummary]
  );

  return {
    summary,
    loading,
    error,
    refresh,
  };
}
