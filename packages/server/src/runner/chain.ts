// The step chain: each workflow step is a run of its own, which ends with its step, and Uraeda starts
// the next step's run itself until the next human gate (the run options decision). A chained run is
// no automatic continue: it counts nothing toward the cap, and a run stopped never chains.
import { reasonOf } from "../reason.ts";
import type { TurnRow } from "./cache.ts";
import { recommendedMessage } from "./message.ts";
import { checkSend } from "./send-input.ts";
import { sendTo } from "./send.ts";
import { type Live, refused, rowOf, type SessionContext } from "./session-state.ts";

/** The agent a step's message is read for when the session it goes to checks its own agent. */
export const ANY_AGENT = { available: true, name: "" };

/**
 * Starts the next step's run as a step's run ends, before a gate, in the session the next step's
 * options give: `runSession`, through the send path every workflow message takes.
 */
export class Chain {
  #context: SessionContext;

  constructor(context: SessionContext) {
    this.#context = context;
  }

  /**
   * Starts the next step's run after `turn`, which just ended, when it was a workflow turn of a
   * feature's session, not a sub-session's, that ended done, with nothing queued after it, and the
   * feature now waits on the agent at another run step than the turn's. A promise while it reads
   * the feature and sends, the turn's end published once it settles; undefined when nothing
   * chains, so the session's status stays as the turn left it. A refused run leaves its reason as
   * the turn's last line. The human's Stop, or any takeover of the session's run, while it reads,
   * drops the send.
   */
  ended(live: Live, turn: TurnRow): Promise<void> | undefined {
    if (
      turn.state !== "done" ||
      turn.kind !== "workflow" ||
      turn.step === null ||
      live.folder === null ||
      live.queue.length > 0 ||
      rowOf(this.#context.cache, live).parent !== null
    ) {
      return undefined;
    }
    const taken = this.#context.continuer.takeovers(live.id);
    return this.#next(live, live.folder, turn.step, taken).catch((error: unknown) => {
      this.#context.cache.appendItem(turn.id, { kind: "system", text: reasonOf(error) });
    });
  }

  /**
   * Sends the next step's message after a run of `step`, when the feature moved on to another run
   * step that waits on the agent, and the session's run was not taken over since `taken`.
   */
  async #next(live: Live, folder: string, step: string, taken: number): Promise<void> {
    const { binding } = this.#context;
    const next = await binding.nextStep(live.repo, folder);
    const { runStep } = next.step;
    if (
      next.step.waitsOn !== "agent" ||
      runStep === undefined ||
      runStep === binding.runStepOf(step)
    ) {
      return;
    }
    const feature = await binding.readFeature(live.repo, folder);
    // The ended session's agent may not run the next step: the session it goes to checks its own.
    const message = recommendedMessage({ agent: ANY_AGENT, feature, next });
    if ("reason" in message) {
      throw refused(message.reason);
    }
    const workflow = { step: message.step, trigger: "next-step" } as const;
    const checked = checkSend({ text: message.text, workflow }, { images: false });
    await this.#context.live.serial(live, async () => {
      if (this.#context.continuer.takeovers(live.id) !== taken) {
        return undefined;
      }
      return sendTo(this.#context, live, checked);
    });
  }
}
