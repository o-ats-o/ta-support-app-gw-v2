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
  /**
   * API から返却される生のグループID。
   * 時系列データの取得時などで利用する。
   */
  rawId?: string;
  name: string; // 表示名（Group A など）
  color: string; // グラフ用カラー
  metrics: GroupSummaryMetrics;
}

export interface RecommendationGroupItem {
  group: GroupInfo;
  rawGroupId: string;
  score: number;
  rank: number;
  reasons: string[];
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
  logs?: ConversationLog[];
  scenario?: TalkScenario;
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


// 会話履歴
export type ConversationSpeaker = {
  id: string; // 表示用ID (例: Speaker 0)
  name?: string; // 任意
};

export interface ConversationUtterance {
  speakerId: string;
  text: string;
  timestamp?: string; // 任意: HH:mm など
}

export interface ConversationLog {
  timeLabel: string; // セクションの時刻ラベル (例: 11:30)
  turns: ConversationUtterance[];
}

// 声かけシナリオ
export interface TalkScenarioItem {
  text: string;
}

export interface TalkScenario {
  title: string; // 見出し
  bullets: TalkScenarioItem[]; // 箇条書き
}

export function createEmptyTimeseries(): DashboardData["timeseries"] {
  return {
    speech: [],
    sentiment: [],
    miroOps: [],
  };
}

export type MiroItem = {
  id?: string;
  type?: string;
  [key: string]: unknown;
};

export type MiroDeletedItem = {
  id: string;
  type?: string;
};

export type MiroDiffRecord = {
  boardId: string;
  diffAt: string;
  added: MiroItem[];
  updated: MiroItem[];
  deleted: MiroDeletedItem[];
};

export type MiroItemRecord = {
  id: string;
  type?: string;
  data: Record<string, unknown>;
  firstSeenAt?: string;
  lastSeenAt?: string;
  deletedAt?: string | null;
};

export type MiroDiffSummary = {
  added: number;
  updated: number;
  deleted: number;
  total: number;
  diffCount: number;
  boardId?: string;
  lastDiffAt?: string;
};
