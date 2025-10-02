"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { fetchGroupTimeseriesByRange } from "@/lib/api";
import type { DashboardData, GroupInfo } from "@/lib/types";

const BASE_KEY = ["timeseries"] as const;

type Params = {
  date?: string;
  range?: string;
  groups?: readonly GroupInfo[];
};

const buildGroupIdentifiers = (groups?: readonly GroupInfo[]): string[] => {
  if (!groups?.length) return [];
  const unique = new Set<string>();
  for (const group of groups) {
    const candidates = [
      group.rawId,
      typeof group.rawId === "string" ? group.rawId.trim() : undefined,
      group.name,
      typeof group.name === "string" ? group.name.trim() : undefined,
      `Group ${group.id}`,
      group.id,
    ];
    for (const candidate of candidates) {
      if (typeof candidate !== "string") continue;
      const trimmed = candidate.trim();
      if (!trimmed) continue;
      unique.add(trimmed);
    }
  }
  return Array.from(unique).sort((a, b) => a.localeCompare(b));
};

export const buildTimeseriesQueryKey = (
  date: string,
  range: string,
  identifiers: string
) => [...BASE_KEY, date, range, identifiers] as const;

export function useTimeseriesQuery({ date, range, groups }: Params) {
  const identifiers = useMemo(() => buildGroupIdentifiers(groups), [groups]);
  const identifiersKey = useMemo(
    () => (identifiers.length > 0 ? identifiers.join("|") : ""),
    [identifiers]
  );

  const enabled = Boolean(date && range && identifiers.length > 0);

  return useQuery<DashboardData["timeseries"]>({
    queryKey: buildTimeseriesQueryKey(date ?? "", range ?? "", identifiersKey),
    queryFn: () =>
      fetchGroupTimeseriesByRange(
        { date: date!, timeRange: range! },
        groups ?? []
      ),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 60 * 1000,
  });
}
