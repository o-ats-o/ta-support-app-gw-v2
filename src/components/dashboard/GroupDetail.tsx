"use client";

import { Card } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { DashboardData, GroupInfo } from "@/lib/types";
import TrendChartPanel from "./TrendChartPanel";
import MiroWorkDetail from "./MiroWorkDetail";
import ConversationLogs from "./ConversationLogs";
import ScenarioPanel from "./ScenarioPanel";

type Props = {
  data: DashboardData;
  selected: GroupInfo;
  timeseriesLoading?: boolean;
};

export function GroupDetail({ data, selected, timeseriesLoading }: Props) {
  return (
    <Card className="p-3 h-full">
      <div className="flex items-center gap-2">
        <span className="font-semibold text-lg underline underline-offset-4 decoration-2">
          {selected.name}
        </span>
      </div>

      <Tabs defaultValue="trend" className="-mt-1">
        <TabsList className="grid w-full grid-cols-4">
          <TabsTrigger value="trend">時間推移グラフ</TabsTrigger>
          <TabsTrigger value="logs">会話履歴</TabsTrigger>
          <TabsTrigger value="scenario">声かけシナリオ</TabsTrigger>
          <TabsTrigger value="miro">Miro作業量詳細</TabsTrigger>
        </TabsList>
        <TabsContent value="trend" className="pt-4">
          <TrendChartPanel
            data={data}
            groups={data.groups}
            selected={selected}
            timeseriesLoading={timeseriesLoading}
            defaultSeries="speech"
          />
        </TabsContent>
        <TabsContent value="miro" className="pt-4">
          <MiroWorkDetail data={data} selected={selected} />
        </TabsContent>
        <TabsContent value="logs" className="pt-4">
          <ConversationLogs data={data} selected={selected} />
        </TabsContent>
        <TabsContent value="scenario" className="pt-4">
          <ScenarioPanel data={data} selected={selected} />
        </TabsContent>
      </Tabs>
    </Card>
  );
}
