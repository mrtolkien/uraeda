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
import type { SessionFields } from "./cache-sessions.ts";
import type { NewPick } from "./session-folders.ts";
import { checkEffort, type Picked, type SessionPick } from "./picks.ts";
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
 * What a new session of `step`, a run step or a role, stores: its pick, refused for a model its
 * agent's last list no longer holds, or an effort the model does not take. Without a list, the
 * agent answers for the model. A session made for a run is refused too while its agent is not
 * available, `available`.
 */
function newPicked(
  context: SessionContext,
  step: StepId | "implementer",
  pick: StepPick,
  available = true,
): Picked {
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
  if (available) {
    checkAvailable(runtimes, pick.runtime);
  }
  return { agent: pick.runtime, effort, model };
}

/**
 * What a new session of the feature `folder`, in the main checkout `root`, runs on (the models
 * decision): `pick`, the human's, when it picks anything; else the pick of the run step its next
 * step belongs to, as a run of that step starts on, refused as a new session of it is; else, at a
 * step no agent runs, as a gate, or one that cannot be read, the agent's defaults.
 */
export async function newPickOf(
  context: SessionContext,
  root: string,
  folder: string,
  pick: SessionPick = {},
): Promise<NewPick> {
  if (pick.runtime !== undefined || pick.model !== undefined || pick.effort !== undefined) {
    return pick;
  }
  const next = await context.binding.nextStep(root, folder).catch(() => undefined);
  const runStep = next?.step.runStep;
  const fallback = agentsOf(context.runtimes, root).runtime();
  if (!isStepId(runStep) || fallback === undefined) {
    return pick;
  }
  const map = toMap(context.runOptions(root, folder), fallback);
  // Made before it runs, as any session: the send checks its agent is available.
  const picked = newPicked(context, runStep, runningPick(context, root, map.steps[runStep]), false);
  return () => picked;
}

/**
 * What a new implementer of the feature `folder`, in the main checkout `root`, runs on: the
 * feature's implementers' pick, the build's agent on its defaults when unset, refused as a run's
 * new session is. Its agent off runs it on the first runtime on, on that runtime's defaults.
 */
export function implementerPick(context: SessionContext, root: string, folder: string): Picked {
  const fallback = agentsOf(context.runtimes, root).runtime();
  if (fallback === undefined) {
    throw refused(REFUSALS.noRuntime);
  }
  const map = toMap(context.runOptions(root, folder), fallback);
  return newPicked(context, "implementer", runningPick(context, root, map.implementers));
}

/**
 * The effort a joined step runs on: its own, or the agent's default, null, when it picks none.
 * Refused when the session's model does not take it.
 */
function joinedEffort(context: SessionContext, row: SessionRow, pick: StepPick): SessionFields {
  const effort = pick.effort ?? null;
  if (effort === row.effort) {
    return {};
  }
  checkEffort(context.runtimes, row.agent, row.model, effort);
  return { effort };
}

/**
 * Where a workflow run goes: the session, and the fields it takes, written once the run is
 * delivered there, so a refused run changes nothing.
 */
export type RunPlace = { fields: SessionFields; live: Live };

/**
 * The session a workflow run of `runStep` goes to, from the feature's latest session `live`: that
 * one when it never ran, which then starts for `runStep` on the pick it was made on; that one when it runs
 * `runStep` already, whatever its pick; that one too when it runs on the step's agent and model,
 * and ran no workflow, which then starts for `runStep`, or its step's joint joins `runStep`, on the
 * step's effort, the agent's default when it picks none; else a new session of the feature on the
 * step's pick, which becomes its latest. `fresh` always starts a new one, once `live` ran. A step
 * whose agent is off runs on the first runtime on, on its defaults; a model its agent no longer
 * lists is refused. A new session is refused, before it exists, while a move holds `live`, or
 * another session of its folder works and `live` does not.
 */
export async function runSession(
  context: SessionContext,
  live: Live,
  runStep: StepId,
  fresh?: boolean,
): Promise<RunPlace> {
  const { cache, runtimes } = context;
  const row = rowOf(cache, live);
  const folder = live.folder as string;
  const ran = sessionStep(context, row);
  if (fresh !== true && ran === runStep) {
    return { fields: {}, live };
  }
  const agents = agentsOf(runtimes, live.repo);
  const map = toMap(context.runOptions(live.repo, folder), agents.runtime() ?? row.agent);
  const pick = runningPick(context, live.repo, map.steps[runStep]);
  if (cache.turns(live.id).length === 0) {
    // It never started: it starts on the pick it was made on, the human's or its step's.
    return { fields: row.step === runStep ? {} : { step: runStep }, live };
  }
  const current = { runtime: row.agent, ...(row.model === null ? {} : { model: row.model }) };
  const onPick = row.agent === pick.runtime && samePick(agents, current, pick);
  // A session that ran no step, as a chat moved to the feature, takes it on the step's pick.
  const joined =
    fresh !== true &&
    onPick &&
    (ran === undefined || (isStepId(ran) && stepSession(agents, map, ran, runStep)));
  if (joined) {
    const step = row.step === null ? { step: runStep } : {};
    return { fields: { ...joinedEffort(context, row, pick), ...step }, live };
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
  return { fields: {}, live: context.live.of(created) };
}
