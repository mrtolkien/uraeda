import { RUNTIME_REFUSALS } from "../limits.ts";
import { effortName } from "./efforts.ts";
import { newSessionRuntime, type Runtimes } from "./runtimes.ts";
import { refused } from "./session-state.ts";

/**
 * What a session runs on, the one rule every start path shares: the agent, the model, and the
 * effort picked where it starts, each by the agent's ID, or none for the default.
 */

/** What the human picked where a session starts: each one left out for the default. */
export type SessionPick = { effort?: string; model?: string; runtime?: string };

/** The pick an input carries beside its other fields, `runtime`, `model`, and `effort`. */
export function pickOf({ effort, model, runtime }: SessionPick): SessionPick {
  return { effort, model, runtime };
}

/** What a new session stores: its runtime's name, and its model and effort, null for the agent's. */
export type Picked = { agent: string; effort: string | null; model: string | null };

/** The runtime's name for people, which its refusals name it by: its title once unregistered. */
function runtimeName(runtimes: Runtimes, agent: string): string {
  return runtimes.get(agent)?.name ?? runtimes.title(agent);
}

/**
 * What a new session of the main checkout `repo` runs on: the agent picked, else the first one on
 * there; the model and effort picked, else null, the agent's defaults. Refused for an agent off
 * there, a model its last list does not hold, none without a list, and an effort the model does not
 * take.
 */
export function newSessionPick(runtimes: Runtimes, repo: string, pick: SessionPick = {}): Picked {
  const agent = newSessionRuntime(runtimes, repo, pick.runtime);
  const model = pick.model ?? null;
  const effort = pick.effort ?? null;
  if (model !== null && !runtimes.models(agent)?.models.some((one) => one.id === model)) {
    throw refused(RUNTIME_REFUSALS.noModel(runtimeName(runtimes, agent), model));
  }
  checkEffort(runtimes, agent, model, effort);
  return { agent, effort, model };
}

/**
 * Refuses an effort the session's model, picked or the agent's default, does not take, by the
 * runtime's last list. The default effort, and a model the list does not hold, are not checked:
 * the agent answers for those.
 */
export function checkEffort(
  runtimes: Runtimes,
  agent: string,
  model: string | null,
  effort: string | null,
): void {
  const list = runtimes.models(agent);
  const id = model ?? list?.defaults.model;
  const known = list?.models.find((one) => one.id === id);
  if (effort === null || known === undefined) {
    return;
  }
  if (!known.efforts.some((one) => one.id === effort)) {
    throw refused(RUNTIME_REFUSALS.noEffort(known.name, effortName(effort)));
  }
}
