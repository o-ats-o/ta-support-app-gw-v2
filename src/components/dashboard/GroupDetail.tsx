"use client";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, GroupInfo } from "@/lib/types";
import TrendChartPanel from "./TrendChartPanel";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
};

export function GroupDetail({ data, selected }: Props) {
  return (
    <Card className="p-3 h-full">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-base">{selected.name}</span>
      </div>

      <Tabs defaultValue="trend" className="mt-3">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trend">時間推移グラフ</TabsTrigger>
          <TabsTrigger value="miro">Miro作業量詳細</TabsTrigger>
          <TabsTrigger value="logs">会話履歴</TabsTrigger>
          <TabsTrigger value="scenario">声かけシナリオ</TabsTrigger>
        </TabsList>
        <TabsContent value="trend" className="pt-4">
          <TrendChartPanel
            data={data}
            groups={data.groups}
            selected={selected}
            defaultSeries="speech"
          />
        </TabsContent>
        <TabsContent value="miro" className="pt-4">
          <div className="text-sm text-muted-foreground">
            ダミー: Miro作業量詳細（未実装）
          </div>
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <div className="text-sm text-muted-foreground">
            ダミー: 会話履歴（未実装）
          </div>
        </TabsContent>
        <TabsContent value="scenario" className="pt-4">
          <div className="text-sm text-muted-foreground">
            ダミー: 声かけシナリオ（未実装）
          </div>
        </TabsContent>
      </Tabs>
    </Card>
  );
}
