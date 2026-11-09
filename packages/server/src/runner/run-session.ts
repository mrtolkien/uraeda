// Where a workflow run goes: the session of the step before it when their joint joins them and it
// runs on the step's agent and model, else a new session on the step's pick (the run options
// decision). The rule of which joints cut is `run-options.ts`'s, shared with the web UI's map.
import { randomUUID } from "node:crypto";
import { RUNTIME_REFUSALS } from "../limits.ts";
import {
  type Agents,
  type StepId,
  type StepPick,
  STEPS,
  samePick,
  stepSession,
  toMap,
} from "../run-options.ts";
import type { SessionRow } from "./cache.ts";
import { checkEffort, type Picked } from "./picks.ts";
import { checkAvailable, type Runtimes } from "./runtimes.ts";
import { type Live, REFUSALS, refused, rowOf, type SessionContext } from "./session-state.ts";

/** Whether `step` is one of the run steps, as the core names them. */
export function isStepId(step: string | null | undefined): step is StepId {
  return (STEPS as ReadonlyArray<string | null | undefined>).includes(step);
}

/**
 * How the runtimes of the main checkout `root` resolve a pick's defaults: the runtime picked while
 * it is registered and on there, else the first one on; and the model its last list says it runs
 * when none is picked.
 */
export function agentsOf(runtimes: Runtimes, root: string): Agents {
  return {
    defaultModel: (runtime) => runtimes.models(runtime)?.defaults.model,
    runtime: (chosen) =>
      chosen !== undefined && runtimes.get(chosen) !== undefined && runtimes.isOn(chosen, root)
        ? chosen
        : runtimes.defaultFor(root),
  };
}

/**
 * The run step a session runs: the one it started for, else, for a session started before steps
 * had sessions of their own, its latest workflow turn's. None for a session that ran no workflow.
 */
function sessionStep(context: SessionContext, row: SessionRow): string | undefined {
  if (row.step !== null) {
    return row.step;
  }
  const last = context.cache
    .turns(row.id)
    .filter((turn) => turn.kind === "workflow" && turn.step !== null)
    .at(-1);
  return last?.step == null ? undefined : (context.binding.runStepOf(last.step) ?? undefined);
}

/**
 * The pick a step runs on: its own while its agent is on in `root`, else the first runtime on there,
 * on that runtime's defaults. Refused when none is on.
 */
function runningPick(context: SessionContext, root: string, pick: StepPick): StepPick {
  const { runtimes } = context;
  if (runtimes.get(pick.runtime) !== undefined && runtimes.isOn(pick.runtime, root)) {
    return pick;
  }
  const first = runtimes.defaultFor(root);
  if (first === undefined) {
    throw refused(REFUSALS.noRuntime);
  }
  return { runtime: first };
}

/**
 * What a new session of `step` stores: its pick, refused for a model its agent's last list no
 * longer holds, or an effort the model does not take. Without a list, the agent answers for the
 * model.
 */
function newPicked(context: SessionContext, step: StepId, pick: StepPick): Picked {
  const { runtimes } = context;
  const model = pick.model ?? null;
  const effort = pick.effort ?? null;
  const list = runtimes.models(pick.runtime);
  if (model !== null && list !== undefined && !list.models.some((one) => one.id === model)) {
    const agent = runtimes.get(pick.runtime)?.name ?? runtimes.title(pick.runtime);
    const name = `${step.charAt(0).toUpperCase()}${step.slice(1)}`;
    throw refused(RUNTIME_REFUSALS.stepModelGone(name, model, agent));
  }
  checkEffort(runtimes, pick.runtime, model, effort);
  checkAvailable(runtimes, pick.runtime);
  return { agent: pick.runtime, effort, model };
}

/** Sets the session's effort to the step's for its next turn, when the step picks one. */
function takeEffort(context: SessionContext, live: Live, row: SessionRow, pick: StepPick): void {
  if (pick.effort === undefined || pick.effort === row.effort) {
    return;
  }
  checkEffort(context.runtimes, row.agent, row.model, pick.effort);
  context.cache.updateSession(row.id, { effort: pick.effort });
  context.changed(live);
}

/**
 * The session a workflow run of `runStep` goes to, from the feature's latest session `live`: that
 * one when it never ran, which then starts for `runStep` on the step's pick; that one when it runs
 * `runStep` already, whatever its pick, or ran no workflow, which then starts for `runStep`; that
 * one too when its step's joint joins `runStep` and it runs on the step's agent and model, its
 * effort set to the step's for the next turn; else a new session of the feature on the step's pick,
 * which becomes its latest. `fresh` always starts a new one, once `live` ran. A step whose agent is off runs on the
 * first runtime on, on its defaults; a model its agent no longer lists is refused. A new session is
 * refused, before it exists, while a move holds `live`, or another session of its folder works and
 * `live` does not.
 */
export async function runSession(
  context: SessionContext,
  live: Live,
  runStep: StepId,
  fresh?: boolean,
): Promise<Live> {
  const { cache, runtimes } = context;
  const row = rowOf(cache, live);
  const folder = live.folder as string;
  const ran = sessionStep(context, row);
  if (fresh !== true && (ran === undefined || ran === runStep) && cache.turns(live.id).length > 0) {
    if (row.step === null) {
      cache.updateSession(row.id, { step: runStep });
    }
    return live;
  }
  const agents = agentsOf(runtimes, live.repo);
  const map = toMap(context.runOptions(live.repo, folder), agents.runtime() ?? row.agent);
  const pick = runningPick(context, live.repo, map.steps[runStep]);
  if (cache.turns(live.id).length === 0) {
    // It never started: it starts on the step's pick.
    cache.updateSession(row.id, { ...newPicked(context, runStep, pick), step: runStep });
    context.changed(live);
    return live;
  }
  const current = { runtime: row.agent, ...(row.model === null ? {} : { model: row.model }) };
  const joined =
    fresh !== true &&
    isStepId(ran) &&
    stepSession(agents, map, ran, runStep) &&
    row.agent === pick.runtime &&
    samePick(agents, current, pick);
  if (joined) {
    takeEffort(context, live, row, pick);
    return live;
  }
  const picked = newPicked(context, runStep, pick);
  if (context.live.moving(live)) {
    throw refused(REFUSALS.agentWorking);
  }
  const behind = live.turn !== undefined || live.queue.length > 0;
  if (!behind && context.live.otherWorking(live, { queued: true })) {
    const { kind } = await context.binding.readFeature(live.repo, folder);
    throw refused(REFUSALS.otherWorking(kind));
  }
  const created = cache.createSession({
    ...picked,
    folder,
    nativeId: randomUUID(),
    repo: live.repo,
    step: runStep,
    title: null,
  });
  return context.live.of(created);
}
