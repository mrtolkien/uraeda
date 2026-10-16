// SC-005 of the interface's redesign: its new states pass the UI checks at a phone's size and a
// desktop's, in light and dark. Home's cards, the Done area, and the session's column, shown and
// hidden, are checked with their pages in `layout.test.tsx`; here, the folded rail, the feature
// settings, and the banner that asks to notify.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, checkLayout, colorScheme, drawn, show } from "./helpers.tsx";

const MODES = (["light", "dark"] as const).map((mode) => ({ mode }));

/** The side navigation, or the phone's drawer once opened. */
async function navigation() {
  if (window.innerWidth < 768) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
    return within(await screen.findByRole("dialog"));
  }
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

describe("on a desktop", () => {
  atSize("desktop");

  test.each(MODES)("the folded rail, in $mode", async ({ mode }) => {
    await colorScheme(mode);
    await show("/", "Waiting on you");
    await userEvent.keyboard("[[");
    const nav = screen.getByRole("navigation", { name: "Side navigation" });
    await expect.poll(() => nav.getBoundingClientRect().width).toBeLessThan(80);
    await drawn();
    await checkLayout();
  });
});

test.each(MODES)("the feature settings, in $mode", async ({ mode }) => {
  await colorScheme(mode);
  await show("/", "Waiting on you");
  const nav = await navigation();

  await userEvent.click(nav.getByRole("button", { name: "Settings of cli-tuis" }));

  const dialog = await screen.findByRole("dialog", { name: "Feature settings" });
  await userEvent.type(
    within(dialog).getByRole("textbox", { name: "Name in the sidebar" }),
    "Terminal UIs",
  );
  await drawn();
  await checkLayout();
});

test.each(MODES)("the banner that asks to notify, in $mode", async ({ mode }) => {
  window.localStorage.removeItem("uraeda.notifications");
  await colorScheme(mode);
  await show("/", "Waiting on you");

  expect(await screen.findByText("Get notified when an agent needs you")).toBeTruthy();
  await drawn();
  await checkLayout();
});
