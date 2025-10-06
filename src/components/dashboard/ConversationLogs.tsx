"use client";

import { Loader2 } from "lucide-react";
import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import { Skeleton } from "@/components/ui/skeleton";
import type { ConversationLog, DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
  loading?: boolean;
  refreshing?: boolean;
};

function Section({ log }: { log: ConversationLog }) {
  return (
    <div className="space-y-3">
      <div className="text-base text-emerald-700 font-semibold">
        {log.timeLabel}
      </div>
      <div className="space-y-5">
        {log.turns.map((t, idx) => (
          <div key={idx} className="space-y-2">
            <div className="font-semibold">
              Speaker {t.speakerId.replace(/^S/, "")}:
            </div>
            <div className="leading-7 text-[15px] text-foreground/90 break-words">
              {t.text}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

function LogsSkeleton() {
  return (
    <div className="space-y-8">
      {Array.from({ length: 3 }).map((_, idx) => (
        <div key={idx} className="space-y-4">
          <Skeleton className="h-4 w-24" />
          <div className="space-y-3">
            <Skeleton className="h-4 w-32" />
            <Skeleton className="h-4 w-full" />
            <Skeleton className="h-4 w-3/4" />
          </div>
        </div>
      ))}
    </div>
  );
}

export default function ConversationLogs({
  data,
  loading = false,
  refreshing = false,
}: Props) {
  const logs = data.logs ?? [];
  const showEmpty = !loading && logs.length === 0;

  return (
    <Card className="flex h-full min-h-0 flex-col overflow-hidden p-4">
      <div className="font-semibold text-base">会話履歴</div>
      <div className="relative mt-2 h-[420px]">
        {refreshing && !loading && (
          <div className="absolute inset-0 z-10 flex flex-col items-center justify-center gap-2 bg-background/70 backdrop-blur-sm">
            <Loader2 className="h-5 w-5 animate-spin text-muted-foreground" />
            <span className="text-sm text-muted-foreground">更新中…</span>
          </div>
        )}
        <ScrollArea className="h-full pr-2">
          {loading ? (
            <LogsSkeleton />
          ) : (
            <div className="space-y-10 pb-2">
              {logs.map((log, i) => (
                <Section key={i} log={log} />
              ))}
              {showEmpty && (
                <div className="text-sm text-muted-foreground">
                  履歴がありません
                </div>
              )}
            </div>
          )}
        </ScrollArea>
      </div>
    </Card>
  );
}
