// The reviewers of a feature (US4 of the run options): the `review` tool runs every reviewer of the
// feature at once, agents through their own review in sub-sessions, commands in the feature's
// worktree, and commits a section for each in `findings-NN.md`, before the build fixes them.
import {
  chmodSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { delimiter, dirname, join } from "node:path";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { type RunOptions, workDir } from "uraeda-binding";
import { git, temporaryFolder } from "uraeda-binding/test-utils";
import { McpTokens } from "../../mcp/tokens.ts";
import { claudeReview } from "../claude.ts";
import { codexReview } from "../codex-thread.ts";
import { alive } from "./codex-stand-in.ts";
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
  const review = (input: Record<string, string>, signal = new AbortController().signal) =>
    tool.call(parent.id, input, signal);
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
  const round = /findings-(\d\d)\.md$/.exec(path)![1];
  const worktree = dirname(dirname(dirname(path)));
  expect(git(worktree, "log", "-1", "--format=%s").trim()).toBe(
    `review(cli-tuis): findings ${round}`,
  );
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

test.each([
  {
    error: /`reviewed`/,
    input: { base: "abc123", head: "def456", reviewed: "wave two" },
    name: "a `reviewed` neither the branch nor a wave",
  },
  {
    error: /`base`/,
    input: { base: "abc123 --all", head: "def456", reviewed: "branch" },
    name: "a `base` of two words",
  },
  {
    error: /`head`/,
    input: { base: "abc123", head: "def456\nmain", reviewed: "branch" },
    name: "a `head` of two lines",
  },
  {
    error: /`head`/,
    input: { base: "abc123", head: "HEAD: x", reviewed: "branch" },
    name: "a `head` with a colon",
  },
])("a review asked with $name is refused before any reviewer runs", async ({ error, input }) => {
  const coderabbit = fakeCoderabbit();
  const { claude, parent, review, sessions } = await reviewing(REVIEWERS);
  const sent = claude.sent.length;

  await expect(review(input)).rejects.toThrow(error);

  expect(sessions.subSessions.ofParent(parent.id)).toEqual([]);
  expect(claude.sent).toHaveLength(sent);
  expect(coderabbit.started()).toBe(false);
});

test("findings a hook refuses are written, and the same review asked again commits them", async () => {
  const dir = temporaryFolder("uraeda-reviews");
  const runs = join(dir, "runs");
  const { repo, review, sessions } = await reviewing({
    reviewers: [{ command: `echo run >> '${runs}'; echo "- [P2] A finding."` }],
    steps: [],
  });
  const refuse = join(dir, "refuse");
  const hook = join(await sessions.mainRoot(repo), ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\nif [ -e '${refuse}' ]; then echo "lint: 1 problem"; exit 1; fi\n`,
    { mode: 0o755 },
  );
  writeFileSync(refuse, "");
  const input = { base: "abc123", head: "def456", reviewed: "wave 1" };

  const refused = await review(input);
  const [path, said] = refused.split("\n\n");
  expect(path).toMatch(/findings-01\.md$/);
  expect(said).toMatch(/^written, not committed: /);
  expect(said).toContain("lint: 1 problem");
  expect(readFileSync(path, "utf8")).toContain("A finding.");
  const worktree = dirname(dirname(dirname(path)));
  expect(git(worktree, "log", "-1", "--format=%s").trim()).not.toMatch(/findings/);

  rmSync(refuse);
  const committed = await review(input);
  expect(committed.split("\n")[0]).toBe(path);
  expect(git(worktree, "log", "-1", "--format=%s").trim()).toBe("review(cli-tuis): findings 01");
  // The reviewers ran once: the call committed the file the first one wrote.
  expect(readFileSync(runs, "utf8")).toBe("run\n");
  expect(existsSync(path.replace("findings-01", "findings-02"))).toBe(false);
});

test("a review whose call is cancelled ends its command reviewers and writes no findings", async () => {
  const dir = temporaryFolder("uraeda-reviews");
  const pidFile = join(dir, "pid");
  const { repo, review } = await reviewing({
    reviewers: [{ command: `echo $$ > '${pidFile}'; exec sleep 1000` }],
    steps: [],
  });
  const controller = new AbortController();
  const answer = review({ base: "abc123", head: "def456", reviewed: "branch" }, controller.signal);
  await until(() => existsSync(pidFile) && readFileSync(pidFile, "utf8").trim() !== "");
  const pid = Number(readFileSync(pidFile, "utf8"));

  controller.abort();

  await expect(answer).rejects.toThrow(/cancelled/);
  expect(alive(pid)).toBe(false);
  const folder = join(await workDir(repo, AGENT), "specs", AGENT);
  expect(readdirSync(folder).filter((name) => name.startsWith("findings-"))).toEqual([]);
});
