// The notifier (see `specs/decisions/notifications.md`): from the server's list of what needs the
// human across every repository, each item that comes to need them while the page is open notifies,
// once per key, from the one tab holding the Web Lock `uraeda.notify`, and only while no Uraeda tab
// is in front: a tab in front holds the shared lock `uraeda.front`. Without Web Locks, each tab
// notifies, and the notifications' tag, the item, folds them. The tab's title counts the items.
import { useEffect, useRef } from "react";
import { navigate } from "../routes.tsx";
import { notificationsSupported } from "./permission.ts";

/** An item that needs the human, as the server lists it. */
export type NeedsYouRow = { href: string; id: string; key: string; label: string; message: string };

/** The tab's own title, without the count. */
const titled = (title: string) => title.replace(/^\(\d+\) /, "");

/** Holds a lock until the returned function releases it. */
function hold(locks: LockManager, name: string, options: LockOptions, onHeld = () => {}) {
  const abort = new AbortController();
  const held = Promise.withResolvers<void>();
  locks
    .request(name, { ...options, signal: abort.signal }, () => {
      onHeld();
      return held.promise;
    })
    // Aborted before it was held: nothing to release.
    .catch(() => {});
  return () => {
    abort.abort();
    held.resolve();
  };
}

/** Whether a Uraeda tab is in front: this one, or one holding `uraeda.front`. */
async function inFront(locks: LockManager | undefined) {
  if (document.visibilityState === "visible") {
    return true;
  }
  const { held = [] } = (await locks?.query()) ?? {};
  return held.some((lock) => lock.name === "uraeda.front");
}

/** Shows a notification for each row; a click brings the tab to the front, on the item's page. */
function notify(rows: Array<NeedsYouRow>) {
  for (const row of rows) {
    const notification = new Notification(`${row.label} needs you`, {
      body: row.message,
      tag: row.id,
    });
    notification.onclick = () => {
      window.focus();
      navigate(row.href);
      notification.close();
    };
  }
}

/** This tab's part: the notifying lock, which only one tab holds, and the front lock while shown. */
function useLocks() {
  const locks = typeof navigator === "undefined" ? undefined : navigator.locks;
  // Without locks, every tab notifies.
  const leader = useRef(locks === undefined);
  useEffect(() => {
    if (!locks) {
      return;
    }
    const release = hold(locks, "uraeda.notify", {}, () => {
      leader.current = true;
    });
    return () => {
      leader.current = false;
      release();
    };
  }, [locks]);
  useEffect(() => {
    if (!locks) {
      return;
    }
    let release: (() => void) | undefined;
    const update = () => {
      if (document.visibilityState === "visible") {
        release ??= hold(locks, "uraeda.front", { mode: "shared" });
      } else {
        release?.();
        release = undefined;
      }
    };
    update();
    document.addEventListener("visibilitychange", update);
    return () => {
      document.removeEventListener("visibilitychange", update);
      release?.();
    };
  }, [locks]);
  return { leader, locks };
}

/** Notifies the rows that come to need the human, and counts them all in the tab's title. */
export function useNotifier(rows: ReadonlyArray<NeedsYouRow> | undefined) {
  const { leader, locks } = useLocks();
  // The keys seen since the page loaded: those there then never notify.
  const seen = useRef<Set<string>>(undefined);
  useEffect(() => {
    if (!rows) {
      return;
    }
    if (!seen.current) {
      seen.current = new Set(rows.map((row) => row.key));
      return;
    }
    const fresh = rows.filter((row) => !seen.current!.has(row.key));
    for (const row of fresh) {
      seen.current.add(row.key);
    }
    const allowed = notificationsSupported() && Notification.permission === "granted";
    if (fresh.length === 0 || !allowed || !leader.current) {
      return;
    }
    void inFront(locks).then((front) => {
      if (!front) {
        notify(fresh);
      }
    });
  }, [leader, locks, rows]);
  const count = rows?.length ?? 0;
  useEffect(() => {
    const own = titled(document.title);
    document.title = count > 0 ? `(${count}) ${own}` : own;
  }, [count]);
}
