// US6 of the interface's redesign: the banner that asks to notify, and the notifier, which notifies
// each item that comes to need the human while no Uraeda tab is in front, from one tab, and counts
// what waits in the tab's title. The browser's `Notification`, Web Locks, and visibility are fakes.
import { act, renderHook, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { type NeedsYouRow, useNotifier } from "../notify/useNotifier.ts";
import { click, homeShown, renderPage, refreshUntil } from "./helpers.tsx";

/** The notifications shown, and the browser's answer to the question. */
const shown: Array<FakeNotification> = [];
let permission: NotificationPermission = "default";
let answer: NotificationPermission = "granted";
const asked = vi.fn();

class FakeNotification {
  static get permission() {
    return permission;
  }
  static async requestPermission() {
    asked();
    permission = answer;
    return answer;
  }
  onclick: (() => void) | null = null;
  close = vi.fn();
  readonly title: string;
  readonly options: NotificationOptions;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    shown.push(this);
  }
}

/** Web Locks, one origin's: exclusive locks queue, shared ones are held together. */
function fakeLocks() {
  type Held = { mode: LockMode; name: string };
  const held: Array<Held> = [];
  const waiting: Array<{ grant: () => void; name: string }> = [];
  const grantNext = (name: string) => {
    const index = waiting.findIndex((entry) => entry.name === name);
    if (index >= 0 && !held.some((lock) => lock.name === name)) {
      waiting.splice(index, 1)[0]!.grant();
    }
  };
  const locks = {
    async query() {
      return { held: held.map((lock) => ({ ...lock })), pending: [] };
    },
    request(name: string, options: LockOptions, callback: () => Promise<void>): Promise<void> {
      const mode = options.mode ?? "exclusive";
      return new Promise((resolve, reject) => {
        const grant = () => {
          const lock = { mode, name };
          held.push(lock);
          void callback().then(() => {
            held.splice(held.indexOf(lock), 1);
            resolve();
            grantNext(name);
          });
        };
        if (mode === "shared" || !held.some((lock) => lock.name === name)) {
          grant();
          return;
        }
        const entry = { grant, name };
        waiting.push(entry);
        options.signal?.addEventListener("abort", () => {
          const index = waiting.indexOf(entry);
          if (index >= 0) {
            waiting.splice(index, 1);
            reject(new DOMException("Aborted", "AbortError"));
          }
        });
      });
    },
  };
  return locks;
}

let visibility: DocumentVisibilityState = "hidden";

beforeEach(() => {
  shown.length = 0;
  permission = "granted";
  answer = "granted";
  asked.mockClear();
  visibility = "hidden";
  document.title = "Uraeda";
  vi.stubGlobal("Notification", FakeNotification);
  Object.defineProperty(navigator, "locks", { configurable: true, value: fakeLocks() });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
  window.localStorage.removeItem("uraeda.notifications");
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "locks");
  Reflect.deleteProperty(document, "visibilityState");
  document.title = "Uraeda";
});

/** An item that needs the human. */
const row = (folder: string, key = `${folder}:step`): NeedsYouRow => ({
  href: `/r/uraeda/f/${folder}/clarifications-01.md`,
  id: `uraeda/${folder}`,
  key,
  label: folder.replace(/^\d{4}-\d{2}-\d{2}-/, ""),
  message: "Questions to answer",
});

/** A tab's notifier, given what needs the human; its rows change with `rerender`. */
async function tab(rows: Array<NeedsYouRow> = []) {
  const hook = renderHook(({ now }) => useNotifier(now), { initialProps: { now: rows } });
  // Its locks are asked for once drawn.
  await act(async () => {});
  return hook;
}

/** Lets the notifier's checks of the locks end. */
const settle = () => act(async () => {});

const SETTINGS = "2026-10-16-settings-page";

/** US6.5, SC-004 */
test("an item coming to need the human notifies at once, and its click opens it", async () => {
  vi.useFakeTimers({ toFake: ["setTimeout", "setInterval", "Date"] });
  try {
    const page = await tab();

    page.rerender({ now: [row(SETTINGS)] });
    await settle();

    // No timer ran: within the second.
    expect(shown.map((n) => [n.title, n.options.body, n.options.tag])).toEqual([
      ["settings-page needs you", "Questions to answer", `uraeda/${SETTINGS}`],
    ]);
    const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
    act(() => shown[0]!.onclick!());
    expect(focus).toHaveBeenCalled();
    expect(window.location.pathname).toBe(`/r/uraeda/f/${SETTINGS}/clarifications-01.md`);
    expect(shown[0]!.close).toHaveBeenCalled();
  } finally {
    vi.useRealTimers();
  }
});

/** A chat the agent was refused an action in: it has no folder, and its page is under `/chats`. */
const chatRow = (id: string, key = `${id}:blocked:1`): NeedsYouRow => ({
  href: `/r/uraeda/chats/${id}`,
  id: `uraeda/chats/${id}`,
  key,
  label: "Push it",
  message: "The agent was refused an action",
});

/** US5.1, US5.3 */
test("a blocked chat notifies once, its click opens it, and it counts in the title", async () => {
  const page = await tab();

  page.rerender({ now: [chatRow("c1"), row(SETTINGS)] });
  await settle();

  expect(shown.map((n) => [n.title, n.options.body])).toEqual([
    ["Push it needs you", "The agent was refused an action"],
    ["settings-page needs you", "Questions to answer"],
  ]);
  expect(document.title).toBe("(2) Uraeda");
  act(() => shown[0]!.onclick!());
  expect(window.location.pathname).toBe("/r/uraeda/chats/c1");

  page.rerender({ now: [row(SETTINGS)] });
  await settle();
  expect(document.title).toBe("(1) Uraeda");
  expect(shown).toHaveLength(2);
});

/** US6.6 */
test("no notification while a Uraeda tab is in front: this one, or another", async () => {
  visibility = "visible";
  const page = await tab();
  page.rerender({ now: [row(SETTINGS)] });
  await settle();
  expect(shown).toHaveLength(0);

  // Another tab in front holds the shared lock.
  visibility = "hidden";
  const release = Promise.withResolvers<void>();
  void navigator.locks.request("uraeda.front", { mode: "shared" }, () => release.promise);
  page.rerender({ now: [row(SETTINGS), row("2026-10-11-web-ui")] });
  await settle();
  expect(shown).toHaveLength(0);
  release.resolve();
});

/** US6.7, review focus 5 */
test("of two tabs in the background, one notifies; once it closes, the other does", async () => {
  const first = await tab();
  const second = await tab();

  first.rerender({ now: [row(SETTINGS)] });
  second.rerender({ now: [row(SETTINGS)] });
  await settle();
  expect(shown).toHaveLength(1);

  first.unmount();
  await settle();
  second.rerender({ now: [row(SETTINGS), row("2026-10-11-web-ui")] });
  await settle();
  expect(shown.map((n) => n.title)).toEqual(["settings-page needs you", "web-ui needs you"]);
});

/** US6.9 */
test("an item that needed the human when the page loaded does not notify; a new ask does", async () => {
  const page = await tab([row(SETTINGS)]);

  page.rerender({ now: [row(SETTINGS)] });
  await settle();
  expect(shown).toHaveLength(0);

  page.rerender({ now: [row(SETTINGS, `${SETTINGS}:blocked`)] });
  await settle();
  expect(shown).toHaveLength(1);
});

test("without the browser's permission, nothing notifies, and the title still counts", async () => {
  permission = "default";
  const page = await tab();
  page.rerender({ now: [row(SETTINGS), row("2026-10-11-web-ui")] });
  await settle();
  expect(shown).toHaveLength(0);
  expect(document.title).toBe("(2) Uraeda");

  page.rerender({ now: [] });
  expect(document.title).toBe("Uraeda");
});

/** US6.8: the server's list, across its repositories, counted in the title. */
test("the tab's title counts what needs the human", async () => {
  permission = "default";
  window.localStorage.setItem("uraeda.notifications", "dismissed");
  await renderPage("/");
  const nav = within(await screen.findByRole("navigation", { name: "Side navigation" }));
  const needsYou = within(await nav.findByRole("group", { name: "Needs you" }));
  const count = needsYou.getAllByRole("link").length;

  await refreshUntil(() => expect(document.title).toBe(`(${count}) Uraeda`));
});

/** US6.1, US6.3 */
test("the banner asks nothing of the browser, and Not now keeps it away", async () => {
  permission = "default";
  const { repo } = await renderPage("/");

  expect(await screen.findByText("Get notified when an agent needs you")).toBeTruthy();
  expect(asked).not.toHaveBeenCalled();

  await click(screen.getByRole("button", { name: "Not now" }));
  expect(screen.queryByText("Get notified when an agent needs you")).toBeNull();
  await renderPage("/", repo, { reload: true });
  await homeShown();
  expect(screen.queryByText("Get notified when an agent needs you")).toBeNull();
});

/** US6.2 */
test("Turn on, allowed, notifies that notifications are on, and the banner goes", async () => {
  permission = "default";
  await renderPage("/");

  await click(await screen.findByRole("button", { name: "Turn on" }));

  expect(asked).toHaveBeenCalledOnce();
  expect(shown.map((n) => n.title)).toEqual(["Notifications are on"]);
  expect(screen.queryByText("Get notified when an agent needs you")).toBeNull();
});

/** US6.4 */
test("Turn on, blocked, says so, with Dismiss", async () => {
  permission = "default";
  answer = "denied";
  await renderPage("/");

  await click(await screen.findByRole("button", { name: "Turn on" }));

  expect(screen.getByText("Notifications are blocked for Uraeda.")).toBeTruthy();
  await click(screen.getByRole("button", { name: "Dismiss" }));
  expect(screen.queryByText("Notifications are blocked for Uraeda.")).toBeNull();
});

test("a browser without notifications shows no banner", async () => {
  vi.stubGlobal("Notification", undefined);
  await renderPage("/");
  await homeShown();
  expect(screen.queryByText("Get notified when an agent needs you")).toBeNull();
});
