// The agent runtimes as the views read them: every one registered, the one a session runs on by
// the name it stored, and the one a new session would run on, with why a message cannot go to it,
// in the server's words.
import { useLiveView, useRequest } from "react-fate";
import type { Agent } from "uraeda-server/fate";
import { RUNTIME_REFUSALS } from "uraeda-server/limits";
import { agentRequest, useFeature, useRefreshOnShow } from "./data.ts";
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
