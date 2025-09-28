"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import GroupListHeader from "@/components/ui/group-list-header";
import { cn } from "@/lib/utils";
import type { DashboardData, GroupInfo } from "@/lib/types";
import { AlertTriangle, Users, Star } from "lucide-react";

type Props = {
  data: DashboardData;
  selectedId: string;
  onSelect: (id: string) => void;
  onTimeChange?: (timeRange: string) => void;
};

function Metric({
  label,
  value,
  delta,
  emphasis,
}: {
  label: string;
  value: string;
  delta?: number;
  emphasis?: boolean;
}) {
  const isPos = typeof delta === "number" && delta >= 0;
  return (
    <div className="flex items-baseline gap-1">
      <span className="text-muted-foreground text-[13px]">{label}</span>
      <span
        className={cn(
          "tabular-nums",
          emphasis ? "text-[18px] font-semibold" : "font-medium"
        )}
      >
        {value}
      </span>
      {typeof delta === "number" && (
        <span
          className={cn(
            "tabular-nums",
            isPos ? "text-emerald-600" : "text-red-600"
          )}
        >
          {isPos ? `+${delta}` : delta}
        </span>
      )}
    </div>
  );
}

function GroupRow({
  g,
  active,
  onClick,
  highlighted,
  reason,
  variant = "normal",
}: {
  g: GroupInfo;
  active: boolean;
  onClick: () => void;
  highlighted?: boolean;
  reason?: string;
  variant?: "normal" | "recommended";
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full px-3 py-3 text-left rounded-md transition-colors border",
        variant === "recommended"
          ? "border-red-300 bg-white"
          : "border-transparent",
        highlighted && variant === "recommended" && "ring-1 ring-red-300",
        active ? "ring-2 ring-indigo-300" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between ">
        <div className="flex items-center gap-2">
          {variant === "recommended" && (
            <AlertTriangle className="h-4 w-4 text-red-500" />
          )}
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          <span className="font-medium">{g.name}</span>
        </div>
      </div>
      {variant === "recommended" && reason && (
        <div className="text-sm text-muted-foreground mt-1">
          推薦理由: {reason}
        </div>
      )}
      <div className="mt-2 grid grid-cols-3 gap-8 justify-items-center text-center w-fit mx-auto">
        <Metric
          label="発話"
          value={`${g.metrics.speechCount}回`}
          delta={g.metrics.speechDelta}
          emphasis={variant === "recommended"}
        />
        <Metric
          label="感情"
          value={g.metrics.sentimentAvg.toFixed(2)}
          delta={g.metrics.sentimentDelta}
          emphasis={variant === "recommended"}
        />
        <Metric
          label="Miro"
          value={`${g.metrics.miroOpsCount}件`}
          delta={g.metrics.miroOpsDelta}
          emphasis={variant === "recommended"}
        />
      </div>
    </button>
  );
}

function getRecommendedIds(data: DashboardData, pick: number): string[] {
  const lastSent =
    data.timeseries.sentiment[data.timeseries.sentiment.length - 1];
  const lastSpeech = data.timeseries.speech[data.timeseries.speech.length - 1];

  const scored = data.groups.map((g) => {
    const sPos = (lastSent as any)[g.id] ?? g.metrics.sentimentAvg;
    const speak = (lastSpeech as any)[g.id] ?? g.metrics.speechCount;
    const positiveSentiment = sPos > 0 ? 1 : 0;
    // 優先度: ポジティブ感情を優先しつつ、発話が少ないほど優先。
    const score = positiveSentiment * 100 - speak;
    return { id: g.id, score, speak, sPos };
  });

  scored.sort((a, b) => b.score - a.score || a.speak - b.speak);
  return scored.slice(0, pick).map((x) => x.id);
}

function buildReason(g: GroupInfo): string {
  const reasons: string[] = [];
  if (g.metrics.speechCount <= 2) reasons.push("発話回数が少ない");
  if (g.metrics.sentimentAvg < 0) reasons.push("感情がネガティブ");
  if (reasons.length === 0) return "活動量と感情のバランス";
  return reasons.join("、");
}

export default function RecommendGroupList({
  data,
  selectedId,
  onSelect,
  onTimeChange,
}: Props) {
  const recommendIds = getRecommendedIds(data, 2);
  const recommendSet = new Set(recommendIds);
  const recommended = data.groups.filter((g) => recommendSet.has(g.id));
  const others = data.groups.filter((g) => !recommendSet.has(g.id));

  return (
    <Card className="h-full">
      <GroupListHeader onTimeChange={onTimeChange} />

      <div className="-mt-6">
        <div className="flex items-center gap-2 text-amber-700 bg-amber-50 border border-amber-200 px-3 py-2 mb-2">
          <Star className="h-4 w-4" />
          <span className="text-sm font-medium">優先観察推薦グループ</span>
        </div>
        <ul className="space-y-2 px-3">
          {recommended.map((g) => (
            <li key={g.id}>
              <GroupRow
                g={g}
                active={selectedId === g.id}
                onClick={() => onSelect(g.id)}
                highlighted
                variant="recommended"
                reason={buildReason(g)}
              />
            </li>
          ))}
        </ul>
      </div>

      <div className="pb-3 -mt-2">
        <div className="text-sm text-muted-foreground bg-muted px-3 py-2 mb-2">
          その他のグループ
        </div>
        <ul className="space-y-1 px-3">
          {others.map((g) => (
            <li key={g.id}>
              <GroupRow
                g={g}
                active={selectedId === g.id}
                onClick={() => onSelect(g.id)}
              />
            </li>
          ))}
        </ul>
      </div>
    </Card>
  );
}
