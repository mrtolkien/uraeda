// The agent row of a job's page shows what the file holds: an agent that is not on here as that
// agent, with the record's words that it is off; a model or an effort with no agent on the default
// agent; and "Default" while any of the three keys is set.
import { cleanup, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { atWidth } from "./helpers.tsx";
import { JOB, open, RUNTIMES } from "./job-page-fixtures.tsx";

beforeEach(() => atWidth(1440));
afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const CODEX = { ...RUNTIMES[0], kind: "codex", models: [], name: "Codex" };
const OFF = "Not running here: Claude Code is off in this repository.";

test("an agent that is not on here shows as that agent, with why it does not run", () => {
  open(undefined, { ...JOB, next: { at: null, text: OFF, why: "agent-off" } }, [CODEX]);
  expect(screen.getByRole("button", { name: /claude/ })).toBeTruthy();
  expect(screen.queryByRole("button", { name: /Codex/ })).toBeNull();
  expect(screen.getAllByText(OFF).length).toBeGreaterThan(1);
  expect(screen.getByRole("button", { name: "Default" })).toBeTruthy();
});

test("an agent shows with no agent on at all", () => {
  open(undefined, { ...JOB, next: { at: null, text: OFF, why: "agent-off" } }, []);
  expect(screen.getByRole("button", { name: /claude · opus · high/ })).toBeTruthy();
});

test("a model and an effort with no agent show on the default agent, and offer Default", () => {
  open(undefined, { ...JOB, agent: null });
  expect(screen.getByRole("button", { name: "Claude Code · Opus · High" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Default" })).toBeTruthy();
});
