// The phone's tabs fit a 375 px phone with Commit showing: Decisions and Settings wait in a `…`,
// whose popover holds them, and which is the current page's tab while one of them is open.
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atRepo, atWidth, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => atWidth(375));

/** The phone's tabs, drawn at `path`. */
async function tabsAt(path: string) {
  await renderPage(path);
  const tabs = await screen.findByRole("navigation", { name: "Tabs" });
  await quiet();
  return tabs;
}

// Break: Decisions or Settings back in the bar, which makes it nine 44 px controls with Commit, or
// left out of the `…`, which leaves them out of reach.
test("the phone's tabs fold Decisions and Settings into the …, which opens them", async () => {
  const tabs = await tabsAt("/");
  expect(within(tabs).queryByRole("link", { name: /^Decisions/ })).toBeNull();
  expect(within(tabs).queryByRole("link", { name: /^Settings/ })).toBeNull();
  const more = within(tabs).getByRole("button", { name: "More" });
  expect(more.getAttribute("aria-current")).toBeNull();

  fireEvent.click(more);
  const menu = await screen.findByRole("menu");
  expect(within(menu).getByRole("menuitem", { name: /Decisions/ })).toBeTruthy();
  fireEvent.click(within(menu).getByRole("menuitem", { name: /Settings/ }));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/settings")));
});

// Break: the … unmarked while a page it holds is open, which leaves the phone no current tab.
test("the … is the current page's tab, named by it, while Decisions or Settings is open", async () => {
  const tabs = await tabsAt("/decisions");
  const more = within(tabs).getByRole("button", { name: "More, Decisions" });
  expect(more.getAttribute("aria-current")).toBe("page");
});
