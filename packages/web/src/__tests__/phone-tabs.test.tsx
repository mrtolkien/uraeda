// The phone's tabs fit a 375 px phone, Git always among them: Decisions and Settings wait in a `…`,
// whose popover holds them, and which is the current page's tab while one of them is open. Their
// 44 px targets touch, and none is filled: a terminal's tab line, its counts small numbers.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { phoneTabs } from "../shell/Tabs.tsx";
import { atRepo, atWidth, fixtureRepo, quiet, renderPage } from "./helpers.tsx";

beforeEach(() => atWidth(375));

/** The phone's tabs, drawn at `path`, with a file changed, so the Git tab shows. */
async function tabsAt(path: string) {
  const repo = fixtureRepo();
  writeFileSync(join(repo, "scratch.md"), "A change.\n");
  await renderPage(path, repo);
  const tabs = await screen.findByRole("navigation", { name: "Tabs" });
  await quiet();
  return tabs;
}

// Break: Decisions or Settings back in the bar, which makes it nine 44 px controls with Git, or
// left out of the `…`, which leaves them out of reach.
test("the phone's tabs fold Decisions and Settings into the …, which opens them", async () => {
  const tabs = await tabsAt("/");
  expect(within(tabs).getByRole("link", { name: /^Git, 1 change/ })).toBeTruthy();
  // Eight 44 px controls, 352 px, fit the 375 px phone.
  const controls = within(tabs).getAllByRole("link").length;
  expect(controls + within(tabs).getAllByRole("button").length).toBeLessThanOrEqual(8);
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

// Break: a tab filled again, the current one's grey or Git's and New's accent blocks; or a count
// back in a filled badge over its icon.
test("no tab is filled, and a count is a small number after its icon", async () => {
  const tabs = await tabsAt("/inbox");
  const controls = [...within(tabs).getAllByRole("link"), ...within(tabs).getAllByRole("button")];
  for (const control of controls) {
    expect(control.getAttribute("data-variant")).toBe("ghost");
  }
  const inbox = within(tabs).getByRole("link", { name: /^Inbox/ });
  expect(inbox.getAttribute("aria-current")).toBe("page");
  const git = within(tabs).getByRole("link", { name: /^Git, 1 change/ });
  expect(git.querySelector("[data-tab-count]")?.textContent).toBe("1");
  // No room between the targets themselves: eight 44 px controls fill a 375 px phone.
  expect(getComputedStyle(tabs).gap).toBe("0");
});

// Break: Git gone from the tabs while nothing waits on it, which left the phone no way to the Git
// page, its sidebar holding no copy of the tabs.
test("Git is a tab with nothing to commit, without a count", async () => {
  await renderPage("/git", fixtureRepo());
  const tabs = await screen.findByRole("navigation", { name: "Tabs" });
  await quiet();
  const git = within(tabs).getByRole("link", { name: "Git" });
  expect(git.getAttribute("aria-current")).toBe("page");
  expect(git.querySelector("[data-tab-count]")).toBeNull();
});

/** A place asking for a tab on the bar or in the `…`. */
const place = (id: string, phoneTab: "bar" | "more") => ({
  component: () => null,
  icon: "uraeda:list" as const,
  id,
  phoneTab,
  title: id,
});

// Break: every place of yours asking for the bar drawn on it, past the phone's width.
test("places beyond the bar's room go into the …, before those asking for it", () => {
  const builtIns = ["inbox", "priorities", "sessions", "git"].map((id) => place(id, "bar"));
  const { bar, more } = phoneTabs([
    ...builtIns,
    place("decisions", "more"),
    place("deploy", "bar"),
  ]);
  expect(bar.map((one) => one.id)).toEqual(["inbox", "priorities", "sessions", "git"]);
  expect(more.map((one) => one.id)).toEqual(["deploy", "decisions"]);
  // The inbox off here: yours takes its tab.
  expect(phoneTabs([...builtIns.slice(1), place("deploy", "bar")]).bar.at(-1)?.id).toBe("deploy");
});
