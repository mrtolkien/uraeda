// Each step its own run (US2 of the run options): a run that ends before a gate starts the next
// step's run by itself, in the session its joint gives, on the step's pick; a run whose step did not
// move on, or that the human stopped, starts nothing, and a chained run counts no continue.
import { afterEach, expect, test, vi } from "vite-plus/test";
import type { NextStepView, NextView, RunOptions } from "uraeda-binding";
import type { Binding } from "../../fate/context.ts";
import { FakeAdapter } from "../fake.ts";
import { Runtimes } from "../runtimes.ts";
import { testSessions } from "./helpers.ts";

const binding = await import("uraeda-binding");

/** Waits on an agent, at step `plan`. */
const AGENT = "2026-10-12-cli-tuis";

afterEach(() => {
  vi.useRealTimers();
});

/** The steps a test moves the feature to, as the core reads them once a run committed its files. */
const STEPS = {
  approval: {
    name: "approval",
    reference: "skills/uraeda/references/plan.md",
    runStep: "plan",
    waitsOn: "agent",
  },
  implementation: {
    name: "implementation",
    reference: "skills/uraeda/references/implementation.md",
    runStep: "build",
    waitsOn: "agent",
  },
  spec: { name: "spec", reference: "skills/uraeda/references/spec.md", runStep: "spec" },
} satisfies Record<string, Partial<NextStepView>>;

/**
 * The real binding, but the feature's next step is `state.at` once a test sets it: a run moves the
 * feature on by setting it, as its commit would. Its reads wait on `state.held` while a test sets it,
 * and read no branch once `state.merged` is set.
 */
function stepped() {
  const state: { at?: Partial<NextStepView>; held?: Promise<void>; merged?: boolean } = {};
  const through: Binding = {
    ...binding,
    nextStep: async (repo: string, folder: string): Promise<NextView> => {
      await state.held;
      const { branch, ...next } = await binding.nextStep(repo, folder);
      const read = state.merged === true || branch === undefined ? next : { ...next, branch };
      return state.at === undefined
        ? read
        : { ...read, step: { ...read.step, waitsOn: "agent", ...state.at } };
    },
  };
  return { state, through };
}

/**
 * Two fake runtimes, `fake` first, then `other`, each on while `on` says so, both by default, whose
 * turns end at once, done, and their model lists read.
 */
async function twoRuntimes(on: Record<string, boolean> = {}) {
  const fake = new FakeAdapter();
  const other = new FakeAdapter();
  fake.fallback = () => [];
  other.fallback = () => [];
  const runtimes = new Runtimes({ isOn: (name) => on[name] ?? true });
  runtimes.register("fake", fake);
  runtimes.register("other", other);
  await runtimes.refreshModels();
  return { fake, other, runtimes };
}

/** How a plan run ends, besides moving the feature on to the build. */
type PlanEnd = {
  /** The plan's agent is gone, uninstalled, once its run ended: the `other` runtime is on. */
  gone?: boolean;
  /** The feature's branch is merged as the run ends. */
  merged?: boolean;
  /** The human stops the run as it runs, or, `reading`, once it ended, while the chain reads. */
  stop?: "running" | "reading";
};

/** A plan run on Fake Small, its build on `build`, sent and ended, the feature moved on to the build. */
async function planRun(build: RunOptions["steps"][number], { gone, merged, stop }: PlanEnd = {}) {
  const { fake, other, runtimes } = await twoRuntimes({ other: gone === true });
  const { state, through } = stepped();
  const options: RunOptions = { steps: [{ model: "fake-small", step: "plan" }, build] };
  const { cache, repo, sessions } = await testSessions(undefined, {
    binding: through,
    runOptions: () => options,
    runtimes,
  });
  const root = await sessions.mainRoot(repo);
  const plan = await sessions.featureSession(repo, AGENT, { model: "fake-small", runtime: "fake" });
  fake.script([
    async () => {
      state.at = STEPS.implementation;
      state.merged = merged;
      if (gone) {
        fake.installed = false;
        await runtimes.check();
      }
    },
    ...(stop === "running" ? [() => new Promise<void>(() => {})] : []),
  ]);
  const workflow = { step: "plan", trigger: "manual" } as const;
  const { turn } = await sessions.send(repo, plan.id, { text: "Write the plan", workflow });
  if (stop === "running") {
    await vi.waitFor(() => expect(state.at).toBe(STEPS.implementation));
    sessions.stop(repo, plan.id);
  }
  if (stop === "reading") {
    const held = Promise.withResolvers<void>();
    state.held = held.promise;
    await vi.waitFor(() => expect(cache.turn(turn)?.state).toBe("done"));
    sessions.stop(repo, plan.id);
    held.resolve();
  }
  await sessions.settled(turn);
  return { cache, fake, other, plan, root, sessions, turn };
}

test.each<[string, RunOptions["steps"][number], PlanEnd]>([
  ["on its pick", { effort: "high", model: "fake-big", step: "build" }, {}],
  ["a model gone", { model: "fake-gone", step: "build" }, {}],
  ["an agent off", { agent: "other", effort: "low", model: "other-big", step: "build" }, {}],
  ["stopped", { effort: "high", model: "fake-big", step: "build" }, { stop: "running" }],
  ["stopped once ended", { effort: "high", model: "fake-big", step: "build" }, { stop: "reading" }],
  ["the plan's agent gone", { agent: "other", model: "fake-small", step: "build" }, { gone: true }],
  ["merged", { effort: "high", model: "fake-big", step: "build" }, { merged: true }],
])(
  "a plan run that ends at the build starts the build's run in a new session on its pick (%s)",
  async (row, build, end) => {
    const { cache, fake, other, plan, root, sessions, turn } = await planRun(build, end);

    const latest = cache.latestSession(root, AGENT)!;
    if (row === "a model gone" || row === "merged" || row.startsWith("stopped")) {
      expect(latest.id).toBe(plan.id);
      expect(cache.turns(plan.id)).toHaveLength(1);
      // The chain's refusal is the plan run's last line: the human reads why the build waits.
      const last = cache.items(turn, 0, 100).at(-1);
      if (row === "a model gone" || row === "merged") {
        expect(last).toMatchObject({
          kind: "system",
          text:
            row === "merged"
              ? "This feature has no branch left: it is merged."
              : "Build runs on fake-gone, which Claude Code no longer lists.",
        });
      } else {
        expect(cache.turn(turn)?.state).toBe(row === "stopped" ? "stopped" : "done");
      }
      sessions.close();
      return;
    }
    expect(latest.id).not.toBe(plan.id);
    const picked = {
      "an agent off": { agent: "fake", effort: null, model: null },
      "on its pick": { agent: "fake", effort: "high", model: "fake-big" },
      "the plan's agent gone": { agent: "other", effort: null, model: "fake-small" },
    }[row];
    expect(latest).toMatchObject({ ...picked, step: "build" });
    const [chained] = cache.turns(latest.id);
    expect(chained).toMatchObject({
      kind: "workflow",
      step: "implementation",
      trigger: "next-step",
    });
    await sessions.settled(chained!.id);
    const builder = row === "the plan's agent gone" ? other : fake;
    expect(builder.sent.at(-1)?.text).toContain(
      ": Implement the plan, starting with skills/uraeda/references/implementation.md.\n" +
        "Stop when every task of the plan is checked, ",
    );
    expect(other.opens).toHaveLength(builder === other ? 1 : 0);
    // A chained run is no automatic continue: neither session counts one.
    expect(cache.session(plan.id)?.automaticContinues).toBe(0);
    expect(cache.session(latest.id)?.automaticContinues).toBe(0);
    // The build's run ended at the build, which it did not move on from: nothing more starts.
    expect(cache.folderSessions(root, AGENT)).toHaveLength(2);
    sessions.close();
  },
);

test("a model gone refuses the step's run with its name, the model, and the agent", async () => {
  const { cache, plan, root, sessions } = await planRun({ model: "fake-gone", step: "build" });
  const { repo } = cache.session(plan.id)!;
  const workflow = { step: "implementation", trigger: "manual" } as const;

  await expect(
    sessions.send(repo, plan.id, { text: "Implement the plan", workflow }),
  ).rejects.toThrow("refused: Build runs on fake-gone, which Claude Code no longer lists.");
  expect(cache.folderSessions(root, AGENT)).toHaveLength(1);
  sessions.close();
});

test.each(["with its step", "legacy, without a step"])(
  "a step joined to the one before runs in its session, on its own effort (%s)",
  async (row) => {
    const { fake, runtimes } = await twoRuntimes();
    const { state, through } = stepped();
    // Spec and Plan joined on Fake Big, at High then Medium.
    const options: RunOptions = {
      steps: [
        { effort: "high", model: "fake-big", step: "spec" },
        { effort: "medium", model: "fake-big", newSession: false, step: "plan" },
      ],
    };
    const { cache, repo, sessions } = await testSessions(undefined, {
      binding: through,
      runOptions: () => options,
      runtimes,
    });
    state.at = STEPS.spec;
    const pick = { effort: "high", model: "fake-big", runtime: "fake" };
    const spec = await sessions.featureSession(repo, AGENT, pick);
    const specRun = { step: "spec", trigger: "manual" } as const;
    const first = await sessions.send(repo, spec.id, { text: "Write the spec", workflow: specRun });
    await sessions.settled(first.turn);
    expect(cache.session(spec.id)?.step).toBe("spec");
    if (row !== "with its step") {
      cache.db.prepare("UPDATE sessions SET step = NULL WHERE id = ?").run(spec.id);
    }

    // The human approves the spec: the plan's run goes to the spec's session.
    state.at = STEPS.approval;
    const approval = { step: "approval", trigger: "approval" } as const;
    const sent = await sessions.send(repo, spec.id, { text: "Write the plan", workflow: approval });
    await sessions.settled(sent.turn);

    expect(sent.session).toBe(spec.id);
    expect(cache.session(spec.id)?.effort).toBe("medium");
    expect(fake.efforts.at(-1)).toBe("medium");
    expect(cache.folderSessions(await sessions.mainRoot(repo), AGENT)).toHaveLength(1);
    sessions.close();
  },
);

test("a run whose step did not move on starts nothing", async () => {
  const { fake, runtimes } = await twoRuntimes();
  const { through } = stepped();
  const { cache, repo, sessions } = await testSessions(undefined, { binding: through, runtimes });
  const session = await sessions.featureSession(repo, AGENT);
  const workflow = { step: "plan", trigger: "manual" } as const;

  const { turn } = await sessions.send(repo, session.id, { text: "Write the plan", workflow });
  await sessions.settled(turn);

  expect(cache.folderSessions(await sessions.mainRoot(repo), AGENT)).toHaveLength(1);
  expect(cache.turns(session.id)).toHaveLength(1);
  expect(fake.sent).toHaveLength(1);
  sessions.close();
});
