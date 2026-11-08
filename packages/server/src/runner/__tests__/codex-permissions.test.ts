import { execFileSync } from "node:child_process";
import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { CodexAdapter } from "../codex.ts";
import { codexTrust, gitMainRoot } from "../codex-permissions.ts";
import { appServer, message, until, written } from "./codex-stand-in.ts";

const trusted = { trust_level: "trusted" };
const untrusted = { trust_level: "untrusted" };

test.each<[string, Record<string, unknown> | undefined, string]>([
  ["no entry: what Codex would write, and apply", undefined, "trusted"],
  ["the main checkout's entry", { "/r/main": untrusted }, "untrusted"],
  ["the worktree's own entry first", { "/r/main": untrusted, "/r/wt": trusted }, "trusted"],
  ["a folder holding the main checkout", { "/r": untrusted }, "untrusted"],
  ["the closest folder first", { "/": trusted, "/r": untrusted }, "untrusted"],
  ["an entry without a level", { "/r/main": {} }, "trusted"],
])("a project's trust: %s", (_, projects, level) => {
  expect(codexTrust("/r/wt", "/r/main", projects)).toBe(level);
});

test("the main checkout of a worktree is the one holding its common git folder", () => {
  const dir = temporaryFolder("uraeda-codex");
  const main = join(dir, "main");
  mkdirSync(main);
  const git = (...args: Array<string>) =>
    execFileSync("git", ["-C", main, "-c", "user.name=u", "-c", "user.email=u@u", ...args]);
  git("init", "-q");
  git("commit", "-q", "--allow-empty", "-m", "init");
  git("worktree", "add", "-q", join(dir, "wt"));
  expect(gitMainRoot(main)).toBe(main);
  expect(gitMainRoot(join(dir, "wt"))).toBe(main);
  expect(gitMainRoot(dir)).toBeUndefined();
});

test("a thread starts with its project's trust in memory, never written by Codex (R22)", async () => {
  const dir = temporaryFolder("uraeda-codex");
  const agent = new CodexAdapter({ command: appServer(dir), pluginDir: "/p" }).open({
    cwd: dir,
    nativeId: "id",
    resume: false,
    skills: [],
  });
  const events = agent.events[Symbol.asyncIterator]();
  agent.send(message("m1", "Hi"));
  await until(events, "result");
  agent.close();
  await until(events, "exit");
  const start = written(dir).find((line) => line.method === "thread/start");
  expect(start?.params).toMatchObject({ config: { projects: { [dir]: trusted } } });
});
