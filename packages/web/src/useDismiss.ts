// Dismiss, on a card and on a session's banner: a failed run, or one the human or the server
// stopped, asks for the human until they dismiss it (`specs/decisions/feature-status.md`). The
// server keeps the dismissal and sends every tab the status that follows.
import { useState } from "react";
import { useFateClient } from "react-fate";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import { refusal } from "./errors.ts";
import { SessionView } from "./views.ts";
import { clearPending, markPending } from "./writes/store.ts";

/** Why a run asks until dismissed: it failed, or the human or the server stopped it. */
const DISMISSABLE: ReadonlySet<StatusReason> = new Set(["failed", "interrupted", "stopped"]);

/** Whether a status asks until the human dismisses it, which Dismiss shows for. */
export function isDismissable(status: { reason?: StatusReason | null; status: SessionStatus }) {
  return status.status === "attention" && status.reason != null && DISMISSABLE.has(status.reason);
}

/**
 * Dismiss: `dismiss` sends the run's turn, and the session's status reads idle at once; on a card,
 * its `folder` shows "Dismissing…" until the server's status for it changes. `error` is why the
 * server refused it, for the caller to show next to its Dismiss.
 */
export function useDismiss() {
  const fate = useFateClient();
  const [error, setError] = useState<string>();
  const dismiss = async ({
    folder,
    session,
    turn,
  }: {
    folder?: string | undefined;
    session: string;
    turn: string;
  }) => {
    setError(undefined);
    if (folder !== undefined) {
      markPending(folder, "Dismissing…");
    }
    const result = await fate.mutations.session.dismiss({
      input: { turn },
      optimistic: { id: session, status: "idle", statusLabel: "Idle", statusReason: null },
      view: SessionView,
    });
    if (result.error) {
      if (folder !== undefined) {
        clearPending(folder);
      }
      setError(refusal(result.error).message);
    }
  };
  return { dismiss, error };
}
