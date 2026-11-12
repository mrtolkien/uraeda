// The notifier (the notifications decision): from the server's list of what needs the human, in
// every repository (`NeedsYouList`, as the problems decision defines "needs you"), each item that
// comes to need them while the app is open tells them once, by its `key`, which changes with a new
// ask of the same item. The rule ported from the web notifier:
//
// - What needed them when the app started, or before, never tells: the first list read is seen.
// - An item tells once: a toast in the app, and, while the window is not focused, a notification of
//   the desktop, whose click brings the window up on the item's page.
// - Nothing tells about the page the human is looking at, the window focused.
// - The desktop's notifications are the app's own switch, kept on this device: Linux asks no
//   permission, so the app asks itself, once, after saying what will notify, at the first item
//   that comes; "Not now" is kept, and never asked again. The settings' Appearance changes it.
// - The window's title counts what needs the human.
//
// Only the app's Linux host sends to the desktop: a run without it, a test's or `just app-dev`'s,
// never reaches the desktop of the machine it runs on.
import { effect, host, lifecycle, signal, untracked, View } from "nsh";
import { isAvailable, Window } from "nsh/desktop";
import { nextNotificationClick, notifyDesktop } from "uraeda/native";
import { device, navigate, parseRoute, pathOf, record, route } from "../../store";
import type { NeedsYouRow } from "../../store/protocol";
import { Button, IconButton, Text } from "../../ui/controls";
import { Toast } from "../../ui/surfaces";

/** The asks shown at once, the newest first: more wait in the sidebar's Needs you. */
const SHOWN = 3;

/** The keys seen since the app started: `null` until the first list was read. */
let seen: Set<string> | null = null;
/** The items that came to need the human, as toasts, until opened, closed, or answered. */
const asks = signal<ReadonlyArray<NeedsYouRow>>([]);
/** The question about the desktop's notifications, once an item came and it was never answered. */
const question = signal(false);
/** What each desktop notification opens, by its id. */
const opens = new Map<number, string>();
let listening = false;

/** Whether the app runs in its Linux host, the one that may reach the desktop. */
const inHost = () => host.params.local !== undefined;

/** Whether the desktop's notifications are on, on this device. */
export const desktopNotifications = () => device.get("notifications") === true;

/** Turns the desktop's notifications on or off, on this device. */
export function setDesktopNotifications(on: boolean) {
  device.set("notifications", on);
  question.set(false);
}

/** Whether the human looks at `href` now: the window focused, on its page. */
const looksAt = (href: string) =>
  lifecycle() === "active" && pathOf(route()) === pathOf(parseRoute(href));

/** Opens the item of the next click, then waits for the one after. */
function nextClick() {
  nextNotificationClick()
    .then((id) => {
      const href = opens.get(id);
      if (href !== undefined) {
        if (isAvailable) Window.get("main")?.focus();
        navigate(parseRoute(href));
      }
      nextClick();
    })
    // No notification service: nothing was shown, so nothing is clicked.
    .catch(() => {
      listening = false;
    });
}

/** Opens the items the human clicks on the desktop: started with the first notification. */
function listen() {
  if (listening) return;
  listening = true;
  nextClick();
}

/** Tells the desktop about `row`, while the window is not focused. */
function toDesktop(row: NeedsYouRow) {
  if (!inHost() || !desktopNotifications() || lifecycle() === "active") return;
  notifyDesktop(`${row.label} needs you`, row.message)
    .then((id) => {
      opens.set(id, row.href);
      listen();
    })
    .catch(() => undefined);
}

/** Watches what needs the human, and tells of what comes. */
/** What needs the human, in every repository: read where the caller is drawn. */
const rows = () => record("NeedsYouList", null)()?.rows;

export function Notifier() {
  // Turned off, as the Notifications extension is in a repository, it forgets: turned on again, it
  // tells only of what comes after.
  effect(() => () => {
    seen = null;
    asks.set([]);
  });
  effect(() => {
    const now = rows();
    if (now === undefined) return;
    untracked(() => {
      if (seen === null) {
        seen = new Set(now.map((row) => row.key));
        return;
      }
      const fresh = now.filter((row) => !seen!.has(row.key));
      for (const row of fresh) seen.add(row.key);
      // What was answered goes; what came, unless looked at, tells.
      const keys = new Set(now.map((row) => row.key));
      const told = fresh.filter((row) => !looksAt(row.href));
      asks.set([...told.toReversed(), ...asks().filter((row) => keys.has(row.key))]);
      for (const row of told) toDesktop(row);
      if (told.length > 0 && inHost() && device.get("notifications") === undefined) {
        question.set(true);
      }
    });
  });
  // An ask goes once its page is opened.
  effect(() => {
    const here = pathOf(route());
    untracked(() => {
      const left = asks().filter((row) => pathOf(parseRoute(row.href)) !== here);
      if (left.length !== asks().length) asks.set(left);
    });
  });
  // The window's title counts what waits.
  effect(() => {
    const count = rows()?.length ?? 0;
    if (isAvailable) Window.get("main")?.set({ title: count > 0 ? `(${count}) Uraeda` : "Uraeda" });
  });
  return null;
}

const close = (key: string) => asks.set(asks().filter((row) => row.key !== key));

/** The toasts of what came to need the human, and the question about the desktop's. */
export function NeedsYouToasts() {
  return (
    <>
      <Each key={(row: NeedsYouRow) => row.key} of={asks().slice(0, SHOWN)}>
        {(row) => (
          <Toast icon="circle-dot" testID="needs-you-toast" title={`${row().label} needs you`}>
            <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
              <View style={{ flex: 1, gap: 2, minWidth: 0 }}>
                <Text lines={2}>{row().title}</Text>
                <Text size="under" tone="quiet">
                  {row().message}
                </Text>
              </View>
              <IconButton icon="x" label="Close" onPress={() => close(row().key)} />
            </View>
            <View style={{ alignItems: "flex-end" }}>
              <Button
                icon="arrow-right"
                label="Open"
                onPress={() => {
                  close(row().key);
                  navigate(parseRoute(row().href));
                }}
              />
            </View>
          </Toast>
        )}
      </Each>
      <If when={question()}>
        <Toast icon="message-square" testID="notify-question" title="Desktop notifications">
          <Text>
            Uraeda can tell you on this desktop when questions, a review, a pull request, or a
            blocked agent wait, while its window is in the background. A click opens what waits.
          </Text>
          <View style={{ flexDirection: "row", gap: 8, justifyContent: "flex-end" }}>
            <Button label="Not now" onPress={() => setDesktopNotifications(false)} />
            <Button label="Turn on" onPress={() => setDesktopNotifications(true)} />
          </View>
        </Toast>
      </If>
    </>
  );
}
