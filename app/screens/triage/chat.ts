// What the inbox asks an agent: to propose a triage, and to apply the human's answers. Each starts
// a chat in the main checkout with its message, on the agent a new session runs on, and opens it.
import { call, navigate } from "../../store";

/** The round's id, as `WorkflowFile` and `defaultRound.*` name it. */
export const TRIAGE_ID = "inbox-triage";

/** The message that asks an agent to propose a triage of the inbox. */
export const ORGANIZE_INBOX =
  "/uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.";

/** The message that asks an agent to apply the human's answers to the triage. */
export const APPLY_TRIAGE =
  "/uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.";

/** Starts a chat with `text` and opens it: rejects with the server's refusal, said by the caller. */
export async function startChat(repo: string, text: string) {
  const made = await call("session.newChat", { repo });
  await call("session.send", { repo, session: made.session, text });
  navigate({ id: made.session, page: "session-id", repo });
}
