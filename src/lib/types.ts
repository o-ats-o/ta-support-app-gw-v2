export type GroupId = "A" | "B" | "C" | "D" | "E" | "F" | "G";

export interface GroupSummaryMetrics {
  speechCount: number; // 発話回数
  speechDelta: number; // 前回比
  sentimentAvg: number; // 感情スコア平均（-1..1）
  sentimentDelta: number; // 前回比
  miroOpsCount: number; // Miro 作業件数
  miroOpsDelta: number; // 前回比
}

export interface GroupInfo {
  id: GroupId;
  name: string; // 表示名（Group A など）
  color: string; // グラフ用カラー
  metrics: GroupSummaryMetrics;
}

export interface TimeSeriesPoint {
  time: string; // 例: "11:10"
  // 動的キー: 各グループIDに紐づく数値
  [groupId: string]: string | number;
}

export interface DashboardData {
  groups: GroupInfo[];
  timeseries: {
    speech: TimeSeriesPoint[];
    sentiment: TimeSeriesPoint[];
    miroOps: TimeSeriesPoint[];
  };
}


