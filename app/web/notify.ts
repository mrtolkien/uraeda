// The browser's notifications, for the notifier (`screens/shell/Notifications.tsx`): where the
// Linux host sends to the desktop, a browser asks its owner first, once, and keeps the answer
// for the server's address. So the app asks the browser only after saying why, and never again
// once it refused: a refusal is the browser's to undo, in its site settings.
import { page } from "./page";

/** What the app reads of the browser's `Notification`. */
type Notifications = {
  new (
    title: string,
    options: { body: string; tag: string },
  ): { addEventListener(type: "click", listener: () => void): void };
  readonly permission: "default" | "denied" | "granted";
  requestPermission(): Promise<"default" | "denied" | "granted">;
};

/** The page's notifications, where the browser has them: a page served over plain HTTP has not. */
const notifications = (): Notifications | undefined =>
  (page() as unknown as { Notification?: Notifications }).Notification;

/** Whether this browser may still be asked, or already allows them. */
export const browserMayNotify = () => {
  const permission = notifications()?.permission;
  return permission === "default" || permission === "granted";
};

/** Asks the browser, which asks its owner unless they answered already: whether it allows them. */
export async function askBrowser(): Promise<boolean> {
  const asked = notifications();
  if (asked === undefined) return false;
  if (asked.permission !== "default") return asked.permission === "granted";
  return (await asked.requestPermission()) === "granted";
}

/** What the app reads of the page's service workers, which show notifications everywhere. */
type Shown = { body: string; data: { href: string }; tag: string };
type Registration = { showNotification(title: string, options: Shown): Promise<void> };
type Workers = {
  addEventListener(type: "message", listener: (event: { data: unknown }) => void): void;
  readonly ready: Promise<Registration>;
  register(url: string): Promise<unknown>;
};

/** The app's worker, `app/web/notify-worker.js`, beside the page. */
const WORKER = "/notify-worker.js";

/** The page's service workers, where the browser has them: a page over plain HTTP has not. */
const workers = (): Workers | undefined =>
  (page() as unknown as { navigator?: { serviceWorker?: Workers } }).navigator?.serviceWorker;

const warn = (error: unknown) => console.warn(`[notify] not shown: ${String(error)}`);

/** What a click on a notification opens: the last notifier's. */
let opening: ((href: string) => void) | undefined;
/** The worker, registered at the first notification, or `false` when it could not be. */
let worker: Promise<Registration> | false | undefined;

/** The worker that shows the notifications, registered once: none where the browser has none. */
function registered(): Promise<Registration> | undefined {
  const at = workers();
  if (worker !== undefined || at === undefined) return worker || undefined;
  // A click on a notification brings the tab up, and the worker says which address it names.
  at.addEventListener("message", (event) => {
    const said = event.data as { uraedaOpened?: unknown } | null;
    if (typeof said?.uraedaOpened === "string") opening?.(said.uraedaOpened);
  });
  worker = at.register(WORKER).then(() => at.ready);
  return worker;
}

/**
 * Shows a notification, whose click brings the tab up and calls `open` with `href`. Through the
 * app's service worker, since Chrome on Android and an installed web app refuse `new
 * Notification`, which a browser without workers still takes. It never throws: a notification
 * that cannot be shown is a warning in the console, never a break of the app.
 */
export function notifyBrowser(
  title: string,
  body: string,
  tag: string,
  href: string,
  open: (href: string) => void,
) {
  const allowed = notifications();
  if (allowed?.permission !== "granted") return;
  opening = (to) => {
    page().focus();
    open(to);
  };
  const shown = registered();
  if (shown !== undefined) {
    shown
      .then((at) => at.showNotification(title, { body, data: { href }, tag }))
      .catch((error: unknown) => {
        worker = false;
        warn(error);
      });
    return;
  }
  try {
    const notification = new allowed(title, { body, tag });
    notification.addEventListener("click", () => opening?.(href));
  } catch (error) {
    warn(error);
  }
}
