// Flow: signing in and out (decision sign-in, the UI's part). A browser without a session sees the
// sign-in screen and nothing of the repository; the key signs it in; a wrong key keeps the text and a
// failing server is not called a wrong key; signing out ends the session, everywhere only after
// asking; a session that ends elsewhere shows the screen again, on a live stream, a save, or an
// upload, and loses no unsaved text.
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { fixture } from "uraeda-binding/test-utils";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";
import { click, refreshUntil, startApp, type } from "./harness.tsx";

const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";

/** The first text field of the page, once drawn. */
const textField = async () => (await screen.findAllByRole("textbox"))[0] as HTMLTextAreaElement;
/** The Sign out everywhere button. */
const everywhere = () => screen.getByRole("button", { name: /Sign out everywhere/ });

const app = startApp({ signIn: true });

/** The sign-in screen's key field, when it shows. */
const keyField = () => document.querySelector<HTMLInputElement>("input[type=password]");
/** Whether the sign-in screen shows. */
const signInScreen = () => keyField() !== null;

/** Signs a browser in with the key, as the screen does. */
async function signIn(fetch: typeof globalThis.fetch) {
  const response = await fetch("/session", {
    body: JSON.stringify({ key: app.key }),
    method: "POST",
  });
  expect(response.status).toBe(204);
}

/** A browser holding a session. */
async function signedIn() {
  const browser = app.device();
  await signIn(browser);
  return browser;
}

/** Signs every device out, from another device. */
async function signOutElsewhere() {
  const other = app.device();
  await signIn(other);
  expect((await other("/sessions", { method: "DELETE" })).status).toBe(204);
}

/** Types into the screen's key field and presses Enter, as Sign in does. */
async function submitKey(key: string) {
  await type(keyField()!, key);
  await act(async () => {
    fireEvent.keyDown(keyField()!, { key: "Enter" });
  });
}

/** The page again, as the reload after a sign-in draws it, with another browser's `fetch`. */
async function reloaded(path: string, fetch: typeof globalThis.fetch) {
  cleanup();
  forgetSignedOut();
  forgetUnsaved();
  return app.open(path, { fetch, reload: true });
}

/** A sign-in the server fails, or cannot be reached for: its `POST /session` is answered by `reply`. */
function answering(
  fetch: typeof globalThis.fetch,
  reply: () => Promise<Response>,
): typeof globalThis.fetch {
  return (input, init) =>
    init?.method === "POST" && String(input).endsWith("/session") ? reply() : fetch(input, init);
}

test("a browser without a session sees the sign-in screen and nothing of the repository", async () => {
  await app.open("/");

  await waitFor(() => expect(signInScreen()).toBe(true));
  expect(keyField()!.getAttribute("autocomplete")).toBe("current-password");
  expect(screen.queryByRole("navigation")).toBeNull();
  expect(screen.queryAllByRole("link")).toHaveLength(0);
});

test("the key signs in, and the page shows after the reload", async () => {
  const onSignedIn = vi.fn();
  const browser = app.device();
  await app.open("/", { fetch: browser, onSignedIn });
  await waitFor(() => expect(signInScreen()).toBe(true));

  await submitKey(app.key);

  await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
  await reloaded("/", browser);
  expect((await screen.findAllByRole("link")).length).toBeGreaterThan(0);
  expect(signInScreen()).toBe(false);
});

test("a wrong key keeps the text, signs nothing in, and says something other than a failing server does", async () => {
  const onSignedIn = vi.fn();
  await app.open("/", { fetch: app.device(), onSignedIn });
  await waitFor(() => expect(signInScreen()).toBe(true));
  await submitKey("ura_wrong");
  const wrong = await settledText();
  expect(keyField()!.value).toBe("ura_wrong");
  expect(onSignedIn).not.toHaveBeenCalled();
  cleanup();

  // An unreachable server, and answers other than 401, are the server's failure, never a wrong key.
  const failures: Array<string> = [];
  for (const reply of [
    () => Promise.reject(new TypeError("Failed to fetch")),
    () => Promise.resolve(Response.json({ error: "Forbidden" }, { status: 403 })),
    () => Promise.resolve(Response.json({ error: "Oops" }, { status: 500 })),
  ]) {
    await app.open("/", { fetch: answering(app.device(), reply), onSignedIn });
    await waitFor(() => expect(signInScreen()).toBe(true));
    await submitKey("ura_key");
    failures.push(await settledText());
    expect(keyField()!.value).toBe("ura_key");
    cleanup();
  }
  expect(failures[1]).toBe(failures[0]);
  expect(failures[2]).toBe(failures[0]);
  expect(failures[0]).not.toBe(wrong);
  expect(onSignedIn).not.toHaveBeenCalled();
});

/** The page's text once the sign-in's answer has been drawn. */
async function settledText() {
  await waitFor(() =>
    expect(document.body.textContent).toMatch(/not Uraeda's access key|Could not reach the Uraeda/),
  );
  return document.body.textContent ?? "";
}

/** The Sign-in category of the settings, where signing out lives. */
const SIGN_IN = "/settings/sign-in";

test("Sign out ends this session, and another tab of the browser is signed out too", async () => {
  const browser = await signedIn();
  const tab = app.device(browser);
  await app.open(SIGN_IN, { fetch: browser });
  await screen.findAllByRole("button");

  await click(screen.getByRole("button", { name: "Sign out" }));

  await waitFor(() => expect(signInScreen()).toBe(true));
  expect((await tab("/session")).status).toBe(401);
});

test("Sign out everywhere asks first: Cancel keeps every session, the confirmation ends them all", async () => {
  const browser = await signedIn();
  const phone = app.device();
  await signIn(phone);
  await app.open(SIGN_IN, { fetch: browser });
  await screen.findAllByRole("button");

  await click(everywhere());
  let dialog = within(await screen.findByRole("dialog"));
  await click(dialog.getAllByRole("button")[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(signInScreen()).toBe(false);
  expect((await phone("/session")).status).toBe(204);

  await click(everywhere());
  dialog = within(await screen.findByRole("dialog"));
  await click(dialog.getAllByRole("button").at(-1)!);

  await waitFor(() => expect(signInScreen()).toBe(true));
  expect((await phone("/session")).status).toBe(401);
});

test("a sign-out the server never got is said, and the page stays", async () => {
  const browser = await signedIn();
  const stopped: typeof globalThis.fetch = (input, init) =>
    init?.method === "DELETE"
      ? Promise.reject(new TypeError("Failed to fetch"))
      : browser(input, init);
  await app.open(SIGN_IN, { fetch: stopped });
  await screen.findAllByRole("button");

  await click(screen.getByRole("button", { name: "Sign out" }));

  // An alert with a message: the page's live region, which is empty, is one too.
  await waitFor(() =>
    expect(screen.getAllByRole("alert").some((alert) => alert.textContent)).toBe(true),
  );
  expect(signInScreen()).toBe(false);
});

/** The live streams of a page, which a test fails as a browser does when its session ends. */
const streams: Array<{ fail(): void }> = [];

class ClosingEventSource {
  readyState = 0;
  private failed = new Set<(event: Event) => void>();
  constructor() {
    streams.push(this);
  }
  addEventListener(type: string, listener: (event: Event) => void) {
    if (type === "error") {
      this.failed.add(listener);
    }
  }
  removeEventListener() {}
  close() {}
  fail() {
    for (const listener of this.failed) {
      listener(new Event("error"));
    }
  }
}

test("a live stream that closes on a sign-out elsewhere shows the sign-in screen", async () => {
  streams.length = 0;
  (globalThis as { EventSource?: unknown }).EventSource = ClosingEventSource;
  await app.open("/", { fetch: await signedIn() });
  await screen.findAllByRole("link");
  await waitFor(() => expect(streams.length).toBeGreaterThan(0));

  await signOutElsewhere();
  await act(async () => {
    for (const stream of streams) {
      stream.fail();
    }
  });

  await waitFor(() => expect(signInScreen()).toBe(true));
});

test("unsaved text survives a sign-out", async () => {
  const browser = await signedIn();
  await app.open(ROUND, { fetch: browser });
  await type(await textField(), "Half typed");

  await signOutElsewhere();
  await refreshUntil(() => expect(signInScreen()).toBe(true));
  const onSignedIn = vi.fn();
  cleanup();
  await app.open(ROUND, { fetch: browser, onSignedIn });
  await waitFor(() => expect(signInScreen()).toBe(true));
  await submitKey(app.key);
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());

  await reloaded(ROUND, browser);
  await waitFor(() =>
    expect(screen.getAllByRole<HTMLTextAreaElement>("textbox").map((box) => box.value)).toContain(
      "Half typed",
    ),
  );
});

test("an upload without a session shows the sign-in screen, not a failed upload", async () => {
  const browser = await signedIn();
  await app.open("/edit/specs/drafts/git-listener.md", { fetch: browser });
  await click(await screen.findByRole("button", { name: "Edit" }));
  const bytes = readFileSync(fixture("images/phone.png"));
  const before = signInScreen();

  await signOutElsewhere();
  await act(async () => {
    fireEvent.change(document.querySelector("input[type=file]")!, {
      target: { files: [new File([bytes], "login.png", { type: "image/png" })] },
    });
  });

  expect(before).toBe(false);
  await waitFor(() => expect(signInScreen()).toBe(true));
});
