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

export type SeriesKey = GroupId;
export type TimeSeriesPoint = { time: string } & Partial<Record<SeriesKey, number>>;

export interface DashboardData {
  groups: GroupInfo[];
  timeseries: {
    speech: TimeSeriesPoint[];
    sentiment: TimeSeriesPoint[];
    miroOps: TimeSeriesPoint[];
  };
}

export const GROUP_COLORS: Record<GroupId, string> = {
  A: "#ef4444",
  B: "#f59e0b",
  C: "#16a34a",
  D: "#2563eb",
  E: "#7c3aed",
  F: "#0ea5e9",
  G: "#ec4899",
};


