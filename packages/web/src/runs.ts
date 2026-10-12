// Starting an agent's run, the same way from every page that commits.
import type { useFateClient } from "react-fate";
import type { Trigger } from "uraeda-server/fate";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { RunView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A started run and what the page says of it, or the server's refusal. */
export type Started = { ok: true; run: string; message: string } | { ok: false; message: string };

/**
 * Starts the agent on the feature's next step, after a commit. `file` is the file the commit wrote,
 * which the run's message names.
 */
export async function startRun(
  fate: Fate,
  input: { folder: string; trigger: Trigger; file?: string },
): Promise<Started> {
  const result = await fate.mutations.run.start({ input, view: RunView });
  if (result.error) {
    return { ok: false, message: refusal(result.error).message };
  }
  const run = result.result as { id: string; step: string } | undefined;
  if (!run) {
    return { ok: false, message: "The run did not start." };
  }
  return {
    ok: true,
    run: run.id,
    message: `The agent is working on the ${stepLabel(run.step).toLowerCase()}.`,
  };
}
