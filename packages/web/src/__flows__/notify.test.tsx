// Flow: the notifier (decision notifications). An item that comes to need the human, in any
// repository, notifies them from an open page that is in the background, once; the click opens it;
// the permission is asked only from "Turn on", after the banner says what will notify; a viewer is
// never interrupted; the tab's title counts what waits. The browser's `Notification`, Web Locks, and
// visibility are fakes; what needs the human is what the real server says.
import { readFileSync } from "node:fs";
import { act, screen, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { commitOnBranch, fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { click } from "./harness.tsx";
import { startListApp } from "./lists.tsx";

const repos = { a: fixtureRepo(), b: fixtureRepo() };
/** The Turn on button of the banner, when it shows. */
const turnOn = () => screen.queryByRole("button", { name: /turn on/i });

const app = startListApp(
  () => [
    ["alpha", repos.a],
    ["beta", repos.b],
  ],
  { agent: true },
);

/** The notifications shown, and what the browser answers to the question. */
const shown: Array<FakeNotification> = [];
let permission: NotificationPermission = "granted";
let answer: NotificationPermission = "granted";
const asked = vi.fn();
let visibility: DocumentVisibilityState = "hidden";

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
  options: NotificationOptions;
  constructor(title: string, options: NotificationOptions = {}) {
    this.title = title;
    this.options = options;
    shown.push(this);
  }
}

/** Web Locks of one browser: an exclusive lock has one holder, a shared one many. */
function fakeLocks() {
  const held: Array<{ mode: string; name: string }> = [];
  const waiting: Array<{ name: string; run: () => void }> = [];
  const next = (name: string) => {
    const index = waiting.findIndex((entry) => entry.name === name);
    if (index >= 0 && !held.some((lock) => lock.name === name)) {
      waiting.splice(index, 1)[0].run();
    }
  };
  return {
    query: async () => ({ held: held.map((lock) => ({ ...lock })), pending: [] }),
    request(name: string, options: LockOptions, callback: () => Promise<void>) {
      const mode = options.mode ?? "exclusive";
      return new Promise<void>((resolve, reject) => {
        const run = () => {
          const lock = { mode, name };
          held.push(lock);
          void callback().then(() => {
            held.splice(held.indexOf(lock), 1);
            resolve();
            next(name);
          });
        };
        if (mode === "shared" || !held.some((lock) => lock.name === name)) {
          run();
          return;
        }
        const entry = { name, run };
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
}

beforeEach(() => {
  shown.length = 0;
  permission = "granted";
  answer = "granted";
  visibility = "hidden";
  asked.mockClear();
  document.title = "Uraeda";
  vi.stubGlobal("Notification", FakeNotification);
  Object.defineProperty(navigator, "locks", { configurable: true, value: fakeLocks() });
  Object.defineProperty(document, "visibilityState", { configurable: true, get: () => visibility });
});

afterEach(() => {
  vi.unstubAllGlobals();
  Reflect.deleteProperty(navigator, "locks");
  Reflect.deleteProperty(document, "visibilityState");
  document.title = "Uraeda";
});

let features = 0;

/**
 * A new feature at a gate in a repository, its questions waiting for the human: a branch of its
 * own, with the questions of the fixture's web UI, which wait. Returns its folder.
 */
function askSomething(repo: string) {
  features += 1;
  const folder = `2026-10-2${features}-asks-${features}`;
  const from = "repo/branches/2026-10-11-web-ui/specs/2026-10-11-web-ui";
  git(repo, "branch", folder, "main");
  commitOnBranch(repo, folder, {
    [`specs/${folder}/clarifications-01.md`]: readFileSync(
      fixture(`${from}/clarifications-01.md`),
      "utf8",
    ),
    [`specs/${folder}/proposal.md`]: readFileSync(fixture(`${from}/proposal.md`), "utf8"),
  });
  return folder;
}

/** The page's reading of the server, as when the tab changes: visible, then back in the background. */
async function readAgain(back: DocumentVisibilityState = "hidden") {
  await act(async () => {
    visibility = "visible";
    document.dispatchEvent(new Event("visibilitychange"));
    visibility = back;
    document.dispatchEvent(new Event("visibilitychange"));
    await new Promise((resolve) => setTimeout(resolve, 30));
  });
}

/** The number the tab's title counts, 0 when it counts nothing. */
const counted = () => Number(/^\((\d+)\)/.exec(document.title)?.[1] ?? 0);

/** Reads again until the tab's title counts more than `from`. */
async function untilCounted(from: number, back: DocumentVisibilityState = "hidden") {
  await waitFor(async () => {
    await readAgain(back);
    expect(counted()).toBeGreaterThan(from);
  });
}

test("an item that needed the human at load does not notify; a new ask in another repository does, once, and its click opens it", async () => {
  await app.open("/r/alpha/");
  await screen.findAllByRole("link");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  expect(shown).toHaveLength(0);
  const before = counted();

  const folder = askSomething(repos.b);
  await untilCounted(before);

  await waitFor(() => expect(shown).toHaveLength(1));
  // Reading again changes nothing: one notification for the item, tagged with it.
  await readAgain();
  expect(shown).toHaveLength(1);
  expect(shown[0].options.tag).toContain(folder);
  const focus = vi.spyOn(window, "focus").mockImplementation(() => {});
  act(() => shown[0].onclick!());
  expect(focus).toHaveBeenCalled();
  expect(window.location.pathname).toBe(`/r/beta/f/${folder}/clarifications-01.md`);
  expect(shown[0].close).toHaveBeenCalled();
});

test("without the browser's permission nothing notifies, and the title still counts", async () => {
  permission = "default";
  window.localStorage.setItem("uraeda.notifications", "dismissed");
  await app.open("/r/alpha/");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  const before = counted();

  askSomething(repos.a);
  await untilCounted(before);

  expect(shown).toHaveLength(0);
});

test("no notification while this tab is in front", async () => {
  await app.open("/r/alpha/");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  const before = counted();

  askSomething(repos.a);
  // The tab stays in front while it reads the ask: it counts it, and says nothing.
  await untilCounted(before, "visible");

  expect(shown).toHaveLength(0);
});

test("no notification while another Uraeda tab is in front", async () => {
  await app.open("/r/alpha/");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  const before = counted();
  // The other tab in front holds the shared lock every tab in front holds.
  const release = Promise.withResolvers<void>();
  void navigator.locks.request("uraeda.front", { mode: "shared" }, () => release.promise);

  askSomething(repos.a);
  await untilCounted(before);

  expect(shown).toHaveLength(0);
  release.resolve();
});

test("of two tabs in the background only one notifies, and the other takes over once it closes", async () => {
  const first = await app.open("/r/alpha/");
  const second = await app.open("/r/alpha/");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  const before = counted();

  askSomething(repos.a);
  await untilCounted(before);
  await waitFor(() => expect(shown).toHaveLength(1));
  const now = counted();
  await readAgain();
  expect(shown).toHaveLength(1);

  // The notifying tab closes: the other notifies the next ask.
  first.unmount();
  askSomething(repos.a);
  await untilCounted(now);
  await waitFor(() => expect(shown).toHaveLength(2));
  second.unmount();
});

test("the banner asks nothing of the browser, and Not now keeps it away across a reload", async () => {
  permission = "default";
  await app.open("/r/alpha/");
  await waitFor(() => expect(turnOn()).toBeTruthy());
  expect(asked).not.toHaveBeenCalled();

  await click(screen.getByRole("button", { name: /not now/i }));
  expect(turnOn()).toBeNull();
  await app.open("/r/alpha/", { reload: true });
  await screen.findAllByRole("link");

  expect(turnOn()).toBeNull();
  expect(asked).not.toHaveBeenCalled();
});

test("Turn on asks the browser once, and the banner goes when it is allowed", async () => {
  permission = "default";
  await app.open("/r/alpha/");

  await click(await screen.findByRole("button", { name: /turn on/i }));

  expect(asked).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: /turn on/i })).toBeNull();
});

test("a refusal is kept: the banner says it is blocked and can be dismissed", async () => {
  permission = "default";
  answer = "denied";
  await app.open("/r/alpha/");

  await click(await screen.findByRole("button", { name: /turn on/i }));

  expect(asked).toHaveBeenCalledOnce();
  expect(shown).toHaveLength(0);
  expect(screen.queryByRole("button", { name: /turn on/i })).toBeNull();
  // The blocked state offers a way out: dismissing it keeps it away on the next load.
  await click(await screen.findByRole("button", { name: /dismiss/i }));
  await app.open("/r/alpha/", { reload: true });
  await screen.findAllByRole("link");
  expect(asked).toHaveBeenCalledOnce();
  expect(screen.queryByRole("button", { name: /dismiss|turn on/i })).toBeNull();
});

test("a browser without notifications shows no banner", async () => {
  vi.stubGlobal("Notification", undefined);
  await app.open("/r/alpha/");
  await screen.findAllByRole("link");

  expect(screen.queryByRole("button", { name: /turn on/i })).toBeNull();
});

test("a chat whose action was blocked notifies once, its click opens the chat, and the title counts it", async () => {
  await app.open("/r/alpha/");
  await waitFor(() => expect(counted()).toBeGreaterThan(0));
  const before = counted();

  app.agent.script([
    {
      denials: [{ input: { command: "ls" }, tool: "Bash" }],
      errors: [],
      interrupted: false,
      ok: true,
      type: "result",
    },
  ]);
  const chat = await app.sessions.newChat(repos.a);
  const { turn } = await app.sessions.send(repos.a, chat.id, { text: "List it" });
  await app.sessions.settled(turn);
  await untilCounted(before);

  await waitFor(() => expect(shown).toHaveLength(1));
  await readAgain();
  expect(shown).toHaveLength(1);
  act(() => shown[0].onclick!());
  expect(window.location.pathname).toBe(`/r/alpha/chats/${chat.id}`);
});
