import { expect, test } from "vite-plus/test";
import { sessionStatus } from "../status.ts";

type Input = Parameters<typeof sessionStatus>[0];
const base: Input = { blocked: false, queued: false, seenAt: null, waitsOnHuman: false };
const ended = (state: "done" | "failed" | "stopped") => ({ endedAt: "2026-10-13T10:00", state });

test.each<[string, Partial<Input>, ReturnType<typeof sessionStatus>]>([
  [
    "a running turn",
    { latest: { endedAt: null, state: "running" } },
    { label: "Working", status: "working" },
  ],
  ["a queued turn only", { queued: true }, { label: "Working", status: "working" }],
  [
    "a running turn while the step waits on the human",
    { latest: { endedAt: null, state: "running" }, waitsOnHuman: true },
    { label: "Working", status: "working" },
  ],
  [
    "an ended turn with a blocked action",
    { blocked: true, latest: ended("done") },
    { label: "Needs you", reason: "blocked", status: "needs-you" },
  ],
  [
    "a step that waits on the human",
    { latest: ended("done"), seenAt: "2026-10-13T11:00", waitsOnHuman: true },
    { label: "Needs you", reason: "step", status: "needs-you" },
  ],
  ["a failed turn", { latest: ended("failed") }, { label: "Failed", status: "failed" }],
  [
    "a turn that ended after it was seen",
    { latest: ended("done"), seenAt: "2026-10-13T09:00" },
    { label: "New reply", status: "unread" },
  ],
  [
    "a turn that ended before it was seen",
    { latest: ended("done"), seenAt: "2026-10-13T11:00" },
    { label: "Idle", status: "idle" },
  ],
  [
    "a stopped turn, seen",
    { latest: ended("stopped"), seenAt: "2026-10-13T11:00" },
    { label: "Stopped", status: "idle" },
  ],
  ["no turn", {}, { label: "Idle", status: "idle" }],
  [
    "no turn, and a step that waits on the human",
    { waitsOnHuman: true },
    { label: "Needs you", reason: "step", status: "needs-you" },
  ],
])("sessionStatus: %s", (_, input, expected) =>
  expect(sessionStatus({ ...base, ...input })).toEqual(expected),
);
