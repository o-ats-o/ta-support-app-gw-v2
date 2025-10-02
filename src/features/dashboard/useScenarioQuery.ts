"use client";

import { useMemo } from "react";
import { useQuery } from "@tanstack/react-query";
import { generateTalkScenarioFromTranscript } from "@/lib/api";
import type {
  ConversationLog,
  ConversationUtterance,
  GroupInfo,
  TalkScenario,
} from "@/lib/types";

const BASE_KEY = ["scenario"] as const;

const TIME_RANGE_RE = /^(\d{1,2}):(\d{2})〜(\d{1,2}):(\d{2})$/;

function parseTimeRange(date: string | undefined, timeRange: string | undefined) {
  if (!date || !timeRange) return null;
  const match = timeRange.match(TIME_RANGE_RE);
  if (!match) return null;
  const [sh, sm, eh, em] = match.slice(1).map((v) => Number(v));
  if (
    [sh, sm, eh, em].some((v) => !Number.isFinite(v)) ||
    sh < 0 ||
    sh > 23 ||
    eh < 0 ||
    eh > 23 ||
    sm < 0 ||
    sm > 59 ||
    em < 0 ||
    em > 59
  ) {
    return null;
  }

  const startIso = `${date}T${String(sh).padStart(2, "0")}:${String(sm).padStart(
    2,
    "0"
  )}:00+09:00`;
  const endIso = `${date}T${String(eh).padStart(2, "0")}:${String(em).padStart(
    2,
    "0"
  )}:00+09:00`;

  const start = new Date(startIso);
  const end = new Date(endIso);
  if (Number.isNaN(start.getTime()) || Number.isNaN(end.getTime())) {
    return null;
  }
  return { start, end } as const;
}

function parseTimestamp(date: string | undefined, time: string | undefined) {
  if (!date || !time) return null;
  const normalized = time.length === 5 ? `${time}:00` : time;
  const iso = `${date}T${normalized}+09:00`;
  const result = new Date(iso);
  return Number.isNaN(result.getTime()) ? null : result;
}

function computeTranscriptHash(input: string): string {
  let hash = 0;
  for (let i = 0; i < input.length; i += 1) {
    hash = Math.imul(31, hash) + input.charCodeAt(i);
    hash |= 0;
  }
  return hash.toString(16);
}

function formatSpeakerLabel(index: number, speakerId: string): string {
  if (speakerId && speakerId !== "S?") {
    return speakerId;
  }
  return `Speaker ${index}`;
}

function buildTranscript(
  logs: ConversationLog[] | undefined,
  group: GroupInfo | null | undefined,
  options: {
    date?: string;
    timeRange?: string;
    windowMinutes?: number;
  }
): string {
  if (!logs || logs.length === 0) {
    return "";
  }

  const lines: string[] = [];
  if (group) {
    const label = group.name?.trim() || group.rawId?.trim() || group.id;
    if (label) {
      lines.push(`# グループ: ${label}`);
    }
  }

  const range = parseTimeRange(options.date, options.timeRange);
  const windowMinutes = Math.max(1, options.windowMinutes ?? 10);
  const windowDurationMs = windowMinutes * 60 * 1000;
  const windowEnd = range?.end ?? null;
  const windowStart = windowEnd
    ? new Date(windowEnd.getTime() - windowDurationMs)
    : null;

  const isWithinWindow = (turn: ConversationUtterance, timeLabel?: string) => {
    if (!windowEnd || !windowStart) {
      return true;
    }
    const timestamp = parseTimestamp(options.date, turn.timestamp);
    if (timestamp) {
      return timestamp >= windowStart && timestamp <= windowEnd;
    }
    if (timeLabel) {
      const labelTimestamp = parseTimestamp(options.date, timeLabel);
      if (labelTimestamp) {
        return labelTimestamp >= windowStart && labelTimestamp <= windowEnd;
      }
    }
    return true;
  };

  logs.forEach((log) => {
    if (!log) return;
    const header = log.timeLabel?.trim();
    const filteredTurns = log.turns.filter((turn) =>
      isWithinWindow(turn, log.timeLabel)
    );
    if (filteredTurns.length === 0) {
      return;
    }

    if (header) {
      lines.push(`## ${header}`);
    }
    filteredTurns.forEach((turn, idx) => {
      if (!turn) return;
      const speaker = formatSpeakerLabel(idx, turn.speakerId ?? "");
      const timestamp = turn.timestamp?.trim();
      const text = (turn.text ?? "").replace(/\s+/g, " ").trim();
      if (!text) return;
      const prefix = timestamp ? `${speaker} (${timestamp})` : speaker;
      lines.push(`${prefix}: ${text}`);
    });
  });

  return lines.join("\n");
}

export type UseScenarioQueryParams = {
  group?: GroupInfo | null;
  logs?: ConversationLog[] | null;
  enabled?: boolean;
  date?: string;
  timeRange?: string;
  windowMinutes?: number;
};

export function useScenarioQuery({
  group,
  logs,
  enabled = true,
  date,
  timeRange,
  windowMinutes,
}: UseScenarioQueryParams) {
  const transcript = useMemo(
    () =>
      buildTranscript(logs ?? undefined, group, {
        date,
        timeRange,
        windowMinutes,
      }),
    [date, group, logs, timeRange, windowMinutes]
  );

  const transcriptHash = useMemo(() => {
    if (!transcript) return "";
    const groupKey = group?.rawId?.trim() || group?.name?.trim() || group?.id || "";
    return `${groupKey}:${computeTranscriptHash(transcript)}`;
  }, [group?.id, group?.name, group?.rawId, transcript]);

  const queryKey = useMemo(() => {
    const groupKey = group?.rawId?.trim() || group?.name?.trim() || group?.id || "unknown";
    const windowKey = windowMinutes ?? 10;
    return [...BASE_KEY, groupKey, windowKey, transcriptHash || "empty"] as const;
  }, [group?.id, group?.name, group?.rawId, transcriptHash, windowMinutes]);

  const queryResult = useQuery<TalkScenario>({
    queryKey,
    queryFn: () => generateTalkScenarioFromTranscript(transcript),
    enabled: enabled && Boolean(transcript),
    staleTime: 1000 * 60 * 2,
    gcTime: 1000 * 60 * 10,
    retry: 1,
    placeholderData: (previous) => previous,
  });

  return {
    transcript,
    hasTranscript: Boolean(transcript),
    queryKey,
    ...queryResult,
  };
}
