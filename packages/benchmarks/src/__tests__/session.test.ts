import { FakeAdapter } from "uraeda-server/runner/fake";
import { expect, test } from "vite-plus/test";
import { result } from "./loop-helpers.ts";
import { runSession } from "../session.ts";

const options = (adapter: FakeAdapter) => ({
  adapter,
  cwd: "/w",
  graceMs: 20,
  message: "go",
});

test("a process that stays up after its result is ended, SIGTERM first", async () => {
  const adapter = new FakeAdapter();
  adapter.ignoreClose = true;
  adapter.script([result()]);

  const session = await runSession(options(adapter));

  expect(adapter.kills).toEqual(["SIGTERM"]);
  expect(session.exit?.code).toBe(143);
});

test("one that ignores SIGTERM too is killed", async () => {
  const adapter = new FakeAdapter();
  adapter.ignoreClose = true;
  adapter.ignoreTerm = true;
  adapter.script([result()]);

  await runSession(options(adapter));

  expect(adapter.kills).toEqual(["SIGTERM", "SIGKILL"]);
});

test("a process that exits on its own is never signalled", async () => {
  const adapter = new FakeAdapter();
  adapter.script([result()]);

  await runSession(options(adapter));

  expect(adapter.kills).toEqual([]);
});

test("a second result keeps the first one's models and denials, and fails if either failed", async () => {
  const adapter = new FakeAdapter();
  const denial = { input: { command: "ls *" }, tool: "Bash" };
  adapter.script([
    result({ denials: [denial], models: ["claude-opus-4-8"] }),
    result({ errors: ["x"], models: ["claude-sonnet-5-5"], ok: false }),
  ]);

  const session = await runSession(options(adapter));

  expect(session.models).toEqual(["claude-opus-4-8", "claude-sonnet-5-5"]);
  expect(session.denials).toEqual([denial]);
  expect(session.ok).toBe(false);
});
