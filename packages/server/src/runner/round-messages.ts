// The messages of the default branch's rounds, the inbox's triage (`references/inbox.md`) and the
// decisions check (`references/decisions-check.md`): each starts a chat in the main checkout. Free of
// Node's modules, so the UI imports them as they are. Also the one home of the rounds' ids and file
// names, which the server and the UI share.

/** The inbox's triage, among workflow files: the core's id for it, as it has no feature. */
export const TRIAGE_ID = "inbox-triage";

/** The decisions check, among workflow files, with an id of its own for the same reason. */
export const DECISIONS_CHECK_ID = "decisions-check";

/** The rounds on the default branch, each read and answered by the core's one code. */
export const DEFAULT_ROUND_IDS: ReadonlyArray<string> = [TRIAGE_ID, DECISIONS_CHECK_ID];

/** The name of a default-branch round's file, which an absent one is shown under. */
export const DEFAULT_ROUND_FILES: Readonly<Record<string, string>> = {
  [DECISIONS_CHECK_ID]: "DECISIONS-CHECK.md",
  [TRIAGE_ID]: "INBOX-TRIAGE.md",
};

/** The message that asks an agent to propose a triage of the inbox (US4 1). */
export const ORGANIZE_INBOX =
  "/uraeda Organize the inbox, specs/INBOX.md: propose a triage in specs/INBOX-TRIAGE.md, following references/inbox.md. Stop when the triage waits for my answers.";

/** The message that asks an agent to apply the human's answers to the triage (US4 3). */
export const APPLY_TRIAGE =
  "/uraeda Apply my answers in specs/INBOX-TRIAGE.md, following references/inbox.md.";

/** The message that asks an agent to check the decisions and write its questions. */
export const RUN_DECISIONS_CHECK =
  "/uraeda Check the decisions: write specs/DECISIONS-CHECK.md, following references/decisions-check.md. Stop when the check waits for my answers.";

/** The message that asks an agent to apply the human's answers to the decisions check. */
export const APPLY_DECISIONS_CHECK =
  "/uraeda Apply my answers in specs/DECISIONS-CHECK.md, following references/decisions-check.md.";
