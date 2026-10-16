// The git writes in flight, for the whole page: the one running, which blocks every other button
// that writes, and what each item's card shows that a button just started for it, "Committing…",
// until the server's status for the item changes, 10 seconds after the write ended, or the write
// fails. One write runs at a time, as the server takes one at a time.
import { useEffect, useSyncExternalStore } from "react";

/** A write: what its button reads while it runs, and the item it writes to, if any. */
export type Write = { folder?: string; label: string };

/** What a card shows for its item, and the server's status when it started, once a card drew it. */
type Pending = { label: string; status?: string; timer?: ReturnType<typeof setTimeout> };

/** How long a card shows an action, once its write ended, if the server's status stays the same. */
export const PENDING_MS = 10_000;

let running: Write | undefined;
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

/** Shows an action on a card, until the server's status for its item changes. */
function showPending(folder: string, label: string) {
  clearTimeout(pending.get(folder)?.timer);
  pending.set(folder, { label });
  changed();
}

/** Stops showing a card's action in a while, if nothing did sooner. */
function expireLater(folder: string) {
  const entry = pending.get(folder);
  if (entry) {
    clearTimeout(entry.timer);
    entry.timer = setTimeout(() => clearPending(folder), PENDING_MS);
  }
}

/**
 * Marks an action that is no git write on its item's card: "Starting the agent…", or "Stopping…",
 * until the server's status for it changes, or 10 seconds pass.
 */
export function markPending(folder: string, label: string) {
  showPending(folder, label);
  expireLater(folder);
}

/**
 * Runs a write: the other writing buttons are blocked while it runs, and the item's card shows its
 * label. A write that throws or resolves to `false` failed: the card shows the server's status
 * again.
 */
export async function runWrite<T>(write: Write, action: () => Promise<T>): Promise<T> {
  running = write;
  if (write.folder !== undefined) {
    showPending(write.folder, write.label);
  }
  changed();
  let failed = true;
  try {
    const result = await action();
    failed = result === false;
    return result;
  } finally {
    running = undefined;
    if (write.folder !== undefined) {
      if (failed) {
        clearPending(write.folder);
      } else {
        // The status a card saw while it ran stays the one it started from.
        expireLater(write.folder);
      }
    }
    changed();
  }
}

/** The write running, if any, and the function that runs one. */
export function useWrites() {
  const write = useSyncExternalStore(subscribe, () => running);
  return { run: runWrite, running: write };
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
