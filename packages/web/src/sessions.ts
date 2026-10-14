// Sending to an agent's session, the same way from every page.
import type { useFateClient } from "react-fate";
import type { Trigger } from "uraeda-server/fate";
import { refusal } from "./errors.ts";
import { navigateHere } from "./routes.tsx";
import { SessionView } from "./views.ts";

type Fate = ReturnType<typeof useFateClient>;

/** A message sent, with its session's ID, or the server's refusal. */
export type Sent = { ok: true; session: string } | { message: string; ok: false };

/**
 * Sends a message: to a session, to a feature's session, created with its first message, or, with
 * neither, to a new chat. `workflow` makes it the workflow's message, which starts the feature's
 * step.
 */
export async function sendMessage(
  fate: Fate,
  input: {
    folder?: string;
    session?: string;
    text: string;
    workflow?: { file?: string; trigger: Trigger };
  },
): Promise<Sent> {
  let { session } = input;
  if (session === undefined && input.folder === undefined) {
    const created = await fate.mutations.session.newChat({ input: {}, view: SessionView });
    if (created.error) {
      return { message: refusal(created.error).message, ok: false };
    }
    session = (created.result as { id: string } | undefined)?.id;
    if (session === undefined) {
      return { message: "The chat did not start.", ok: false };
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
    return { message: refusal(result.error).message, ok: false };
  }
  const id = (result.result as { id: string } | undefined)?.id ?? session;
  return id === undefined
    ? { message: "The message was not sent.", ok: false }
    : { ok: true, session: id };
}

/** The address of a feature's session, within its repository. */
export function sessionPath(folder: string): string {
  return `/f/${encodeURIComponent(folder)}/session`;
}

/**
 * Hands the feature over to the agent: opens its session with the workflow's message in the
 * composer, unsent, for the human to read, edit, and send. `file` is the file the commit wrote,
 * which the message names.
 */
export function handOver(folder: string, trigger: Trigger, file?: string): void {
  const query = new URLSearchParams({ continue: trigger, ...(file === undefined ? {} : { file }) });
  navigateHere(`${sessionPath(folder)}?${query.toString()}`);
}

/**
 * Asks the agent about a block: opens the feature's session with the quote in the composer, before
 * what the human already typed, and an empty line for the question.
 */
export function askAbout(folder: string, quote: string): void {
  const query = new URLSearchParams({ ask: quote });
  navigateHere(`${sessionPath(folder)}?${query.toString()}`);
}

/** A quote of lines: a header, then each line after `> `. */
export function quoted(header: string, lines: ReadonlyArray<string>): string {
  return [header, ...lines.map((line) => `> ${line}`)].join("\n");
}
