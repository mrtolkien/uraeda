// US1.2 to US1.4 and US3.1 to US3.3: the sign-in screen and signing out, through the real app in
// process with sign-in on, signing out from the settings' Sign-in category (US6 of the settings
// page). The edge cases: unsaved text survives a sign-out, an upload without a session shows the
// sign-in screen, and an unreachable server is said so.
import { readFileSync } from "node:fs";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";
import {
  click,
  fixture,
  fixtureRepo,
  homeHidden,
  homeShown,
  refreshUntil,
  renderPage,
  signInServer,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-11");

const TEXT =
  "Paste the access key Uraeda showed when it first started. On the machine that runs Uraeda, uraeda --new-key makes a new one and signs every device out.";
const WRONG = "This is not Uraeda's access key.";
const UNREACHABLE = "Could not reach the Uraeda server.";
const ROUND = "/f/2026-10-11-web-ui/clarifications-01.md";

const heading = () => screen.queryByRole("heading", { name: "Sign in to Uraeda" });
const field = () => screen.getByLabelText("Access key") as HTMLInputElement;
const button = (name: string) => screen.getByRole("button", { name }) as HTMLButtonElement;

/** Signs a browser in with the key, as the sign-in screen does. */
async function signIn(fetch: typeof globalThis.fetch, key: string) {
  const response = await fetch("/session", { body: JSON.stringify({ key }), method: "POST" });
  expect(response.status).toBe(204);
}

/** A signed-in browser on a new server, and the page at `path` drawn on it. */
async function signedInPage(path = "/", onSignedIn = vi.fn()) {
  const repo = fixtureRepo();
  const server = signInServer(repo);
  await signIn(server.fetch, server.key);
  const page = await renderPage(path, repo, { fetch: server.fetch, onSignedIn });
  return { ...server, ...page, onSignedIn };
}

/** Types the key in the sign-in screen and presses Sign in, then waits for `onSignedIn`. */
async function signInAgain(key: string, onSignedIn: ReturnType<typeof vi.fn>) {
  await type(field(), key);
  await click(button("Sign in"));
  await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
}

/** The page drawn again on a browser, as the reload after a sign-in does. */
async function reloaded(path: string, repo: string, fetch: typeof globalThis.fetch) {
  cleanup();
  forgetSignedOut();
  forgetUnsaved();
  return renderPage(path, repo, { fetch, reload: true });
}

/** Signs every device out, from another device. */
async function signOutElsewhere(server: ReturnType<typeof signInServer>) {
  const phone = server.device();
  await signIn(phone, server.key);
  expect((await phone("/sessions", { method: "DELETE" })).status).toBe(204);
}

/** Opens the repository menu from the navigation's heading. */
async function openMenu(name: string) {
  await click(await screen.findByRole("button", { name: `Uraeda ${name}` }));
  return within(await screen.findByRole("dialog", { name: "Repositories" }));
}

/** US1.2 */
test("a browser without a session sees the sign-in screen", async () => {
  const repo = fixtureRepo();
  const { fetch } = signInServer(repo);
  const { name } = await renderPage("/", repo, { fetch });

  await waitFor(() => expect(heading()).not.toBeNull());
  expect(screen.getByText(/^Paste the access key/).textContent).toBe(TEXT);
  expect(field().type).toBe("password");
  expect(field().getAttribute("autocomplete")).toBe("current-password");
  expect(button("Sign in").disabled).toBe(true);
  expect(screen.queryByText(name)).toBeNull();
  expect(homeHidden()).toBe(true);
});

/** US1.3 */
test("the key signs in, and the page shows", async () => {
  const repo = fixtureRepo();
  const { fetch, key } = signInServer(repo);
  // The sign-in's answer waits for the test, which reads the button meanwhile.
  const { promise: held, resolve: answer } = Promise.withResolvers<void>();
  const slow: typeof globalThis.fetch = async (input, init) => {
    if (init?.method === "POST" && String(input).endsWith("/session")) {
      await held;
    }
    return fetch(input, init);
  };
  const onSignedIn = vi.fn();
  await renderPage("/", repo, { fetch: slow, onSignedIn });
  await waitFor(() => expect(heading()).not.toBeNull());

  await type(field(), key);
  expect(button("Sign in").disabled).toBe(false);
  await click(button("Sign in"));
  expect(button("Signing in…").disabled).toBe(true);
  await act(async () => answer());

  await waitFor(() => expect(onSignedIn).toHaveBeenCalledOnce());
  await reloaded("/", repo, fetch);
  expect(await homeShown()).toBeTruthy();
  expect(heading()).toBeNull();
});

/** US1.4 */
test("a wrong key says so, and keeps the text", async () => {
  const repo = fixtureRepo();
  const { fetch } = signInServer(repo);
  const onSignedIn = vi.fn();
  await renderPage("/", repo, { fetch, onSignedIn });
  await waitFor(() => expect(heading()).not.toBeNull());

  await type(field(), "ura_wrong");
  // Enter submits, as Sign in does.
  await act(async () => {
    fireEvent.keyDown(field(), { key: "Enter" });
  });

  expect(await screen.findByText(WRONG)).toBeTruthy();
  expect(field().value).toBe("ura_wrong");
  expect(button("Sign in").disabled).toBe(false);
  expect(onSignedIn).not.toHaveBeenCalled();
});

/** Error handling: the server out of reach while signing in. */
test("an unreachable server says so", async () => {
  const repo = fixtureRepo();
  const { fetch } = signInServer(repo);
  const down: typeof globalThis.fetch = (input, init) =>
    init?.method === "POST" && String(input).endsWith("/session")
      ? Promise.reject(new TypeError("Failed to fetch"))
      : fetch(input, init);
  await renderPage("/", repo, { fetch: down });
  await waitFor(() => expect(heading()).not.toBeNull());

  await type(field(), "ura_key");
  await click(button("Sign in"));

  expect(await screen.findByText(UNREACHABLE)).toBeTruthy();
  expect(screen.queryByText(WRONG)).toBeNull();
  expect(field().value).toBe("ura_key");
});

/** Error handling: an answer other than 401 is the server's failure, never a wrong key. */
test.each([403, 413, 500])("a sign-in answered %i says the server failed", async (status) => {
  const repo = fixtureRepo();
  const { fetch } = signInServer(repo);
  const failing: typeof globalThis.fetch = (input, init) =>
    init?.method === "POST" && String(input).endsWith("/session")
      ? Promise.resolve(Response.json({ error: "Forbidden" }, { status }))
      : fetch(input, init);
  await renderPage("/", repo, { fetch: failing });
  await waitFor(() => expect(heading()).not.toBeNull());

  await type(field(), "ura_key");
  await click(button("Sign in"));

  expect(await screen.findByText(UNREACHABLE)).toBeTruthy();
  expect(screen.queryByText(WRONG)).toBeNull();
  expect(screen.queryByText("Forbidden")).toBeNull();
  expect(field().value).toBe("ura_key");
});

/** The Sign-in category of the settings, where signing out lives. */
const SIGN_IN = "/settings/sign-in";

/** The Sign-in category's button, once the category shows. */
async function signInButton(name: string) {
  await screen.findByRole("heading", { name: "Sign-in" });
  return button(name);
}

/** Taps "Sign out everywhere…" in Sign-in, and returns the dialog that asks first. */
async function askEverywhere() {
  await click(await signInButton("Sign out everywhere…"));
  return within(await screen.findByRole("dialog", { name: "Sign out every device?" }));
}

/** US6.1 */
test("the repository menu holds no sign-out item", async () => {
  const server = await signedInPage();
  const menu = await openMenu(server.name);

  await menu.findByRole("list", { name: "Repositories" });
  expect(menu.queryByText("Sign out")).toBeNull();
  expect(menu.queryByText("Sign out everywhere…")).toBeNull();
});

/** US3.1, US6.2 */
test("Sign out ends this session", async () => {
  const server = await signedInPage(SIGN_IN);
  // Another tab of the same browser, with the same cookie.
  const tab = server.device(server.fetch);

  await click(await signInButton("Sign out"));

  await waitFor(() => expect(heading()).not.toBeNull());
  expect((await tab("/session")).status).toBe(401);
});

/** US3.2, US3.3, US6.3 */
test("Sign out everywhere asks first", async () => {
  const server = await signedInPage(SIGN_IN);
  const phone = server.device();
  await signIn(phone, server.key);

  let dialog = await askEverywhere();
  expect(
    dialog.getByText(
      "Every browser signed in to Uraeda, this one included, will need the access key again.",
    ),
  ).toBeTruthy();
  expect(dialog.getByRole("button", { name: "Sign out everywhere" })).toBeTruthy();
  await click(dialog.getByRole("button", { name: "Cancel" }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(heading()).toBeNull();
  expect((await phone("/session")).status).toBe(204);

  dialog = await askEverywhere();
  await click(dialog.getByRole("button", { name: "Sign out everywhere" }));

  await waitFor(() => expect(heading()).not.toBeNull());
  await reloaded("/", server.repo, phone);
  await waitFor(() => expect(heading()).not.toBeNull());
});

/** US6.4, and the error handling of a sign-out the server never got, from either button. */
test.each([
  ["Sign out", "/session", false],
  ["Sign out everywhere…", "/sessions", true],
])(
  "%s with the server stopped says so in Sign-in, and the page stays",
  async (name, path, asks) => {
    const repo = fixtureRepo();
    const server = signInServer(repo);
    await signIn(server.fetch, server.key);
    const down: typeof globalThis.fetch = (input, init) =>
      init?.method === "DELETE" && String(input).endsWith(path)
        ? Promise.reject(new TypeError("Failed to fetch"))
        : server.fetch(input, init);
    await renderPage(SIGN_IN, repo, { fetch: down });

    await click(await signInButton(name));
    if (asks) {
      const dialog = within(await screen.findByRole("dialog", { name: "Sign out every device?" }));
      await click(dialog.getByRole("button", { name: "Sign out everywhere" }));
    }

    expect(await screen.findByText(UNREACHABLE)).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Sign-in" })).toBeTruthy();
    expect(heading()).toBeNull();
  },
);

/** The live streams of a page, which the test fails as a browser does when its session ends. */
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

/** US3.3 */
test("a live stream that closes on a sign-out elsewhere shows the sign-in screen", async () => {
  streams.length = 0;
  (globalThis as { EventSource?: unknown }).EventSource = ClosingEventSource;
  const server = await signedInPage();
  await homeShown();
  await waitFor(() => expect(streams.length).toBeGreaterThan(0));

  await signOutElsewhere(server);
  await act(async () => {
    for (const stream of streams) {
      stream.fail();
    }
  });

  await waitFor(() => expect(heading()).not.toBeNull());
});

/** The comment field of the round's Q3. */
const comment = () =>
  within(document.getElementById("Q3")!).getAllByLabelText(
    "Comment, or your own answer instead of a letter",
  )[0];

/** The edge case of a text being written when the session ends. */
test("unsaved text survives a sign-out", async () => {
  const server = await signedInPage(ROUND);
  await screen.findByText("Which repositories does the UI open now?");
  await type(comment(), "Half typed");

  await signOutElsewhere(server);
  await refreshUntil(() => expect(heading()).not.toBeNull());
  await signInAgain(server.key, server.onSignedIn);

  await reloaded(ROUND, server.repo, server.fetch);
  await screen.findByText("Which repositories does the UI open now?");
  expect((comment() as HTMLTextAreaElement).value).toBe("Half typed");
  expect(
    within(document.getElementById("Q3")!).getByText("Unsaved text restored from", {
      exact: false,
    }),
  ).toBeTruthy();
});

/** The edge case of uploads: a 401 shows the sign-in screen, not a failed upload. */
test("an upload without a session shows the sign-in screen", async () => {
  const server = await signedInPage("/edit/specs/drafts/git-listener.md");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const bytes = readFileSync(fixture("images/phone.png"));

  await signOutElsewhere(server);
  await act(async () => {
    fireEvent.change(screen.getByLabelText("Add image", { selector: "input" }), {
      target: { files: [new File([bytes], "login.png", { type: "image/png" })] },
    });
  });

  await waitFor(() => expect(heading()).not.toBeNull());
  expect(screen.queryByText(/The image could not be added/)).toBeNull();
});
