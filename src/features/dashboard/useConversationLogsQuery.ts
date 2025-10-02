"use client";

import { useQuery } from "@tanstack/react-query";
import { fetchGroupConversationLogsByRange } from "@/lib/api";
import type { ConversationLog, GroupInfo } from "@/lib/types";

const BASE_KEY = ["conversationLogs"] as const;

export const buildConversationLogsQueryKey = (
  date: string,
  range: string,
  groupKey: string,
  bucketCount: number
) => [...BASE_KEY, date, range, groupKey, bucketCount] as const;

type Params = {
  date?: string;
  range?: string;
  group?: GroupInfo | null;
  bucketCount?: number;
};

export function useConversationLogsQuery({
  date,
  range,
  group,
  bucketCount = 5,
}: Params) {
  const groupKey = group?.rawId?.trim() || group?.name?.trim() || group?.id || "";
  const enabled = Boolean(date && range && groupKey);

  return useQuery<ConversationLog[]>({
    queryKey: buildConversationLogsQueryKey(
      date ?? "",
      range ?? "",
      groupKey,
      bucketCount
    ),
    queryFn: () =>
      fetchGroupConversationLogsByRange(
        { date: date!, timeRange: range! },
        group!,
        { bucketCount }
      ),
    enabled,
    placeholderData: (previous) => previous,
    staleTime: 1000 * 60 * 10,
  });
}
