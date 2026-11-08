// The agent runtimes as the views read them: every one registered, the one a session runs on by
// the name it stored, and the one a new session would run on, with why a message cannot go to it,
// in the server's words.
import { useState } from "react";
import { useLiveView, useRequest } from "react-fate";
import type { Agent } from "uraeda-server/fate";
import { RUNTIME_REFUSALS } from "uraeda-server/limits";
import { agentRequest, useFeature, useRefreshOnShow } from "./data.ts";
import type { SessionPick } from "./SessionPicker.tsx";
import { AgentView, SessionAgentView } from "./views.ts";

/** A runtime, as the server describes it, on or off in this repository. */
export type Runtime = Agent["runtimes"][number];

/**
 * The runtime a message would go to, when one is registered, and `off`, why none can take it: the
 * refusal the server would give, a runtime off here or missing, or none on.
 */
export type RuntimeChoice = { off?: string; runtime?: Runtime };

/** Every runtime registered, on or off here, in their order. */
export function useRuntimes(): ReadonlyArray<Runtime> {
  const request = agentRequest();
  const { agent } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(AgentView, agent)?.runtimes ?? [];
}

/** The runtimes a new session can run on here: those on, in their order. */
export function useRuntimesOn(): ReadonlyArray<Runtime> {
  return useRuntimes().filter((runtime) => runtime.isOn);
}

/**
 * The runtimes on here, `on`, and whether one of them runs on this machine, `available`: a new
 * session can start on any of them, picked as it starts.
 */
export function useRuntimesAvailable(): { available: boolean; on: ReadonlyArray<Runtime> } {
  const on = useRuntimes().filter((runtime) => runtime.isOn);
  return { available: on.some((runtime) => runtime.available), on };
}

/**
 * The runtime of a session, or of a feature's latest session, by the name it stored, `kind`: off
 * while it is off here or not registered. Without `kind`, the one a new session runs on: `picked`
 * while it is on, else the first one on.
 */
export function runtimeFor(
  runtimes: ReadonlyArray<Runtime>,
  kind?: string | null,
  picked?: string,
): RuntimeChoice {
  if (kind) {
    const runtime = runtimes.find((each) => each.kind === kind);
    if (runtime?.isOn) {
      return { runtime };
    }
    return {
      off: RUNTIME_REFUSALS.runtimeOff(runtime?.title ?? kind),
      ...(runtime ? { runtime } : {}),
    };
  }
  const on = runtimes.filter((each) => each.isOn);
  const runtime = on.find((each) => each.kind === picked) ?? on[0];
  return runtime ? { runtime } : { off: RUNTIME_REFUSALS.noRuntime };
}

/**
 * The name a new session's message sends, as the picker shows it: `picked` while it is on, else
 * the first one on, and nothing while none is. A pick turned off since is never sent.
 */
export function pickedRuntime(
  runtimes: ReadonlyArray<Runtime>,
  picked: string | undefined,
): string | undefined {
  return runtimeFor(runtimes, undefined, picked).runtime?.kind;
}

/** What a new session's input sends of the pick: its runtime, its model, and its effort. */
export type PickSent = { effort?: string; model?: string; runtime?: string };

/**
 * What a new session's input sends for `pick`: the runtime as `pickedRuntime` resolves it, and the
 * model and the effort only while that runtime is the one picked. A pick turned off since sends the
 * first runtime on, on its own defaults, never the old agent's model.
 */
export function pickSent(
  runtimes: ReadonlyArray<Runtime>,
  pick: SessionPick | undefined,
): PickSent {
  const runtime = pickedRuntime(runtimes, pick?.runtime);
  if (runtime === undefined) {
    return {};
  }
  if (runtime !== pick?.runtime) {
    return { runtime };
  }
  return {
    runtime,
    ...(pick.model === undefined ? {} : { model: pick.model }),
    ...(pick.effort === undefined ? {} : { effort: pick.effort }),
  };
}

/**
 * What a new session runs on: `pick`, what the human chose, for the picker's value, `setPick`, and
 * `sent`, what its input sends, `pickSent`'s.
 */
export function useSessionPick(): {
  pick: SessionPick | undefined;
  sent: PickSent;
  setPick: (pick: SessionPick) => void;
} {
  const [pick, setPick] = useState<SessionPick>();
  return { pick, sent: pickSent(useRuntimes(), pick), setPick };
}

/** `runtimeFor` over the runtimes read: a session's by its stored `kind`, else a new session's. */
export function useRuntime(kind?: string | null, picked?: string): RuntimeChoice {
  return runtimeFor(useRuntimes(), kind, picked);
}

/**
 * The runtime a feature's runs go to: its latest session's, else the one a new session runs on.
 */
export function useFeatureRuntime(folder: string): RuntimeChoice {
  return useRuntime(useFeature(folder)?.runtime);
}

/** The runtime a session runs on, by its ID: by the name it stored. */
export function useSessionRuntime(id: string): RuntimeChoice {
  const { session } = useRequest({ session: { id, view: SessionAgentView } });
  return useRuntime(useLiveView(SessionAgentView, session)?.agent);
}

/** Why no message can go to the runtime chosen now: off, or not available on this machine. */
export function runtimeRefusal({ off, runtime }: RuntimeChoice): string | undefined {
  if (off !== undefined) {
    return off;
  }
  return runtime?.available ? undefined : RUNTIME_REFUSALS.unavailable(runtime?.name ?? "");
}
