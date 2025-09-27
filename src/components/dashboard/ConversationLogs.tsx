"use client";

import { Card } from "@/components/ui/card";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { ConversationLog, DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
};

function Section({ log }: { log: ConversationLog }) {
  return (
    <div className="space-y-3">
      <div className="text-sm text-muted-foreground">{log.timeLabel}</div>
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

export default function ConversationLogs({ data }: Props) {
  const logs = data.logs ?? [];
  return (
    <Card className="p-4">
      <div className="font-semibold text-base">会話履歴</div>
      <ScrollArea className="mt-2 h-[380px] pr-2">
        <div className="space-y-10">
          {logs.map((log, i) => (
            <Section key={i} log={log} />
          ))}
          {logs.length === 0 && (
            <div className="text-sm text-muted-foreground">
              履歴がありません
            </div>
          )}
        </div>
      </ScrollArea>
    </Card>
  );
}
