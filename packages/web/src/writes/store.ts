// What each item's card shows for an action started for it that is no git write, "Starting the
// agent…" or "Stopping…", until the server's status for the item changes, 10 seconds pass, or the
// action fails. Git writes show in the toast instead (`CommitToast.tsx`), and never block anything.
import { useEffect, useSyncExternalStore } from "react";

/** What a card shows for its item, and the server's status when it started, once a card drew it. */
type Pending = { label: string; status?: string; timer?: ReturnType<typeof setTimeout> };

/** How long a card shows an action, if the server's status stays the same. */
export const PENDING_MS = 10_000;

const pending = new Map<string, Pending>();
const listeners = new Set<() => void>();

const changed = () => {
  for (const listener of listeners) {
    listener();
  }
};

const subscribe = (listener: () => void) => {
  listeners.add(listener);
  return () => {
    listeners.delete(listener);
  };
};

/** Stops showing an action on a card: the action failed, or the server's status came. */
export function clearPending(folder: string) {
  const entry = pending.get(folder);
  if (!entry) {
    return;
  }
  clearTimeout(entry.timer);
  pending.delete(folder);
  changed();
}

/**
 * Marks an action that is no git write on its item's card: "Starting the agent…", or "Stopping…",
 * until the server's status for it changes, or 10 seconds pass.
 */
export function markPending(folder: string, label: string) {
  clearTimeout(pending.get(folder)?.timer);
  pending.set(folder, { label, timer: setTimeout(() => clearPending(folder), PENDING_MS) });
  changed();
}

/** Notes the server's status a card first drew an action with: the one it started from. */
function noteStatus(folder: string, status: string) {
  const entry = pending.get(folder);
  if (entry && entry.status === undefined) {
    entry.status = status;
  }
}

/**
 * What a card shows for its item while an action started for it, given the server's `status` for
 * it, or `undefined`. The status first drawn with the action is the one it started from: once the
 * server's differs, the action is done.
 */
export function usePendingAction(folder: string, status: string): string | undefined {
  const entry = useSyncExternalStore(subscribe, () => pending.get(folder));
  const moved = entry?.status !== undefined && entry.status !== status;
  useEffect(() => {
    if (moved) {
      clearPending(folder);
    } else if (entry) {
      noteStatus(folder, status);
    }
  }, [entry, folder, moved, status]);
  return entry && !moved ? entry.label : undefined;
}
