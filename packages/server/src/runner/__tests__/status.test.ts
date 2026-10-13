import { expect, test } from "vite-plus/test";
import { sessionStatus } from "../status.ts";

type Input = Parameters<typeof sessionStatus>[0];
const base: Input = { queued: false, blocked: false, waitsOnHuman: false, seenAt: null };
const ended = (state: "done" | "failed" | "stopped") => ({ state, endedAt: "2026-10-13T10:00" });

test.each<[string, Partial<Input>, ReturnType<typeof sessionStatus>]>([
  [
    "a running turn",
    { latest: { state: "running", endedAt: null } },
    { status: "working", label: "Working" },
  ],
  ["a queued turn only", { queued: true }, { status: "working", label: "Working" }],
  [
    "a running turn while the step waits on the human",
    { latest: { state: "running", endedAt: null }, waitsOnHuman: true },
    { status: "working", label: "Working" },
  ],
  [
    "an ended turn with a blocked action",
    { latest: ended("done"), blocked: true },
    { status: "needs-you", label: "Needs you", reason: "blocked" },
  ],
  [
    "a step that waits on the human",
    { latest: ended("done"), seenAt: "2026-10-13T11:00", waitsOnHuman: true },
    { status: "needs-you", label: "Needs you", reason: "step" },
  ],
  ["a failed turn", { latest: ended("failed") }, { status: "failed", label: "Failed" }],
  [
    "a turn that ended after it was seen",
    { latest: ended("done"), seenAt: "2026-10-13T09:00" },
    { status: "unread", label: "New reply" },
  ],
  [
    "a turn that ended before it was seen",
    { latest: ended("done"), seenAt: "2026-10-13T11:00" },
    { status: "idle", label: "Idle" },
  ],
  [
    "a stopped turn, seen",
    { latest: ended("stopped"), seenAt: "2026-10-13T11:00" },
    { status: "idle", label: "Stopped" },
  ],
  ["no turn", {}, { status: "idle", label: "Idle" }],
  [
    "no turn, and a step that waits on the human",
    { waitsOnHuman: true },
    { status: "needs-you", label: "Needs you", reason: "step" },
  ],
])("sessionStatus: %s", (_, input, expected) =>
  expect(sessionStatus({ ...base, ...input })).toEqual(expected),
);
