import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join, relative } from "node:path";
import type { AgentEvent } from "uraeda-server/runner/events";
import { FakeAdapter, type FakeStep } from "uraeda-server/runner/fake";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { baselineFor } from "../baseline.ts";
import type { Case } from "../case.ts";
import type { Deps } from "../deps.ts";
import { git } from "../git.ts";
import { parseRecord, type RunRecord } from "../record.ts";
import { listRuns } from "../recorder.ts";
import { runFlow } from "../run-flow.ts";
import type { Sandbox } from "../sandbox.ts";
import type { Suite } from "../suite.ts";
import { pathWithFakeUra, repository, result, sh, temporary, view, write } from "./harness.ts";

afterEach(() => vi.unstubAllEnvs());

const PROPOSAL = "# Add a helper\n\n## Requirements\n\n- It MUST accept a list.\n";
const FETCHED = "https://docs.python.org/3/library/functions.html";
const JUDGE = [
  "```json",
  JSON.stringify({
    items: [{ line: "a list", requirement: "accepts a list", verdict: "covered" }],
  }),
  "```",
].join("\n");

const SUITE: Suite = {
  agent: "claude",
  arms: ["uraeda", "plain"],
  cases: ["c"],
  effort: "medium",
  human: { commit: "", effort: "medium", model: "claude-sonnet-5-5", path: "benchmarks/human.md" },
  maxSteps: 30,
  model: "claude-sonnet-5-5",
};

/** This repository's stand-in: the skill, the persona, a constitution, and the real `.gitignore`. */
function thisRepository() {
  const repo = repository();
  write(join(repo, "skills/uraeda/SKILL.md"), "committed skill");
  write(join(repo, "benchmarks/human.md"), "# Human\n");
  write(join(repo, "benchmarks/constitution.md"), "# Constitution\n");
  copyFileSync(
    join(import.meta.dirname, "../../../../benchmarks/.gitignore"),
    join(repo, "benchmarks/.gitignore"),
  );
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "init");
  return repo;
}

/** A sandbox as `prepareSandbox` leaves one: a checkout of the image, and a bare `origin`. */
function sandboxOf(): Sandbox {
  const work = temporary("flow-sandbox-");
  const repo = join(work, "repo");
  const bareOrigin = join(work, "origin.git");
  write(join(repo, "app.py"), "a\n");
  sh(repo, "init", "-q", "-b", "main");
  sh(repo, "config", "user.email", "t@example.com");
  sh(repo, "config", "user.name", "t");
  sh(repo, "add", "-A");
  sh(repo, "commit", "-q", "-m", "base");
  mkdirSync(bareOrigin);
  sh(bareOrigin, "init", "-q", "--bare");
  sh(repo, "remote", "add", "origin", bareOrigin);
  sh(repo, "push", "-q", "origin", "main");
  return {
    bareOrigin,
    base: sh(repo, "rev-parse", "HEAD"),
    close: async () => {},
    command: "claude",
    configDir: join(work, "config"),
    env: { CLAUDE_CONFIG_DIR: join(work, "config-host") },
    hostConfigDir: join(work, "config-host"),
    repo,
  };
}

type Options = { judgeModel?: string; passes?: boolean };

/** The agent's work in the checkout: a code change and a spec, pushed on the current branch. */
const work = (cwd: string) => {
  const branch = sh(cwd, "branch", "--show-current");
  write(join(cwd, "app.py"), "b\n");
  write(join(cwd, "specs", branch, "spec.md"), "accepts a list\n");
  sh(cwd, "add", "-A");
  sh(cwd, "commit", "-q", "-m", "work");
  sh(cwd, "push", "-q", "origin", branch);
};

/** Deps over fakes: a fake agent and judge, a fake sandbox, a verifier that reports what is asked. */
function harness(options: Options = {}) {
  const repo = thisRepository();
  const root = join(repo, "benchmarks");
  write(join(root, "cases/c/proposal.md"), PROPOSAL);
  const found: Case = {
    id: "c",
    image: "image@sha256:1",
    proposal: join(root, "cases/c/proposal.md"),
    repository: "/app",
    source: "swe-bench-pro-v2",
    task: "instance_x",
    upstream: "https://github.com/a/b",
  };
  const seen = { agentSkills: [] as Array<string>, events: [] as Array<string>, prepared: 0 };
  const deps: Deps = {
    adapter: (kind, sandbox, pluginDir) => {
      const adapter = new FakeAdapter();
      if (kind === "agent") {
        const skill = join(pluginDir, "skills/uraeda/SKILL.md");
        seen.agentSkills.push(existsSync(skill) ? readFileSync(skill, "utf8") : "none");
        const fetched: AgentEvent = {
          id: "f",
          input: {},
          kind: "fetch",
          name: "WebFetch",
          target: FETCHED,
          type: "toolStart",
        };
        const steps: Array<FakeStep> = [
          fetched,
          work,
          () => seen.events.push("agent worked"),
          result(),
        ];
        adapter.script(steps);
        // The raw transcript Claude Code keeps in its configuration folder, named by session.
        const open = adapter.open.bind(adapter);
        adapter.open = (opened) => {
          write(join(sandbox.configDir, "projects/p", `${opened.nativeId}.jsonl`), "{}\n");
          return open(opened);
        };
      } else {
        adapter.script([
          { text: JUDGE, type: "text" },
          result(options.judgeModel ? { models: [options.judgeModel] } : {}),
        ]);
      }
      return adapter;
    },
    claude: "/host/claude",
    docker: async (args) => {
      const logs = args.find((arg) => arg.endsWith(":/logs/verifier"))?.split(":")[0] ?? "";
      const names = options.passes === false ? [] : ["t::new"];
      writeFileSync(
        join(logs, "output.json"),
        JSON.stringify({ tests: names.map((name) => ({ name, status: "PASSED" })) }),
      );
      return "";
    },
    fetchTests: async (_task, folder) => {
      seen.events.push(`hidden tests fetched into ${folder}`);
      write(join(folder, "config.json"), JSON.stringify({ fail_to_pass: ["t::new"] }));
    },
    loop: {
      isPushed: async (cwd, branch) =>
        (await git(cwd, ["ls-remote", "origin", `refs/heads/${branch}`])).trim() !== "",
      next: async (cwd) => {
        const branch = sh(cwd, "branch", "--show-current");
        return { ...view("agent", "implementation", true), branch, feature: branch };
      },
    },
    now: () => new Date("2026-10-19T10:00:00Z"),
    prepareSandbox: async () => {
      seen.prepared++;
      return sandboxOf();
    },
    repository: repo,
    root,
  };
  const suite: Suite = {
    ...SUITE,
    human: { ...SUITE.human, commit: sh(repo, "rev-parse", "HEAD") },
  };
  vi.stubEnv("PATH", pathWithFakeUra());
  return { case: found, deps, repo, seen, suite };
}

const target = { approvedBy: "owner", suiteName: "first" };
const recordOf = (folder: string): RunRecord =>
  JSON.parse(readFileSync(join(folder, "record.json"), "utf8"));

test("a run starts nothing without a human's approval, and its record names who gave it", async () => {
  const h = harness();

  await expect(
    runFlow(h.deps, { approvedBy: " ", case: h.case, suite: h.suite, suiteName: "first" }),
  ).rejects.toThrow("approv");
  expect(h.seen.prepared).toBe(0);
  expect(listRuns(h.deps.root)).toEqual([]);

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });
  expect(recordOf(folder)["approved-by"]).toBe("owner");
});

test("a run records what it was made of, valid by the schema, and the work it graded", async () => {
  const h = harness();

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  const record = recordOf(folder);
  expect(() => parseRecord(record)).not.toThrow();
  expect(record).toMatchObject({
    effort: "medium",
    harness: { name: "fake" },
    human: { guidelines: h.suite.human.commit, model: "claude-sonnet-5-5" },
    models: { answered: ["claude-sonnet-5-5"], asked: "claude-sonnet-5-5" },
    outcome: "finished",
    repository: { commit: sh(h.repo, "rev-parse", "HEAD") },
    skill: { commit: sh(h.repo, "rev-parse", "HEAD"), dirty: false },
    task: { id: "instance_x", image: "image@sha256:1" },
    urls: [FETCHED],
  });
  expect(record.harness.version).not.toBe("");
  expect(record.steps.map((step) => step.role)).toEqual(["agent", "judge"]);
  expect(record.steps.every((step) => step.cost.kind === "reported")).toBe(true);
  // The hash of a transcript stays in the record, whose file git leaves out.
  expect(record.transcripts).toHaveLength(1);
  expect(readFileSync(join(folder, "specs/2026-10-19-c/proposal.md"), "utf8")).toBe(PROPOSAL);
  expect(readFileSync(join(folder, "final.diff"), "utf8")).toContain("app.py");
  expect(readFileSync(join(folder, "final.diff"), "utf8")).not.toContain("specs/");
  expect(JSON.parse(readFileSync(join(folder, "scores.json"), "utf8"))).toMatchObject({
    requirements: { covered: 1, total: 1 },
    tests: { resolved: true },
  });
  sh(h.repo, "add", "-A");
  expect(
    sh(h.repo, "ls-files")
      .split("\n")
      .some((file) => file.includes("transcripts")),
  ).toBe(false);
});

test("tests that do not pass leave the task unresolved", async () => {
  const h = harness({ passes: false });

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(JSON.parse(readFileSync(join(folder, "scores.json"), "utf8")).tests).toMatchObject({
    passed: 0,
    resolved: false,
  });
});

test("the hidden tests are fetched after the agent worked, into a folder outside its checkout", async () => {
  const h = harness();

  // No baseline run first, which would fetch its own tests before the flow's.
  await runFlow(h.deps, { ...target, case: h.case, suite: { ...h.suite, arms: ["uraeda"] } });

  const [worked, fetched] = h.seen.events;
  expect(worked).toBe("agent worked");
  const folder = (fetched ?? "").replace("hidden tests fetched into ", "");
  expect(folder).not.toBe("");
  expect(relative(h.repo, folder).startsWith("..")).toBe(true);
});

test("the agent loads the skill as the named commit had it, never from the working tree", async () => {
  const h = harness();
  writeFileSync(join(h.repo, "skills/uraeda/SKILL.md"), "edited, uncommitted");

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(h.seen.agentSkills).toContain("committed skill");
  expect(h.seen.agentSkills).not.toContain("edited, uncommitted");
  expect(recordOf(folder).skill.dirty).toBe(true);

  // A commit of the skill that does not exist stops the run before a session with a skill.
  const missing = harness();
  await expect(
    runFlow(
      { ...missing.deps, skillCommit: "nope" },
      { ...target, case: missing.case, suite: missing.suite },
    ),
  ).rejects.toThrow();
  expect(missing.seen.agentSkills).not.toContain("committed skill");
});

test("a judge session answered by another model fails the run", async () => {
  const h = harness({ judgeModel: "claude-haiku-4-5" });

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(recordOf(folder)).toMatchObject({
    models: { answered: ["claude-sonnet-5-5", "claude-haiku-4-5"] },
    outcome: "failed",
    reason: expect.stringContaining("claude-haiku-4-5"),
  });
});

test("a flow run is paired with a plain baseline made first, reused after, and never borrowed across models", async () => {
  const h = harness();
  const plainRuns = () => listRuns(h.deps.root).filter((run) => run.folder.includes("--plain--"));

  await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });
  await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(plainRuns()).toHaveLength(1);
  expect(listRuns(h.deps.root).filter((run) => run.folder.includes("--uraeda--"))).toHaveLength(2);
  expect(baselineFor(h.deps.root, h.case, h.suite)).toBeDefined();
  expect(
    baselineFor(h.deps.root, h.case, { ...h.suite, model: "claude-opus-5-5" }),
  ).toBeUndefined();
  expect(baselineFor(h.deps.root, h.case, { ...h.suite, effort: "high" })).toBeUndefined();
});
