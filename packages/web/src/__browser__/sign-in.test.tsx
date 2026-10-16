// The sign-in screen at both sizes, in light and dark, as a server without a session shows it,
// empty and with a wrong key's error; and the repository menu with its sign-out list, and the dialog
// of "Sign out everywhere…": each passes the layout checks of the UI checks decision. The test
// server has no sign-in: its fate requests are answered here, as a server with sign-in answers a
// browser without a session.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { forgetSignedOut } from "../sign-in/signedOut.ts";
import { checkLayout, drawn, repository, show } from "./helpers.tsx";

const MODES = ["light", "dark"] as const;
const narrow = () => window.innerWidth < 768;

/** The browser's own `fetch`, put back after each test. */
const browserFetch = globalThis.fetch;

afterEach(() => {
  globalThis.fetch = browserFetch;
  window.localStorage.removeItem("uraeda.theme");
  forgetSignedOut();
});

/** A JSON answer. */
const answer = (status: number, body: unknown) =>
  new Response(JSON.stringify(body), { headers: { "content-type": "application/json" }, status });

/**
 * Answers the page as a server with sign-in answers a browser without a session: 401 to every fate
 * request, and a wrong key to a sign-in.
 */
function withoutSession() {
  globalThis.fetch = async (input, init) => {
    const url = new URL(
      typeof input === "object" && "url" in input ? input.url : String(input),
      window.location.href,
    );
    if (url.pathname === "/session" && init?.method === "POST") {
      return answer(401, { error: "This is not Uraeda's access key." });
    }
    if (/\/fate(\/|$)/.test(url.pathname)) {
      return answer(401, { error: "Sign in to Uraeda." });
    }
    return browserFetch(input, init);
  };
}

test.each(MODES)("the sign-in screen, empty, then with a wrong key, in %s", async (mode) => {
  window.localStorage.setItem("uraeda.theme", mode);
  withoutSession();
  await show("/", "Sign in to Uraeda");
  expect(document.documentElement.getAttribute("data-theme")).toBe(mode);
  expect(screen.getByRole("button", { name: "Sign in" }).hasAttribute("disabled")).toBe(true);
  await checkLayout(document.body);

  await userEvent.fill(screen.getByLabelText("Access key"), "ura_wrong");
  await userEvent.keyboard("{Enter}");
  await screen.findByText("This is not Uraeda's access key.");
  await drawn();
  await checkLayout(document.body);
});

/**
 * Opens the repository menu from its trigger, "Uraeda" over the repository's name: in the phone's
 * top bar, or in the navigation's heading on a wide screen.
 */
async function openMenu() {
  const bar = narrow()
    ? page.getByRole("banner")
    : page.getByRole("navigation", { name: "Side navigation" });
  await userEvent.click(bar.getByRole("button", { exact: true, name: `Uraeda ${repository()}` }));
  const menu = await screen.findByRole("dialog", { name: "Repositories" });
  await within(menu).findByRole("list", { name: "Sign out" });
  await drawn();
  return menu;
}

test.each(MODES)("the menu's sign-out list, and its confirmation, in %s", async (mode) => {
  window.localStorage.setItem("uraeda.theme", mode);
  await show("/", "Waiting on you");
  const menu = await openMenu();
  const list = within(menu).getByRole("list", { name: "Sign out" });
  expect(within(list).getByText("Sign out")).toBeTruthy();
  await checkLayout(menu);

  await userEvent.click(within(list).getByText("Sign out everywhere…"));
  const dialog = await screen.findByRole("dialog", { name: "Sign out every device?" });
  await drawn();
  await checkLayout(dialog);
});
