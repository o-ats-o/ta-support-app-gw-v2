"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupsByRange } from "@/lib/api";
import type { GroupInfo } from "@/lib/types";

const BASE_KEY = ["groups"] as const;

type Params = {
  date?: string;
  range?: string;
};

export const buildGroupsQueryKey = (date: string, range: string) => [
  ...BASE_KEY,
  date,
  range,
] as const;

export function useGroupsQuery({ date, range }: Params) {
  const enabled = Boolean(date && range);

  return useQuery<GroupInfo[]>({
    queryKey: buildGroupsQueryKey(date ?? "", range ?? ""),
    queryFn: () => fetchGroupsByRange({ date: date!, timeRange: range! }),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 1000 * 60 * 10,
  });
}
