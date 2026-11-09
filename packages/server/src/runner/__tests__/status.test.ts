import { expect, test } from "vite-plus/test";
import type { ContinueReason } from "../events.ts";
import { SERVER_STOPPED } from "../sessions.ts";
import { sessionStatus } from "../status.ts";

type Input = Parameters<typeof sessionStatus>[0];
const base: Input = { blocked: false, queued: false, seenAt: null, waitsOnHuman: false };
const ended = (
  state: "done" | "failed" | "stopped",
  kind: "chat" | "workflow" = "workflow",
  {
    continueAt = null,
    continueReason = null,
    dismissedAt = null,
    reason = null,
  }: {
    continueAt?: number | null;
    continueReason?: ContinueReason | null;
    dismissedAt?: string | null;
    reason?: string | null;
  } = {},
) => ({
  continueAt,
  continueReason,
  dismissedAt,
  endedAt: "2026-10-13T10:00",
  kind,
  reason,
  state,
});
const dismissed = { dismissedAt: "2026-10-13T10:30" };
const running = {
  continueAt: null,
  continueReason: null,
  dismissedAt: null,
  endedAt: null,
  kind: "workflow",
  reason: null,
  state: "running",
} as const;

test.each<[string, Partial<Input>, ReturnType<typeof sessionStatus>]>([
  ["a running turn", { latest: running }, { label: "Working", status: "working" }],
  ["a queued turn only", { queued: true }, { label: "Working", status: "working" }],
  [
    "a running turn while the step waits on the human",
    { latest: running, waitsOnHuman: true },
    { label: "Working", status: "working" },
  ],
  [
    "a turn waiting to continue",
    { latest: ended("failed", "workflow", { continueAt: 1, continueReason: "limit" }) },
    { label: "Waiting", reason: "waiting", status: "working" },
  ],
  [
    "a turn waiting to continue, with a blocked action and a step that waits on the human",
    {
      blocked: true,
      latest: ended("stopped", "workflow", { continueAt: 1, continueReason: "restart" }),
      waitsOnHuman: true,
    },
    { label: "Waiting", reason: "waiting", status: "working" },
  ],
  [
    "a turn the cap stopped",
    { latest: ended("failed", "workflow", { continueReason: "limit" }) },
    { label: "Needs attention", reason: "capped", status: "attention" },
  ],
  [
    "a turn the cap stopped, dismissed",
    { latest: ended("failed", "workflow", { ...dismissed, continueReason: "limit" }) },
    { label: "Idle", status: "idle" },
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
  [
    "a workflow turn done past its last task, without gh (US1.5)",
    {
      latest: ended("done"),
      seenAt: "2026-10-13T11:00",
      stepName: "pull-request-unknown",
      waitsOnAgent: true,
    },
    { label: "Idle", status: "idle" },
  ],
  [
    "a failed turn, seen",
    { latest: ended("failed"), seenAt: "2026-10-13T11:00" },
    { label: "Needs attention", reason: "failed", status: "attention" },
  ],
  [
    "a turn the human stopped, seen",
    { latest: ended("stopped"), seenAt: "2026-10-13T11:00" },
    { label: "Needs attention", reason: "stopped", status: "attention" },
  ],
  [
    "a turn the server stopped (US2.1)",
    { latest: ended("stopped", "workflow", { reason: SERVER_STOPPED }) },
    { label: "Needs attention", reason: "interrupted", status: "attention" },
  ],
  [
    "a stopped chat",
    { latest: ended("stopped", "chat") },
    { label: "Needs attention", reason: "stopped", status: "attention" },
  ],
  [
    "a failed turn dismissed, while the step waits on the agent (US2.2)",
    { latest: ended("failed", "workflow", dismissed), waitsOnAgent: true },
    { label: "Idle", status: "idle" },
  ],
  [
    "a turn the server stopped, dismissed, ended after it was seen",
    {
      latest: ended("stopped", "workflow", { ...dismissed, reason: SERVER_STOPPED }),
      seenAt: "2026-10-13T09:00",
    },
    { label: "Idle", status: "idle" },
  ],
  [
    "a stopped chat, dismissed",
    { latest: ended("stopped", "chat", dismissed) },
    { label: "Idle", status: "idle" },
  ],
  [
    "a workflow turn that ended while the step still waits on the agent, seen",
    { latest: ended("done"), seenAt: "2026-10-13T11:00", waitsOnAgent: true },
    { label: "Needs attention", reason: "halted", status: "attention" },
  ],
  [
    "a catch-up turn ended at Catch up (US3 2)",
    { latest: { ...ended("done"), step: "catch-up" }, stepName: "catch-up", waitsOnAgent: true },
    { label: "Needs attention", reason: "conflict", status: "attention" },
  ],
  [
    "a catch-up turn dismissed",
    {
      latest: { ...ended("done", "workflow", dismissed), step: "catch-up" },
      seenAt: "2026-10-13T11:00",
      stepName: "catch-up",
      waitsOnAgent: true,
    },
    { label: "Idle", status: "idle" },
  ],
  [
    "a catch-up turn dismissed, ended after it was seen",
    {
      latest: { ...ended("done", "workflow", dismissed), step: "catch-up" },
      seenAt: "2026-10-13T09:00",
      stepName: "catch-up",
      waitsOnAgent: true,
    },
    { label: "Idle", status: "idle" },
  ],
  [
    "a catch-up turn ended back at the pull request (US2 2)",
    {
      latest: { ...ended("done"), step: "catch-up" },
      seenAt: "2026-10-13T09:00",
      stepName: "pull-request",
      waitsOnHuman: true,
    },
    { label: "Needs you", reason: "step", status: "needs-you" },
  ],
  [
    "an earlier turn at Catch up",
    {
      latest: { ...ended("done"), step: "pull-request-changes" },
      seenAt: "2026-10-13T11:00",
      stepName: "catch-up",
      waitsOnAgent: true,
    },
    { label: "Idle", status: "idle" },
  ],
  [
    "an earlier turn at Catch up, ended after it was seen",
    {
      latest: { ...ended("done"), step: "pull-request" },
      seenAt: "2026-10-13T09:00",
      stepName: "catch-up",
      waitsOnAgent: true,
    },
    { label: "New reply", status: "unread" },
  ],
  [
    "a chat turn that ended while the step waits on the agent",
    { latest: ended("done", "chat"), seenAt: "2026-10-13T09:00", waitsOnAgent: true },
    { label: "Needs attention", reason: "halted", status: "attention" },
  ],
  [
    "a chat turn that ended while the step waits on the agent, seen",
    { latest: ended("done", "chat"), seenAt: "2026-10-13T11:00", waitsOnAgent: true },
    { label: "Idle", status: "idle" },
  ],
  [
    "a failed turn at a step that waits on the human, until dismissed",
    { latest: ended("failed"), waitsOnHuman: true },
    { label: "Needs attention", reason: "failed", status: "attention" },
  ],
  [
    "a failed turn dismissed, at a step that waits on the human",
    { latest: ended("failed", "workflow", dismissed), waitsOnHuman: true },
    { label: "Needs you", reason: "step", status: "needs-you" },
  ],
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
  ["no turn", {}, { label: "Idle", status: "idle" }],
  [
    "no turn, and a step that waits on the human",
    { waitsOnHuman: true },
    { label: "Needs you", reason: "step", status: "needs-you" },
  ],
])("sessionStatus: %s", (_, input, expected) =>
  expect(sessionStatus({ ...base, ...input })).toEqual(expected),
);
