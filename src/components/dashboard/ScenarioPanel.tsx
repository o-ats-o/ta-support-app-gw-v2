"use client";

import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import type { DashboardData, GroupInfo } from "@/lib/types";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
  onRegenerate?: () => void;
};

export default function ScenarioPanel({ data, onRegenerate }: Props) {
  const scenario = data.scenario;

  return (
    <Card className="p-4">
      <div className="flex items-center justify-between">
        <div className="font-semibold text-base">声かけシナリオ</div>
        <Button
          type="button"
          variant="outline"
          className="bg-white text-emerald-700 border-emerald-600 hover:bg-emerald-50"
          onClick={onRegenerate}
        >
          再生成
        </Button>
      </div>

      {scenario ? (
        <ul className="mt-4 space-y-4">
          {scenario.bullets.map((b, i) => (
            <li key={i} className="text-[15px] leading-7">
              ・{b.text}
            </li>
          ))}
        </ul>
      ) : (
        <div className="mt-4 text-sm text-muted-foreground">
          シナリオがありません
        </div>
      )}
    </Card>
  );
}
