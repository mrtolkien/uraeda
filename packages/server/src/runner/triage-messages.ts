// The two messages of the inbox's triage, which the skill's `references/inbox.md` answers: each
// starts a chat in the main checkout. Free of Node's modules, so the UI imports them as they are.

/** The message that asks an agent to propose a triage of the inbox (US4 1). */
export const ORGANIZE_INBOX =
  "/uraeda:uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.";

/** The message that asks an agent to apply the human's answers to the triage (US4 3). */
export const APPLY_TRIAGE =
  "/uraeda:uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.";
