// Dismiss, on a card and on a session's banner: a failed run, or one the human or the server
// stopped, asks for the human until they dismiss it (`specs/decisions/feature-status.md`). The
// server keeps the dismissal and sends every tab the status that follows.
import { useState, useSyncExternalStore } from "react";
import { useFateClient } from "react-fate";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import { guarded, refusal } from "./errors.ts";
import { SessionView } from "./views.ts";

/** A feature's dismissal: the turn it dismisses, and, once the server refused it, why. */
type Dismissal = { refused?: string; turn: string };

/**
 * The features' dismissals, by their folder: pending until the server's status follows, or
 * refused. Kept here, not in a card, which moves between panes as its status changes. Replaced
 * whole on each change: its readers draw from the value they are given, which memoized code tracks.
 */
let dismissals: ReadonlyMap<string, Dismissal> = new Map();
const listeners = new Set<() => void>();

/** Sets or clears the dismissal of `folder`'s feature, and tells the readers. */
function setDismissal(folder: string, dismissal: Dismissal | undefined) {
  const next = new Map(dismissals);
  if (dismissal === undefined) {
    next.delete(folder);
  } else {
    next.set(folder, dismissal);
  }
  dismissals = next;
  for (const listener of listeners) {
    listener();
  }
}

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** A feature's status, as the navigation reads it. */
type Status = {
  label: string;
  reason: StatusReason | null;
  session: string | null;
  status: SessionStatus;
  turn: string | null;
};

/**
 * `features` as a dismissal pending leaves them, at once: a feature whose status still asks about
 * the turn being dismissed reads "Needs you" when its step waits on the human, else "Idle", as the
 * server will once it answers. `features` itself while none is pending.
 */
export function useDismissed<
  Feature extends { folder: string; status: Status; step: { waitsOn?: string | null } },
>(features: Array<Feature>): Array<Feature> {
  const shown = useSyncExternalStore(subscribe, () => dismissals);
  if (shown.size === 0) {
    return features;
  }
  return features.map((feature) => {
    const dismissal = shown.get(feature.folder);
    return feature.status.status === "attention" &&
      dismissal?.refused === undefined &&
      dismissal?.turn === feature.status.turn
      ? { ...feature, status: dismissedStatus(feature) }
      : feature;
  });
}

/**
 * Why the server refused the dismissal of `folder`'s feature, while its status still asks about
 * the turn it was refused for; else `undefined`.
 */
export function useRefusal(
  folder: string,
  status: { reason?: StatusReason | null; status: SessionStatus; turn: string | null },
): string | undefined {
  const dismissal = useSyncExternalStore(subscribe, () => dismissals).get(folder);
  return dismissal?.turn === status.turn && isDismissable(status) ? dismissal.refused : undefined;
}

/** The status a feature's dismissed run leads to: "Needs you" at a step on the human, else "Idle". */
function dismissedStatus(feature: { status: Status; step: { waitsOn?: string | null } }): Status {
  const { session, turn } = feature.status;
  return feature.step.waitsOn === "human"
    ? { label: "Needs you", reason: "step", session, status: "needs-you", turn }
    : { label: "Idle", reason: null, session, status: "idle", turn };
}

/** Why a run asks until dismissed: it failed, or the human or the server stopped it. */
const DISMISSABLE: ReadonlySet<StatusReason> = new Set(["failed", "interrupted", "stopped"]);

/** Whether a status asks until the human dismisses it, which Dismiss shows for. */
export function isDismissable(status: { reason?: StatusReason | null; status: SessionStatus }) {
  return status.status === "attention" && status.reason != null && DISMISSABLE.has(status.reason);
}

/**
 * Dismiss: `dismiss` sends the run's turn, and the session's status reads idle at once, and its
 * feature's, of `folder`, the status it leads to, until the server's follows. `error` is why the
 * server refused it, for the caller to show next to its Dismiss, the statuses put back.
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
    const pending: Dismissal = { turn };
    if (folder !== undefined) {
      setDismissal(folder, pending);
    }
    // A lost connection rejects the call: it is shown as a refusal.
    const result = await guarded(() =>
      fate.mutations.session.dismiss({
        input: { turn },
        optimistic: { id: session, status: "idle", statusLabel: "Idle", statusReason: null },
        view: SessionView,
      }),
    );
    // Refused, the feature's status is the server's again at once, with why; accepted, the
    // server's next status replaces it, which no longer asks about the turn, or, at the latest,
    // 10 seconds on.
    const message = result.error ? refusal(result.error).message : undefined;
    setError(message);
    if (folder === undefined || dismissals.get(folder) !== pending) {
      return;
    }
    if (message !== undefined) {
      setDismissal(folder, { refused: message, turn });
    } else {
      setTimeout(
        () => dismissals.get(folder) === pending && setDismissal(folder, undefined),
        10_000,
      );
    }
  };
  return { dismiss, error };
}
