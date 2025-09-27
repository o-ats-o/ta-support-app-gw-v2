"use client";

import { Card } from "@/components/ui/card";
import { Separator } from "@/components/ui/separator";
import { cn } from "@/lib/utils";
import type { DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selectedId: string;
  onSelect: (id: string) => void;
};

function Metric({
  label,
  value,
  delta,
}: {
  label: string;
  value: string;
  delta?: number;
}) {
  const isPos = typeof delta === "number" && delta >= 0;
  return (
    <div className="flex items-baseline gap-1 text-xs">
      <span className="text-muted-foreground">{label}</span>
      <span className="font-medium tabular-nums">{value}</span>
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
}: {
  g: GroupInfo;
  active: boolean;
  onClick: () => void;
}) {
  return (
    <button
      type="button"
      className={cn(
        "w-full px-3 py-3 text-left rounded-md transition-colors",
        active ? "bg-secondary" : "hover:bg-muted/50"
      )}
      onClick={onClick}
    >
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          <span
            className="h-2 w-2 rounded-full"
            style={{ backgroundColor: g.color }}
          />
          <span className="font-medium">{g.name}</span>
        </div>
      </div>
      <div className="mt-2 grid grid-cols-3 gap-8 justify-items-center text-center w-fit mx-auto">
        <Metric
          label="発話"
          value={`${g.metrics.speechCount}回`}
          delta={g.metrics.speechDelta}
        />
        <Metric
          label="感情"
          value={g.metrics.sentimentAvg.toFixed(2)}
          delta={g.metrics.sentimentDelta}
        />
        <Metric
          label="Miro"
          value={`${g.metrics.miroOpsCount}件`}
          delta={g.metrics.miroOpsDelta}
        />
      </div>
    </button>
  );
}

export function GroupList({ data, selectedId, onSelect }: Props) {
  return (
    <Card className="p-3 h-full">
      <div className="flex items-center justify-between px-1 pt-1 pb-0">
        <div className="font-semibold">グループ一覧</div>
        <div className="text-sm text-muted-foreground">11:30〜</div>
      </div>
      <Separator className="my-0" />
      <ul className="space-y-1">
        {data.groups.map((g) => (
          <li key={g.id}>
            <GroupRow
              g={g}
              active={selectedId === g.id}
              onClick={() => onSelect(g.id)}
            />
          </li>
        ))}
      </ul>
    </Card>
  );
}
