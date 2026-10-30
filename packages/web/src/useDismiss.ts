// Dismiss, on a card and on a session's banner: a failed run, or one the human or the server
// stopped, asks for the human until they dismiss it (`specs/decisions/feature-status.md`). The
// server keeps the dismissal and sends every tab the status that follows.
import { useState, useSyncExternalStore } from "react";
import { useFateClient } from "react-fate";
import type { SessionStatus, StatusReason } from "uraeda-server/fate";
import { refusal } from "./errors.ts";
import { SessionView } from "./views.ts";

/** The turns being dismissed, by their feature's folder, until the server's status follows. */
const dismissing = new Map<string, string>();
const listeners = new Set<() => void>();
/** Moves with each change of `dismissing`, for its readers to draw again. */
let version = 0;

/** Sets or clears the turn being dismissed of `folder`'s feature, and tells the readers. */
function setDismissing(folder: string, turn: string | undefined) {
  if (turn === undefined) {
    dismissing.delete(folder);
  } else {
    dismissing.set(folder, turn);
  }
  version += 1;
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
  useSyncExternalStore(subscribe, () => version);
  if (dismissing.size === 0) {
    return features;
  }
  return features.map((feature) =>
    feature.status.status === "attention" &&
    feature.status.turn !== null &&
    dismissing.get(feature.folder) === feature.status.turn
      ? { ...feature, status: dismissedStatus(feature) }
      : feature,
  );
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
    if (folder !== undefined) {
      setDismissing(folder, turn);
    }
    const result = await fate.mutations.session.dismiss({
      input: { turn },
      optimistic: { id: session, status: "idle", statusLabel: "Idle", statusReason: null },
      view: SessionView,
    });
    // Refused, the feature's status is the server's again at once; accepted, the server's next
    // status replaces it, which no longer asks about the turn, or, at the latest, 10 seconds on.
    const forget = () => {
      if (folder !== undefined && dismissing.get(folder) === turn) {
        setDismissing(folder, undefined);
      }
    };
    if (result.error) {
      forget();
      setError(refusal(result.error).message);
    } else {
      setTimeout(forget, 10_000);
    }
  };
  return { dismiss, error };
}
