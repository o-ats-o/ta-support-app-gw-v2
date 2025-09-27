import type { DashboardData, GroupId } from "./types";
import { GROUP_COLORS } from "./types";

const groupIds: GroupId[] = ["A", "B", "C", "D", "E", "F", "G"];

export const dashboardMock: DashboardData = {
  groups: groupIds.map((id, idx) => ({
    id,
    name: `Group ${id}`,
    color: GROUP_COLORS[id],
    metrics: {
      speechCount: [3, 3, 8, 1, 3, 3, 1][idx],
      speechDelta: [+3, +2, +7, -2, +3, +2, -2][idx],
      sentimentAvg: [-0.2, -0.1, -0.2, -0.7, -0.2, -0.1, -0.7][idx],
      sentimentDelta: [-0.2, -0.3, -0.1, -0.6, -0.2, -0.3, -0.6][idx],
      miroOpsCount: [18, 20, 23, 11, 18, 20, 11][idx],
      miroOpsDelta: [+3, +6, +8, -1, +3, +6, -1][idx],
    },
  })),
  timeseries: {
    speech: [
      { time: "11:10", A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:15", A: 1, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:20", A: 1, B: 3, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:25", A: 1, B: 2, C: 5, D: 0, E: 3, F: 2, G: 0 },
      { time: "11:30", A: 2, B: 3, C: 3, D: 1, E: 8, F: 9, G: 3 },
    ],
    sentiment: [
      { time: "11:10", A: 0, B: 0, C: 0, D: -0.5, E: 0, F: 0, G: -0.6 },
      { time: "11:15", A: 0.1, B: 0, C: -0.1, D: -0.6, E: 0, F: 0, G: -0.6 },
      { time: "11:20", A: 0.1, B: -0.2, C: -0.1, D: -0.6, E: 0.1, F: 0, G: -0.6 },
      { time: "11:25", A: 0.1, B: -0.3, C: -0.1, D: -0.7, E: 0.1, F: 0, G: -0.6 },
      { time: "11:30", A: 0.2, B: -0.2, C: -0.1, D: -0.7, E: 0.1, F: 0.1, G: -0.6 },
    ],
    miroOps: [
      { time: "11:10", A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:15", A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:20", A: 0, B: 0, C: 0, D: 0, E: 0, F: 0, G: 0 },
      { time: "11:25", A: 5, B: 10, C: 30, D: 5, E: 0, F: 0, G: 0 },
      { time: "11:30", A: 15, B: 20, C: 5, D: 11, E: 18, F: 20, G: 11 },
    ],
  },
};


