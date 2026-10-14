// The repository menu and the add form at both widths (the UI layout decision): on wide screens, the
// menu is a popover and the form a dialog; on narrow ones, both are bottom sheets, each with Close,
// and Back closes them (the UI behaviour decision). The first run fits both widths. Each passes the
// layout checks of the UI checks decision, in light and dark.
import { Theme } from "@astryxdesign/core/theme";
import { render, screen, within } from "@testing-library/react";
import { Suspense } from "react";
import { FateClient } from "react-fate";
import { expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { fateClients } from "../clients.ts";
import { FirstRun } from "../RepositoryPages.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { checkLayout, drawn, repository, show } from "./helpers.tsx";

const MODES = ["light", "dark"] as const;
const narrow = () => window.innerWidth < 768;

/**
 * Opens the repository menu from its trigger, "Uraeda" over the repository's name: in the phone's
 * top bar, or in the navigation's heading on a wide screen.
 */
async function openMenu() {
  const bar = narrow()
    ? page.getByRole("banner")
    : page.getByRole("navigation", { name: "Side navigation" });
  await userEvent.click(bar.getByRole("button", { name: `Uraeda ${repository()}`, exact: true }));
  const menu = await screen.findByRole("dialog", { name: "Repositories" });
  await within(menu).findByRole("list", { name: "Repositories" });
  await drawn();
  return menu;
}

/**
 * Once its entrance ends: a sheet along the screen's bottom edge and its full width, or, on a wide
 * screen, a box narrower than half the screen.
 */
async function expectSheetOrNarrow(element: Element) {
  await expect
    .poll(() => {
      const box = element.getBoundingClientRect();
      return narrow()
        ? Math.round(box.bottom) === window.innerHeight &&
            Math.round(box.width) === window.innerWidth
        : box.width > 0 && box.width < window.innerWidth / 2;
    })
    .toBe(true);
}

test.each(MODES)(
  "the menu is a popover on wide screens and a sheet on narrow ones, in %s (US1)",
  async (mode) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show("/", "Waiting on you");
    const menu = await openMenu();
    await expectSheetOrNarrow(menu);
    // The test's repository, and the way to add another.
    const rows = within(menu).getByRole("list", { name: "Repositories" });
    expect(within(rows).getByText(repository())).toBeTruthy();
    expect(within(menu).getByText("Add a repository…")).toBeTruthy();
    // With Close on a narrow screen; under its trigger on a wide one.
    if (narrow()) {
      expect(within(menu).getByRole("button", { name: "Close" })).toBeTruthy();
    } else {
      const trigger = screen.getByRole("button", { name: `Uraeda ${repository()}` });
      expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        trigger.getBoundingClientRect().bottom - 1,
      );
    }
    await checkLayout(menu);

    // Closed by Close on a narrow screen, by Escape on a wide one; Back closes the sheet too.
    if (narrow()) {
      await userEvent.click(within(menu).getByRole("button", { name: "Close" }));
      await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
      const again = await openMenu();
      expect(again).toBeTruthy();
      window.history.back();
    } else {
      await userEvent.keyboard("{Escape}");
    }
    await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
  },
);

test.each(MODES)(
  "the add form is a dialog on wide screens and a sheet on narrow ones, with Close, in %s (US2)",
  async (mode) => {
    window.localStorage.setItem("uraeda.theme", mode);
    await show("/", "Waiting on you");
    const openForm = async () => {
      const menu = await openMenu();
      await userEvent.click(within(menu).getByText("Add a repository…"));
      const form = await screen.findByRole("dialog", { name: "Add a repository" });
      await drawn();
      return form;
    };

    let form = await openForm();
    await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
    await expectSheetOrNarrow(form);
    if (!narrow()) {
      // A dialog in the middle of the screen.
      await expect
        .poll(() => {
          const box = form.getBoundingClientRect();
          return Math.abs((box.top + box.bottom) / 2 - window.innerHeight / 2) < 2;
        })
        .toBe(true);
    }
    // The Folder field starts at the home folder.
    expect(within(form).getByRole<HTMLInputElement>("textbox", { name: "Folder" }).value).toBe(
      "~/",
    );
    expect(within(form).getByRole("button", { name: "Add" })).toBeTruthy();
    await checkLayout(form);

    // The folders it suggests, at the root of the machine, fit too.
    await userEvent.fill(within(form).getByRole("textbox", { name: "Folder" }), "/");
    await within(form).findByRole("list", { name: "Folders" }, { timeout: 10_000 });
    await drawn();
    await checkLayout(form);

    // Back closes it, and leaves the page where it was.
    const here = window.location.pathname;
    window.history.back();
    await expect.poll(() => screen.queryByRole("dialog", { name: "Add a repository" })).toBeNull();
    expect(window.location.pathname).toBe(here);

    // Close closes it too.
    form = await openForm();
    await userEvent.click(within(form).getByRole("button", { name: "Close" }));
    await expect.poll(() => screen.queryByRole("dialog", { name: "Add a repository" })).toBeNull();
    expect(window.location.pathname).toBe(here);
  },
);

test.each(MODES)(
  "the first run fits both widths without horizontal scroll, in %s",
  async (mode) => {
    // The test server's list is never empty: the first run's page, on the global client, as `App`
    // draws it while the list is.
    render(
      <Theme theme={uraedaTheme} mode={mode}>
        <FateClient client={fateClients()(null)}>
          <Suspense fallback={null}>
            <FirstRun />
          </Suspense>
        </FateClient>
      </Theme>,
    );
    await screen.findByRole("heading", { name: "Add your first repository" });
    expect(screen.getByRole<HTMLInputElement>("textbox", { name: "Folder" }).value).toBe("~/");
    await drawn();
    await checkLayout(document.body);
  },
);
