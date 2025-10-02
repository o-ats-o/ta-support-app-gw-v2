"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupRecommendationsByRange } from "@/lib/api";
import type { RecommendationGroupItem } from "@/lib/types";

const BASE_KEY = ["recommendations"] as const;

type Params = {
  date?: string;
  range?: string;
};

export const buildRecommendationsQueryKey = (date: string, range: string) => [
  ...BASE_KEY,
  date,
  range,
] as const;

export function useRecommendationsQuery({ date, range }: Params) {
  const enabled = Boolean(date && range);

  return useQuery<RecommendationGroupItem[]>({
    queryKey: buildRecommendationsQueryKey(date ?? "", range ?? ""),
    queryFn: () =>
      fetchGroupRecommendationsByRange({ date: date!, timeRange: range! }),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 1000 * 60 * 10,
  });
}
