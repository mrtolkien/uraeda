// Sending to an agent's session, the same way from every page.
import type { useFateClient } from "react-fate";
import type { Trigger } from "uraeda-server/fate";
import { refusal } from "./errors.ts";
import { stepLabel } from "./labels.ts";
import { SessionView, WorkflowMessageView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A message sent, with its session's ID, or the server's refusal. */
export type Sent = { ok: true; session: string } | { ok: false; message: string };

/**
 * Sends a message: to a session, to a feature's session, created with its first message, or, with
 * neither, to a new chat. `workflow` makes it the workflow's message, which starts the feature's
 * step.
 */
export async function sendMessage(
  fate: Fate,
  input: {
    session?: string;
    folder?: string;
    text: string;
    workflow?: { trigger: Trigger; file?: string };
  },
): Promise<Sent> {
  let { session } = input;
  if (session === undefined && input.folder === undefined) {
    const created = await fate.mutations.session.newChat({ input: {}, view: SessionView });
    if (created.error) {
      return { ok: false, message: refusal(created.error).message };
    }
    session = (created.result as { id: string } | undefined)?.id;
    if (session === undefined) {
      return { ok: false, message: "The chat did not start." };
    }
  }
  const result = await fate.mutations.session.send({
    input: {
      ...(session === undefined ? { folder: input.folder } : { session }),
      text: input.text,
      ...(input.workflow === undefined ? {} : { workflow: input.workflow }),
    },
    view: SessionView,
  });
  if (result.error) {
    return { ok: false, message: refusal(result.error).message };
  }
  const id = (result.result as { id: string } | undefined)?.id ?? session;
  return id === undefined
    ? { ok: false, message: "The message was not sent." }
    : { ok: true, session: id };
}

/** A started step and what the page says of it, or the server's refusal. */
export type Started =
  | { ok: true; session: string; message: string }
  | { ok: false; message: string };

/**
 * TEMPORARY: replaced by `handOver` in task 10, which opens the session with the workflow's message
 * in the composer, unsent. Sends the workflow's message for the feature's next step at once, after
 * a commit. `file` is the file the commit wrote, which the message names.
 */
export async function startRun(
  fate: Fate,
  input: { folder: string; trigger: Trigger; file?: string },
): Promise<Started> {
  const id = [input.folder, input.trigger, ...(input.file === undefined ? [] : [input.file])].join(
    ":",
  );
  const { workflowMessage } = await fate.request(
    { workflowMessage: { id, view: WorkflowMessageView } },
    { mode: "network-only" },
  );
  const { data } = await fate.readView(WorkflowMessageView, workflowMessage);
  const message = data as unknown as { text: string; step: string; refusal: string | null } | null;
  if (!message) {
    return { ok: false, message: "The agent did not start." };
  }
  if (message.refusal !== null) {
    return { ok: false, message: message.refusal };
  }
  const sent = await sendMessage(fate, {
    folder: input.folder,
    text: message.text,
    workflow: { trigger: input.trigger, ...(input.file === undefined ? {} : { file: input.file }) },
  });
  return sent.ok
    ? {
        ok: true,
        session: sent.session,
        message: `The agent is working on the ${stepLabel(message.step).toLowerCase()}.`,
      }
    : sent;
}
