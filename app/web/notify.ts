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

/** Shows a notification, whose click brings the tab up and calls `opened`. */
export function notifyBrowser(title: string, body: string, tag: string, opened: () => void) {
  const shown = notifications();
  if (shown?.permission !== "granted") return;
  const notification = new shown(title, { body, tag });
  notification.addEventListener("click", () => {
    page().focus();
    opened();
  });
}
