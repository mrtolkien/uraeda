import { expect, test } from "vite-plus/test";
import { hasSidebarLine } from "../UsageWindow.tsx";

const window = (id: string) => ({ id, label: id, resetsAt: "2026-11-10T20:00:00.000Z", used: 0.2 });
const account = { id: "/a", isNext: true, name: "a", state: "ready" as const, windows: [] };

test("the sidebar's usage pane has a line only for an account or a five-hour window", () => {
  // Codex reporting only its week, or a window of unknown length: its compact body draws nothing.
  expect(hasSidebarLine({ accounts: [], usage: [window("seven_day")] })).toBe(false);
  expect(hasSidebarLine({ accounts: [], usage: [window("primary")] })).toBe(false);
  expect(hasSidebarLine({ accounts: [], usage: [] })).toBe(false);
  expect(hasSidebarLine({ accounts: [], usage: [window("five_hour")] })).toBe(true);
  // Accounts draw a line each, signed out or not.
  expect(hasSidebarLine({ accounts: [account], usage: [] })).toBe(true);
});
