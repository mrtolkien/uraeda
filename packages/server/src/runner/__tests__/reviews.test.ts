// The reviewers of a feature (US4 of the run options): the `review` tool runs every reviewer of the
// feature at once, agents through their own review in sub-sessions, commands in the feature's
// worktree, and commits a section for each in `findings-NN.md`, before the build fixes them.
import { chmodSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { RunOptions } from "uraeda-binding";
import { McpTokens } from "../../mcp/tokens.ts";
import { claudeReview } from "../claude.ts";
import { codexReview } from "../codex-thread.ts";
import { FakeAdapter, type FakeStep } from "../fake.ts";
import { reviewTool } from "../reviews.ts";
import { Runtimes } from "../runtimes.ts";
import { testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
});

/** Lets the session manager work until `done` holds. */
async function until(done: () => boolean) {
  await vi.waitFor(() => expect(done()).toBe(true), { interval: 5, timeout: 5000 });
}

/**
 * `coderabbit` on the path, a script that says it started, waits for the test's go, then prints its
 * finding: it holds while the other reviewers work.
 */
function fakeCoderabbit() {
  const dir = join(
    tmpdir(),
    `uraeda-reviews-${process.pid}-${Math.random().toString(36).slice(2)}`,
  );
  const bin = join(dir, "bin");
  mkdirSync(bin, { recursive: true });
  const started = join(dir, "started");
  const go = join(dir, "go");
  const script = join(bin, "coderabbit");
  writeFileSync(
    script,
    `#!/bin/sh\ntouch '${started}'\nwhile [ ! -f '${go}' ]; do sleep 0.01; done\necho "- [P2] Reviewed with $*"\n`,
  );
  chmodSync(script, 0o755);
  vi.stubEnv("PATH", `${bin}${delimiter}${process.env.PATH ?? ""}`);
  return { go: () => writeFileSync(go, ""), started: () => existsSync(started) };
}

/** Steps that hold an agent reviewer's turn until the test opens it, then give its finding. */
function held(finding: string) {
  const gate = Promise.withResolvers<void>();
  const steps: Array<FakeStep> = [() => gate.promise, { text: finding, type: "text" }];
  return { open: () => gate.resolve(), steps };
}

/**
 * A feature's workflow session on `claude`, its turn held, with `options` as the feature's, and the
 * review tool the session calls. `claude` reviews as Claude Code does, `codex` as Codex does.
 */
async function reviewing(options: RunOptions) {
  const claude = new FakeAdapter();
  claude.reviewMessage = claudeReview;
  const codex = new FakeAdapter();
  codex.name = "Codex";
  codex.reviewMessage = codexReview;
  const off = new Set<string>();
  const runtimes = new Runtimes({ isOn: (name) => !off.has(name) });
  runtimes.register("claude", claude);
  runtimes.register("codex", codex);
  await runtimes.refreshModels();
  const mcp = { address: { url: "http://127.0.0.1:4000" }, tokens: new McpTokens() };
  const setup = await testSessions(undefined, { mcp, runOptions: () => options, runtimes });
  const { repo, sessions } = setup;
  const parent = await sessions.featureSession(repo, AGENT, { runtime: "claude" });
  const parentGate = held("Reviewing");
  claude.script(parentGate.steps);
  const workflow = { step: "plan", trigger: "manual" } as const;
  await sessions.send(repo, parent.id, { text: "Review the wave", workflow });
  const tool = reviewTool(sessions.reviews);
  const review = (input: Record<string, string>) =>
    tool.call(parent.id, input, new AbortController().signal);
  return { ...setup, claude, codex, off, parent, review };
}

/** The reviewers of US4: Claude Code at High, Codex, CodeRabbit, and a failing lint. */
const REVIEWERS: RunOptions = {
  reviewers: [
    { agent: "claude", effort: "high", model: "fake-big" },
    { agent: "codex", instructions: "Look at the error handling." },
    { command: "coderabbit review --plain" },
    { command: 'echo "lint failed" >&2; exit 3' },
  ],
  steps: [],
};

/** The sections of a findings file: each reviewer's name and text. */
function sectionsOf(file: string) {
  return file
    .split(/^## /m)
    .slice(1)
    .map((part) => {
      const [name, ...text] = part.split("\n");
      return [name, text.join("\n").trim()];
    });
}

test.each([
  {
    codex: ["Codex · Fake Big", "- [P3] An error is swallowed."],
    name: "",
    off: false,
  },
  {
    codex: ["Codex · Fake Big", "Did not review: Codex is not available on this machine."],
    name: ", but one whose agent is off",
    off: true,
  },
])("a review runs every reviewer at once and commits a section for each$name", async (row) => {
  const coderabbit = fakeCoderabbit();
  const { cache, claude, codex, off, parent, review, sessions } = await reviewing(REVIEWERS);
  if (row.off) {
    off.add("codex");
  }
  const claudeTurn = held("- [P1] The parser drops the last line.");
  const codexTurn = held("- [P3] An error is swallowed.");
  claude.script(claudeTurn.steps);
  codex.script(codexTurn.steps);

  const answer = review({ base: "abc123", head: "def456", reviewed: "branch" });
  // Every reviewer works at once: the agents hold their turns while the command runs.
  const agents = row.off ? 1 : 2;
  await until(() => {
    const subs = sessions.subSessions.ofParent(parent.id);
    return (
      coderabbit.started() &&
      subs.length === agents &&
      subs.every((sub) => cache.turns(sub.id).at(-1)?.state === "running")
    );
  });
  // The parent's watchdog waits while the review does.
  expect(sessions.subSessions.busy(parent.id)).toBe(true);
  const subs = sessions.subSessions.ofParent(parent.id);
  expect(subs.every((sub) => sub.role === "reviewer")).toBe(true);
  expect(claude.sent.at(-1)?.text).toMatch(/^\/code-review high abc123\.\.def456/);
  if (!row.off) {
    const codexMessage = codex.sent.at(-1);
    expect(codexMessage?.review).toBe(true);
    expect(codexMessage?.text).toContain("abc123..def456");
    expect(codexMessage?.text).toContain("Look at the error handling.");
  }
  claudeTurn.open();
  codexTurn.open();
  coderabbit.go();

  const said = await answer;
  const path = said.split("\n")[0];
  expect(path).toMatch(/findings-\d\d\.md$/);
  const file = readFileSync(path, "utf8");
  expect(said.slice(path.length).trim()).toBe(file.trim());
  expect(file).toMatch(/reviewed: branch/);
  expect(file).toMatch(/commits: abc123\.\.def456/);
  expect(sectionsOf(file)).toEqual([
    ["Claude Code · Fake Big", "- [P1] The parser drops the last line."],
    row.codex,
    ["coderabbit review --plain", "- [P2] Reviewed with review --plain"],
    ['echo "lint failed" >&2; exit 3', "lint failed\n\nexit code 3"],
  ]);
  expect(sessions.subSessions.busy(parent.id)).toBe(false);
});

test("a wave's review on a branch-only feature runs no reviewer", async () => {
  const { claude, parent, review, sessions } = await reviewing({
    ...REVIEWERS,
    reviewDepth: "branch",
  });
  const sent = claude.sent.length;

  const said = await review({ base: "abc123", head: "def456", reviewed: "wave 2" });

  expect(said).toBe("No review: this feature's reviews run on the branch only.");
  expect(sessions.subSessions.ofParent(parent.id)).toEqual([]);
  expect(claude.sent).toHaveLength(sent);
});
