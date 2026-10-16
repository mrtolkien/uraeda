// Whether the banner that asks to notify shows, and what it says: the question while the browser
// never answered, until "Not now" or Dismiss, kept in this browser; then why notifications cannot
// show, once "Turn on" got its answer. A browser without notifications shows no banner: the tab's
// title still counts what waits.
import { useState } from "react";
import type { BannerState } from "./NotificationBanner.tsx";

/** Where "Not now" and Dismiss are kept: `"dismissed"`. */
const KEY = "uraeda.notifications";

/** Whether the browser shows notifications from a page. */
export const notificationsSupported = () => typeof globalThis.Notification === "function";

function dismissed() {
  try {
    return window.localStorage.getItem(KEY) === "dismissed";
  } catch {
    return false;
  }
}

/** The banner's first state: the question, while the browser never answered nor was it dismissed. */
function initialState(): BannerState | undefined {
  if (!notificationsSupported() || dismissed()) {
    return undefined;
  }
  return Notification.permission === "default" ? "ask" : undefined;
}

/** The banner's state, if it shows, and its actions. */
export function useNotificationBanner() {
  const [state, setState] = useState(initialState);
  const dismiss = () => {
    try {
      window.localStorage.setItem(KEY, "dismissed");
    } catch {
      // Private windows may refuse storage: the banner goes for this page's life.
    }
    setState(undefined);
  };
  const turnOn = async () => {
    let answer: NotificationPermission;
    try {
      // Asked only here, from the click: browsers ignore a question no click asked for.
      answer = await Notification.requestPermission();
    } catch {
      setState("unsupported");
      return;
    }
    if (answer === "granted") {
      new Notification("Notifications are on");
      setState(undefined);
    } else if (answer === "denied") {
      setState("blocked");
    }
  };
  return { dismiss, state, turnOn };
}
