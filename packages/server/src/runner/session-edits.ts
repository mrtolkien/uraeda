import type { SessionRow, TurnRow } from "./cache.ts";
import { chatTitle } from "./message.ts";
import {
  REFUSALS,
  refused,
  TAKEN_BACK,
  type SessionChange,
  type SessionContext,
} from "./session-state.ts";

/**
 * The human's edits of a session's stored fields, and of its turns: each call takes the session's
 * row, which `Sessions` checked is the repository's, and reports the change to `onChange`.
 */

type OnChange = (change: SessionChange) => void;

const now = () => new Date().toISOString();

/** Reports a change of the session's own fields. */
function report(onChange: OnChange, row: SessionRow) {
  onChange({ folder: row.folder, repo: row.repo, session: row.id });
}

/** Renames a session, by the title's first line that is not blank, cut at 80 characters. */
export function rename(
  context: SessionContext,
  onChange: OnChange,
  row: SessionRow,
  title: string,
): void {
  if (title.trim() === "") {
    throw refused(REFUSALS.blank);
  }
  context.cache.updateSession(row.id, { title: chatTitle(title) });
  report(onChange, row);
}

/** Archives a chat, or brings it back. */
export function archive(
  context: SessionContext,
  onChange: OnChange,
  row: SessionRow,
  archived: boolean,
): void {
  if (row.folder !== null) {
    throw new Error("a feature's session is not archived");
  }
  context.cache.updateSession(row.id, { archivedAt: archived ? now() : null });
  report(onChange, row);
}

/** Records that the human saw the session. */
export function seen(context: SessionContext, onChange: OnChange, row: SessionRow): void {
  context.cache.updateSession(row.id, { seenAt: now() });
  report(onChange, row);
}

/**
 * Dismisses a failed or stopped turn of the session's: it no longer asks for the human. Refused
 * while the turn runs or waits, and for a message taken back, which the status skips (`latestOf`);
 * a turn dismissed already, or done, is left as it is.
 */
export function dismiss(
  context: SessionContext,
  onChange: OnChange,
  session: SessionRow,
  turn: TurnRow,
): void {
  if (turn.state === "running" || turn.state === "queued") {
    throw refused(REFUSALS.stillRunning);
  }
  if (turn.state === "stopped" && turn.reason === TAKEN_BACK) {
    throw refused(REFUSALS.takenBack);
  }
  // A decision of its continue under way is dropped too.
  context.continuer.takenOver(session.id);
  if (context.cache.dismiss(turn.id)) {
    // Its state, failed or stopped, sends it at once, with the list, the feature, the workspace,
    // and what needs the human, and never reaches `onTurnDone`, which takes done turns only.
    onChange({
      folder: session.folder,
      repo: session.repo,
      session: session.id,
      state: turn.state,
      turn: turn.id,
    });
  }
}
