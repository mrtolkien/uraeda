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
import { deferCommits, land, type RunOptions, takeDeferred, workDir } from "uraeda-binding";
import { git, temporaryFolder } from "uraeda-binding/test-utils";
import { McpTokens } from "../../mcp/tokens.ts";
import { claudeReview } from "../claude.ts";
import { codexReview } from "../codex-thread.ts";
import { alive } from "./codex-stand-in.ts";
import { FakeAdapter, type FakeStep } from "../fake.ts";
import { reviewTool } from "../reviews.ts";
import { Runtimes } from "../runtimes.ts";
import { WriteQueue } from "../../writes/queue.ts";
import { testSessions } from "./helpers.ts";

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

/** The main checkouts whose commits a test deferred, as the server does for those it hosts. */
const deferring: Array<string> = [];

afterEach(() => {
  vi.useRealTimers();
  vi.unstubAllEnvs();
  for (const root of deferring.splice(0)) {
    deferCommits(root, false);
  }
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

/**
 * Steps that hold an agent's turn until the test opens it, then give its finding, or fails it: the
 * step throws, which ends the process, as a crash.
 */
function held(finding: string) {
  const gate = Promise.withResolvers<void>();
  const steps: Array<FakeStep> = [() => gate.promise, { text: finding, type: "text" }];
  return { fail: () => gate.reject(new Error("crashed")), open: () => gate.resolve(), steps };
}

/**
 * A feature's workflow session on `claude`, its turn held, with `options` as the feature's, and the
 * review tool the session calls. `claude` reviews as Claude Code does, `codex` as Codex does.
 * `hosted`, its repository defers its commits for a write queue, as the server's hosts do.
 */
async function reviewing(options: RunOptions, { hosted = false }: { hosted?: boolean } = {}) {
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
  let queue: WriteQueue | undefined;
  const setup = await testSessions(undefined, {
    mcp,
    queue: () => queue,
    runOptions: () => options,
    runtimes,
  });
  const { repo, sessions } = setup;
  if (hosted) {
    const root = await sessions.mainRoot(repo);
    deferCommits(root, true);
    deferring.push(root);
    const core = {
      land: (id: string, onOutput: (line: string) => void) => land(root, id, onOutput),
      takeDeferred: () => takeDeferred(root),
    };
    queue = new WriteQueue(core, () => {});
  }
  const parent = await sessions.featureSession(repo, AGENT, { runtime: "claude" });
  const parentGate = held("Reviewing");
  claude.script(parentGate.steps);
  const workflow = { step: "plan", trigger: "manual" } as const;
  await sessions.send(repo, parent.id, { text: "Review the wave", workflow });
  const tool = reviewTool(sessions.reviews);
  const review = (input: Record<string, string>, signal = new AbortController().signal) =>
    tool.call(parent.id, input, signal);
  // A range of the feature's worktree: its branch's start, and its last commit.
  const worktree = await workDir(repo, AGENT);
  const id = (revision: string) => git(worktree, "rev-parse", revision).trim();
  const range = { base: id("HEAD~1"), head: id("HEAD") };
  return { ...setup, claude, codex, id, off, parent, parentGate, range, review, worktree };
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
    hosted: false,
    name: "",
    off: false,
  },
  {
    codex: ["Codex · Fake Big", "Did not review: Codex is not available on this machine."],
    hosted: false,
    name: ", but one whose agent is off",
    off: true,
  },
  {
    codex: ["Codex · Fake Big", "- [P3] An error is swallowed."],
    hosted: true,
    name: ", through the write queue of a hosted repository",
    off: false,
  },
])("a review runs every reviewer at once and commits a section for each$name", async (row) => {
  const coderabbit = fakeCoderabbit();
  const setup = await reviewing(REVIEWERS, row);
  const { cache, claude, codex, off, parent, range, review, sessions } = setup;
  const commits = `${range.base}..${range.head}`;
  if (row.off) {
    off.add("codex");
  }
  const claudeTurn = held("- [P1] The parser drops the last line.");
  const codexTurn = held("- [P3] An error is swallowed.");
  claude.script(claudeTurn.steps);
  codex.script(codexTurn.steps);

  const answer = review({ base: range.base.slice(0, 7), head: "HEAD", reviewed: "branch" });
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
  expect(claude.sent.at(-1)?.text).toMatch(new RegExp(`^/code-review high ${commits}`));
  if (!row.off) {
    const codexMessage = codex.sent.at(-1);
    expect(codexMessage?.review).toBe(true);
    expect(codexMessage?.text).toContain(commits);
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
  expect(file).toContain(`commits: ${commits}`);
  expect(sectionsOf(file)).toEqual([
    ["Claude Code · Fake Big", "- [P1] The parser drops the last line."],
    row.codex,
    ["coderabbit review --plain", "- [P2] Reviewed with review --plain"],
    ['echo "lint failed" >&2; exit 3', "lint failed\n\nexit code 3"],
  ]);
  expect(sessions.subSessions.busy(parent.id)).toBe(false);
});

test("a wave's review on a branch-only feature runs no reviewer", async () => {
  const { claude, parent, range, review, sessions } = await reviewing({
    ...REVIEWERS,
    reviewDepth: "branch",
  });
  const sent = claude.sent.length;

  const said = await review({ ...range, reviewed: "wave 2" });

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
  {
    error: /no commit abc123/,
    input: { base: "abc123", head: "HEAD", reviewed: "branch" },
    name: "a `base` that names no commit",
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

test.each([
  { hosted: false, name: "are written", said: /^written, not committed: /, written: true },
  {
    hosted: true,
    name: "in a hosted repository are put back",
    said: /^not committed: /,
    written: false,
  },
])("findings a hook refuses $name, and the same review asked again commits them", async (row) => {
  const dir = temporaryFolder("uraeda-reviews");
  const runs = join(dir, "runs");
  const { repo, review, sessions } = await reviewing(
    {
      reviewers: [{ command: `echo run >> '${runs}'; echo "- [P2] A finding."` }],
      steps: [],
    },
    row,
  );
  const refuse = join(dir, "refuse");
  const hook = join(await sessions.mainRoot(repo), ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(
    hook,
    `#!/bin/sh\nif [ -e '${refuse}' ]; then echo "lint: 1 problem"; exit 1; fi\n`,
    { mode: 0o755 },
  );
  writeFileSync(refuse, "");
  const input = { base: "HEAD~1", head: "HEAD", reviewed: "wave 1" };
  const worktree = await workDir(repo, AGENT);
  const path = join(worktree, "specs", AGENT, "findings-01.md");

  const refused = await review(input);
  const said = row.written ? refused.slice(`${path}\n\n`.length) : refused;
  expect(refused.startsWith(path)).toBe(row.written);
  expect(said).toMatch(row.said);
  expect(said).toContain("lint: 1 problem");
  expect(existsSync(path)).toBe(row.written);
  expect(git(worktree, "log", "-1", "--format=%s").trim()).not.toMatch(/findings/);

  rmSync(refuse);
  const committed = await review(input);
  expect(committed.split("\n")[0]).toBe(path);
  expect(readFileSync(path, "utf8")).toContain("A finding.");
  expect(git(worktree, "log", "-1", "--format=%s").trim()).toBe("review(cli-tuis): findings 01");
  // The reviewers ran once: the call committed the findings the first one gave.
  expect(readFileSync(runs, "utf8")).toBe("run\n");
  expect(existsSync(path.replace("findings-01", "findings-02"))).toBe(false);
});

test("a review asked again by the same names after a new commit runs its agent reviewers again", async () => {
  const { claude, parent, review, sessions, worktree } = await reviewing({
    reviewers: [{ agent: "claude", model: "fake-big" }],
    steps: [],
  });
  const input = { base: "HEAD~1", head: "HEAD", reviewed: "branch" };
  claude.script([{ text: "- [P1] The first finding.", type: "text" }]);
  const first = await review(input);
  expect(first).toContain("The first finding.");

  git(worktree, "commit", "--quiet", "--allow-empty", "-m", "fix: the first finding");
  claude.script([{ text: "- [P2] The second finding.", type: "text" }]);
  const second = await review(input);

  expect(second).toContain("The second finding.");
  expect(sessions.subSessions.ofParent(parent.id)).toHaveLength(2);
});

type Reviewing = Awaited<ReturnType<typeof reviewing>>;

test.each([
  {
    end: (_: Reviewing, controller: AbortController) => controller.abort(),
    error: /cancelled/,
    name: "whose call is cancelled",
  },
  {
    end: ({ parent, repo, sessions }: Reviewing) => sessions.stop(repo, parent.id),
    error: /cancelled/,
    name: "whose parent is stopped",
  },
  {
    end: ({ parentGate }: Reviewing) => parentGate.fail(),
    error: /cancelled/,
    name: "whose parent's turn fails",
  },
])("a review $name ends its reviewers and writes no findings", async ({ end, error }) => {
  const dir = temporaryFolder("uraeda-reviews");
  const pidFile = join(dir, "pid");
  const setup = await reviewing({
    reviewers: [
      { agent: "claude", model: "fake-big" },
      { command: `echo $$ > '${pidFile}'; exec sleep 1000` },
    ],
    steps: [],
  });
  const { cache, claude, parent, range, repo, review, sessions } = setup;
  claude.script(held("- [P1] Never given.").steps);
  const controller = new AbortController();
  const answer = review({ ...range, reviewed: "branch" }, controller.signal);
  answer.catch(() => {});
  await until(
    () =>
      existsSync(pidFile) &&
      readFileSync(pidFile, "utf8").trim() !== "" &&
      sessions.subSessions
        .ofParent(parent.id)
        .some((sub) => cache.turns(sub.id).at(-1)?.state === "running"),
  );
  const pid = Number(readFileSync(pidFile, "utf8"));

  await end(setup, controller);

  await expect(answer).rejects.toThrow(error);
  expect(alive(pid)).toBe(false);
  const folder = join(await workDir(repo, AGENT), "specs", AGENT);
  expect(readdirSync(folder).filter((name) => name.startsWith("findings-"))).toEqual([]);
  if (!controller.signal.aborted) {
    // The parent's end stops its reviewers' sub-sessions too.
    for (const sub of sessions.subSessions.ofParent(parent.id)) {
      expect(sub.role).toBe("reviewer");
      expect(cache.turns(sub.id).at(-1)?.state).toBe("stopped");
    }
  }
});
