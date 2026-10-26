/**
 * The views of merging chats and changes: the New page's three kinds, a session whose agent offered
 * a change, with its card, the session's "…" open, the drop confirmation of the change it became,
 * and the sidebar's one Sessions list, with sessions, changes, and features. Each session is made
 * once, on the first shot's page, then taken at every size and theme. Taken after the changes'
 * views, so the sidebar lists their changes too.
 */
import type { Page } from "playwright";
import type { FakeAdapter } from "uraeda-server/testing";
import { type Each, here, openSessionsTab, settle, show, showNew, wait } from "./shots.ts";

const result = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

const OFFER = [
  "The guard and the router both redirect: this should not land on main directly.",
  "",
  "```uraeda-offer change",
  "# Login redirects twice",
  "",
  "After signing in, the app shows the home page, then the sign-in page again.",
  "```",
].join("\n");

/** Waits until the agent was sent one more message than `sent`, and accepts it. */
async function accept(adapter: FakeAdapter, sent: number) {
  while (adapter.sent.length === sent) {
    await wait(50);
  }
  adapter.emit({ id: adapter.sent.at(-1)!.id, type: "accepted" });
}

/** A session whose agent offered the change "Login redirects twice": its path. */
async function offered(adapter: FakeAdapter, first: Page) {
  await showNew(first);
  const sent = adapter.sent.length;
  await first
    .getByRole("textbox", { name: "Message Claude Code" })
    .fill("Why does the login redirect twice? Fix it.");
  await first.getByRole("button", { name: "Send" }).first().click();
  await accept(adapter, sent);
  await first.waitForURL(/\/sessions\//);
  adapter.emit({ text: OFFER, type: "text" });
  adapter.emit(result);
  await first.getByRole("region", { name: "Start a change" }).waitFor();
  return here(first);
}

/** The session's page, scrolled to its end, with its "…" open. */
/** An action of the "…" opened: a popover's menu item, or a sheet's button on the phone. */
const action = (page: Page, name: string) =>
  page.getByRole("menuitem", { name }).or(page.getByRole("button", { exact: true, name }));

async function actions(page: Page, path: string, text: string) {
  await show(page, path, text);
  await page.getByRole("button", { name: "Session actions" }).click();
  // A popover's menu, or on the phone a sheet, whose actions are buttons.
  await action(page, "Rename").waitFor();
  await settle(page);
}

/** The column, or the phone's Sessions tab, once its Sessions list is drawn. */
async function sidebar(page: Page, size: "phone" | "desktop") {
  await show(page, "/", "Overview");
  if (size === "phone") {
    await openSessionsTab(page);
  }
  // The session's card is its change's now, by its slug; the Sessions section scrolled into view,
  // below the fixture's many features that need the human.
  const card = page.getByRole("link", { name: /^login-redirects, / }).first();
  await card.waitFor();
  await card.evaluate((element) => element.scrollIntoView({ block: "center" }));
  await settle(page);
}

/** The views of merging chats and changes. */
export async function takeMergeChats(each: Each, first: Page, adapter: FakeAdapter) {
  for (const kind of ["session", "change", "feature"] as const) {
    await each(`new-page-${kind}`, ({ page }) => showNew(page, kind));
  }

  const session = await offered(adapter, first);
  await each("session-offer", async ({ page }) => {
    await show(page, session, "Login redirects twice");
    await page.getByRole("region", { name: "Start a change" }).waitFor();
    await settle(page);
  });
  await each("session-actions", ({ page }) => actions(page, session, "Login redirects twice"));

  // The offer started: the session is the change's, whose "…" drops it.
  await show(first, session, "Login redirects twice");
  const sent = adapter.sent.length;
  await first
    .getByRole("region", { name: "Start a change" })
    .getByRole("button", { name: "Start the change" })
    .click();
  await accept(adapter, sent);
  adapter.emit({ text: "Reading how the guard and the router redirect.", type: "text" });
  adapter.emit(result);
  await first.getByText(/^Started as the change Login redirects twice/).waitFor();
  await each("session-drop", async ({ page }) => {
    await actions(page, session, "Login redirects twice");
    await action(page, "Drop the change…").click();
    await page.getByRole("button", { name: "Keep the change" }).waitFor();
    await settle(page);
  });

  await each("sidebar-sessions", ({ page, size }) => sidebar(page, size));
}
