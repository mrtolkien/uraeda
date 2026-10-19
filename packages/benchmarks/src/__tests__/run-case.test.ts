import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { FakeAdapter, type FakeStep } from "uraeda-server/runner/fake";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { baselineFor } from "../baseline.ts";
import type { Case } from "../case.ts";
import type { Deps } from "../deps.ts";
import { git } from "../git.ts";
import { prepareCase, upstreamOf } from "../prepare-case.ts";
import { type Sandbox, prepareSandbox } from "../sandbox.ts";
import { runFlow } from "../run-flow.ts";
import { runPlain } from "../run-plain.ts";
import { chooseCases, screen, type Screened } from "../screen.ts";
import type { Suite } from "../suite.ts";
import { fakeBin } from "./fake-bin.ts";
import { result, view } from "./loop-helpers.ts";
import { temporary, write } from "./samples.ts";

afterEach(() => vi.unstubAllEnvs());

const PROPOSAL =
  "# Add a helper\n\nWord for word.\n\n## Requirements\n\n- It MUST accept a list.\n";
const CONFIG = JSON.stringify({ fail_to_pass: ["t::new"], pass_to_pass: ["t::old"] });

const SUITE: Suite = {
  agent: "claude",
  arms: ["uraeda", "plain"],
  cases: ["c"],
  effort: "medium",
  human: {
    commit: "abc123",
    effort: "medium",
    model: "claude-sonnet-5-5",
    path: "benchmarks/human.md",
  },
  maxSteps: 30,
  model: "claude-sonnet-5-5",
};

const JUDGE = [
  "```json",
  JSON.stringify({
    items: [{ line: "accepts a list", requirement: "accepts a list", verdict: "covered" }],
  }),
  "```",
].join("\n");

/** A repository standing for this one: the skill and the persona committed, and a constitution. */
async function thisRepository() {
  const repo = temporary("benchmarks-self-");
  await git(repo, ["init", "-q", "-b", "main"]);
  await git(repo, ["config", "user.email", "t@example.com"]);
  await git(repo, ["config", "user.name", "t"]);
  write(join(repo, "skills/uraeda/SKILL.md"), "skill");
  write(join(repo, "benchmarks/human.md"), "# Human\n");
  write(join(repo, "benchmarks/constitution.md"), "# Constitution\n");
  await git(repo, ["add", "-A"]);
  await git(repo, ["commit", "-q", "-m", "init"]);
  return repo;
}

type Harness = {
  agents: Array<FakeAdapter>;
  case: Case;
  deps: Deps;
  dockerCalls: () => Array<Array<string>>;
  plugins: Array<string>;
  prepared: () => number;
  repository: string;
  suite: Suite;
};

type HarnessOptions = {
  agentFetch?: string;
  finish?: boolean;
  judgeModel?: string;
  passes?: boolean;
};

/** The flow's agent works in the checkout: a code change, a spec, a push, and maybe a finish. */
function agentScript(options: HarnessOptions): Array<FakeStep> {
  return [
    ...(options.agentFetch
      ? [
          {
            id: "f1",
            input: {},
            kind: "fetch" as const,
            name: "WebFetch",
            target: options.agentFetch,
            type: "toolStart" as const,
          },
        ]
      : []),
    (cwd) => {
      const branch = execFileSync("git", ["branch", "--show-current"], {
        cwd,
        encoding: "utf8",
      }).trim();
      writeFileSync(join(cwd, "app.py"), "b\n");
      mkdirSync(join(cwd, "specs", branch), { recursive: true });
      writeFileSync(join(cwd, "specs", branch, "spec.md"), "accepts a list\n");
      execFileSync("git", ["add", "-A"], { cwd });
      execFileSync("git", ["commit", "-q", "-m", "work"], { cwd });
      execFileSync("git", ["push", "-q", "origin", branch], { cwd });
    },
    ...(options.finish ? [finish] : []),
    result(),
  ];
}

/** The judge answers with one covered requirement, as the model it is given. */
const judgeScript = (options: HarnessOptions): Array<FakeStep> => [
  { text: JUDGE, type: "text" },
  result(options.judgeModel ? { models: [options.judgeModel] } : {}),
];

/** Deps over fakes: the real sandbox on a fake docker and ura, a fake agent, and a verifier that passes. */
async function harness(options: HarnessOptions = {}): Promise<Harness> {
  const image = temporary("benchmarks-image-");
  write(join(image, "app.py"), "a\n");
  const bin = fakeBin(image);
  vi.stubEnv("PATH", bin.env.PATH ?? "");
  const repository = await thisRepository();
  const root = join(repository, "benchmarks");
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
  const agents: Array<FakeAdapter> = [];
  const plugins: Array<string> = [];
  let sandboxes = 0;
  const verifierCalls: Array<Array<string>> = [];
  const deps: Deps = {
    adapter: (kind, _sandbox, pluginDir) => {
      const adapter = new FakeAdapter();
      if (kind === "agent") {
        const skill = join(pluginDir, "skills/uraeda/SKILL.md");
        plugins.push(existsSync(skill) ? readFileSync(skill, "utf8") : "none");
        adapter.script(agentScript(options));
      } else {
        adapter.script(judgeScript(options));
      }
      agents.push(adapter);
      return adapter;
    },
    claude: "/host/claude",
    docker: async (args) => {
      verifierCalls.push(args);
      const logs = args.find((arg) => arg.endsWith(":/logs/verifier"))?.split(":")[0] ?? "";
      const names = options.passes === false ? [] : ["t::new", "t::old"];
      writeFileSync(
        join(logs, "output.json"),
        JSON.stringify({ tests: names.map((name) => ({ name, status: "PASSED" })) }),
      );
      return "";
    },
    fetchTests: async (_task, folder) => {
      mkdirSync(folder, { recursive: true });
      writeFileSync(join(folder, "config.json"), CONFIG);
    },
    loop: {
      isPushed: async (repo, branch) =>
        (await git(repo, ["ls-remote", "origin", `refs/heads/${branch}`])).trim() !== "",
      next: async (repo) => {
        const branch = (await git(repo, ["branch", "--show-current"])).trim();
        return {
          ...view("agent", "implementation", { implemented: true }),
          branch,
          feature: branch,
        };
      },
    },
    now: () => new Date("2026-10-19T10:00:00Z"),
    prepareSandbox: async (options: Parameters<Deps["prepareSandbox"]>[0]): Promise<Sandbox> => {
      sandboxes++;
      return prepareSandbox(options);
    },
    repository,
    root,
  };
  return {
    agents,
    case: found,
    deps,
    dockerCalls: () => verifierCalls,
    plugins,
    prepared: () => sandboxes,
    repository,
    // The persona is read from the commit the suite names: this repository's own.
    suite: {
      ...SUITE,
      human: { ...SUITE.human, commit: (await git(repository, ["rev-parse", "HEAD"])).trim() },
    },
  };
}

const target = { approvedBy: "owner", suiteName: "first" };

/** The finish step: the feature's folder becomes a record in `specs/done/`, and is pushed. */
const finish = (cwd: string) => {
  const branch = execFileSync("git", ["branch", "--show-current"], {
    cwd,
    encoding: "utf8",
  }).trim();
  mkdirSync(join(cwd, "specs/done"), { recursive: true });
  writeFileSync(join(cwd, "specs/done", `${branch}.md`), "record\n");
  execFileSync("git", ["rm", "-rq", `specs/${branch}`], { cwd });
  execFileSync("git", ["add", "-A"], { cwd });
  execFileSync("git", ["commit", "-q", "-m", "finish"], { cwd });
  execFileSync("git", ["push", "-q", "origin", branch], { cwd });
};

test("US1.1 and SC-001: one command from approval to a record, with the proposal word for word", async () => {
  const h = await harness();

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  const record = JSON.parse(readFileSync(join(folder, "record.json"), "utf8"));
  expect(record).toMatchObject({ "approved-by": "owner", outcome: "finished", version: 1 });
  expect(readFileSync(join(folder, "specs/2026-10-19-c/proposal.md"), "utf8")).toBe(PROPOSAL);
  expect(readFileSync(join(folder, "final.diff"), "utf8")).toContain("app.py");
  expect(readFileSync(join(folder, "final.diff"), "utf8")).not.toContain("specs/");
  const scores = JSON.parse(readFileSync(join(folder, "scores.json"), "utf8"));
  expect(scores).toMatchObject({
    requirements: { covered: 1, total: 1 },
    tests: { passed: 2, resolved: true, total: 2 },
  });
});

test("a run refuses to start without an approval, and starts nothing", async () => {
  const h = await harness();

  await expect(
    runFlow(h.deps, { approvedBy: "", case: h.case, suite: h.suite, suiteName: "first" }),
  ).rejects.toThrow("approval");
  expect(h.prepared()).toBe(0);
  expect(existsSync(join(h.deps.root, "runs"))).toBe(false);
});

test("the baseline is a new plain run, and a flow run reuses it afterwards", async () => {
  const h = await harness();

  await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });
  expect(h.prepared()).toBe(2);
  expect(baselineFor(h.deps.root, h.case, h.suite)?.record.steps[0]?.role).toBe("plain");

  await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });
  expect(h.prepared()).toBe(3);
});

test("the baseline is run again when the image's digest changed", async () => {
  const h = await harness();
  await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(baselineFor(h.deps.root, { ...h.case, image: "image@sha256:2" }, h.suite)).toBeUndefined();
});

test("a screening run is never the baseline", async () => {
  const h = await harness();
  await runPlain(h.deps, { ...target, case: h.case, suite: h.suite, suiteName: "screening" });

  expect(baselineFor(h.deps.root, h.case, h.suite)).toBeUndefined();
});

test("the plain arm's record has the tests only, and no skill", async () => {
  const h = await harness({ passes: false });

  const { folder } = await runPlain(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(JSON.parse(readFileSync(join(folder, "scores.json"), "utf8"))).toEqual({
    tests: { passed: 0, resolved: false, total: 2 },
  });
  expect(JSON.parse(readFileSync(join(folder, "record.json"), "utf8")).skill.commit).toBe("none");
});

/** A screened candidate of `repository`, failed or passing. */
const screened = (id: string, repository: string, passed: number, total = 10): Screened => ({
  case: { id, upstream: `https://github.com/${repository}` } as Case,
  tests: { passed, resolved: passed === total, total },
});

test("screening keeps the failed cases, from as many repositories as there are", () => {
  const chosen = chooseCases([
    screened("a1", "o/a", 3),
    screened("a2", "o/a", 2),
    screened("b1", "o/b", 4),
    screened("c1", "o/c", 1),
    screened("d1", "o/d", 5),
    screened("e1", "o/e", 6),
    screened("ok", "o/f", 10),
  ]);

  expect(chosen.chosen.map((c) => c.id)).toEqual(["c1", "a2", "b1", "d1", "e1"]);
  expect(chosen.repositories).toBe(5);
  expect(chosen.filled).toEqual([]);
});

test("with fewer than five failures, the lowest share of passed tests fills the suite, and is named", () => {
  const chosen = chooseCases([
    screened("f1", "o/a", 3),
    screened("f2", "o/b", 4),
    screened("p1", "o/c", 10),
    screened("p2", "o/d", 10),
    screened("p3", "o/e", 10),
    screened("p4", "o/f", 10),
  ]);

  expect(chosen.chosen).toHaveLength(5);
  expect(chosen.filled).toHaveLength(3);
  expect(chosen.chosen.slice(0, 2).map((c) => c.id)).toEqual(["f1", "f2"]);
});

test("a case whose reference patch fails the tests is dropped, and starts no plain run", async () => {
  const h = await harness({ passes: false });

  const screening = await screen(
    { ...h.deps, fetchGold: async () => "diff --git a/x b/x\n" },
    { ...target, candidates: [h.case], suite: h.suite },
  );

  expect(screening.dropped).toEqual(["c"]);
  expect(screening.results).toEqual([]);
  expect(h.prepared()).toBe(0);
});

test("a task's upstream is read from its instance ID, hyphens in the repository included", () => {
  expect(
    upstreamOf("instance_future-architect__vuls-0123456789abcdef0123456789abcdef01234567-v1"),
  ).toBe("https://github.com/future-architect/vuls");
  expect(() => upstreamOf("nope")).toThrow("instance ID");
});

test("a prepared case holds the instruction word for word, and the image as pulled", async () => {
  const root = temporary();
  const calls: Array<Array<string>> = [];

  const folder = await prepareCase({
    docker: async (args) => {
      calls.push(args);
      return args[0] === "inspect" ? "ghcr.io/x@sha256:9\n" : args[0] === "run" ? "/testbed\n" : "";
    },
    fetchInstruction: async () => PROPOSAL,
    id: "c",
    root,
    task: "instance_o__r-0123456789abcdef0123456789abcdef01234567-v1",
  });

  expect(readFileSync(join(folder, "proposal.md"), "utf8")).toBe(PROPOSAL);
  const text = readFileSync(join(folder, "case.toml"), "utf8");
  expect(text).toContain('image = "ghcr.io/x@sha256:9"');
  expect(text).toContain('repository = "/testbed"');
});

test("a plain session that did not finish is not counted as a failure in the screening", async () => {
  const h = await harness();
  const broken: Deps = {
    ...h.deps,
    adapter: (kind, sandbox, plugin) => {
      const adapter = new FakeAdapter();
      adapter.script([{ code: 1, stderr: "exec claude: no such file", type: "exit" }]);
      return kind === "agent" ? adapter : h.deps.adapter(kind, sandbox, plugin);
    },
  };

  const screening = await screen(
    { ...broken, fetchGold: async () => "diff --git a/x b/x\n" },
    { ...target, candidates: [h.case], suite: h.suite },
  );

  expect(screening).toMatchObject({ dropped: [], results: [], unrun: ["c"] });
});

test("failures come first even when passing cases would span more repositories", () => {
  const chosen = chooseCases([
    screened("f1", "o/a", 3),
    screened("f2", "o/a", 4),
    screened("f3", "o/a", 5),
    screened("f4", "o/b", 6),
    screened("f5", "o/b", 7),
    screened("f6", "o/c", 8),
    screened("p1", "o/d", 10),
    screened("p2", "o/e", 10),
  ]);

  expect(chosen.chosen.map((c) => c.id)).toEqual(["f1", "f4", "f6", "f2", "f3"]);
  expect(chosen).toMatchObject({ filled: [], repositories: 3 });
});

test("the spec and the folder are read from before the finish step replaced them with a record", async () => {
  const h = await harness({ finish: true });

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(readFileSync(join(folder, "specs/2026-10-19-c/spec.md"), "utf8")).toBe("accepts a list\n");
  expect(readFileSync(join(folder, "specs/done/2026-10-19-c.md"), "utf8")).toBe("record\n");
  expect(JSON.parse(readFileSync(join(folder, "scores.json"), "utf8")).requirements).toMatchObject({
    covered: 1,
  });
});

test("the agent loads the skill as the commit had it, not as the working tree has it", async () => {
  const h = await harness();
  writeFileSync(join(h.repository, "skills/uraeda/SKILL.md"), "edited, uncommitted");

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(h.plugins).toContain("skill");
  expect(h.plugins).not.toContain("edited, uncommitted");
  expect(JSON.parse(readFileSync(join(folder, "record.json"), "utf8")).skill.dirty).toBe(true);
});

test("a judge session answered by another model fails the run", async () => {
  const h = await harness({ judgeModel: "claude-haiku-4-5" });

  const folder = await runFlow(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(JSON.parse(readFileSync(join(folder, "record.json"), "utf8"))).toMatchObject({
    models: { answered: ["claude-sonnet-5-5", "claude-haiku-4-5"] },
    outcome: "failed",
    reason: expect.stringContaining("claude-haiku-4-5"),
  });
});

test("a plain run that fetches the upstream is flagged, as a flow run is", async () => {
  const h = await harness({ agentFetch: "https://github.com/a/b/pull/1" });

  const { folder } = await runPlain(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(JSON.parse(readFileSync(join(folder, "record.json"), "utf8")).flags).toEqual([
    "leak-suspected",
  ]);
});

test("a baseline made for another model or effort is not reused", async () => {
  const h = await harness();
  await runPlain(h.deps, { ...target, case: h.case, suite: h.suite });

  expect(baselineFor(h.deps.root, h.case, h.suite)).toBeDefined();
  expect(
    baselineFor(h.deps.root, h.case, { ...h.suite, model: "claude-opus-5-5" }),
  ).toBeUndefined();
  expect(baselineFor(h.deps.root, h.case, { ...h.suite, effort: "high" })).toBeUndefined();
});
