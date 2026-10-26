// The edge case of a text being written when the session ends, through the real app in process with
// sign-in on: unsaved text survives a sign-out.
import { cleanup, screen, waitFor, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { forgetSignedOut } from "../sign-in/signedOut.ts";
import {
  click,
  fixtureRepo,
  refreshUntil,
  renderPage,
  signInServer,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-11");

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
