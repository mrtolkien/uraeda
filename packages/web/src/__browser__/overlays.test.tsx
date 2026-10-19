// "On narrow screens, views are pages and menus and forms are sheets; on wide screens, popovers and
// dialogs" (the UI layout decision): what an overlay is depends on where it sits on the screen, so
// it is read in a real layout, opened from the real pages, at both sizes. Back closes a sheet and
// leaves the page's address as it was.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, drawn, opened, repository } from "./helpers.tsx";

const narrow = () => window.innerWidth < 768;

/**
 * Once its entrance ends: a sheet along the screen's bottom edge and its full width on a phone, a
 * box over the page, narrower than the window, on a desktop.
 */
async function expectKind(overlay: Element) {
  await expect
    .poll(() => {
      const box = overlay.getBoundingClientRect();
      return narrow()
        ? Math.round(box.bottom) === window.innerHeight &&
            Math.round(box.width) === window.innerWidth
        : box.width > 0 && box.width < window.innerWidth / 2 && box.bottom < window.innerHeight;
    })
    .toBe(true);
}

/** The side navigation's repository menu, opened from its trigger. */
async function openRepositories() {
  const bar = narrow()
    ? screen.getByRole("banner")
    : screen.getByRole("navigation", { name: "Side navigation" });
  const trigger = within(bar).getByRole("button", { name: `Uraeda ${repository()}` });
  await userEvent.click(trigger);
  const menu = await screen.findByRole("dialog", { name: "Repositories" });
  await drawn();
  return { menu, trigger };
}

/** The inbox's "add a note" form, from ＋: in the phone's drawer, or the navigation beside the page. */
async function openNoteForm() {
  if (narrow()) {
    await userEvent.click(screen.getByRole("button", { name: "Open navigation" }));
  }
  await userEvent.click(await screen.findByRole("button", { name: "Add a note to the inbox" }));
  const form = await screen.findByRole("dialog", { name: "Add a note" });
  await drawn();
  return form;
}

describe("a menu", () => {
  test("is a sheet on a phone and a popover on a desktop", async () => {
    await opened("/");
    const { menu, trigger } = await openRepositories();

    await expectKind(menu);
    if (!narrow()) {
      // Under its trigger, not over the page's middle.
      expect(menu.getBoundingClientRect().top).toBeGreaterThanOrEqual(
        trigger.getBoundingClientRect().bottom - 1,
      );
    }
  });

  test("closes with its Close on a phone, with Escape on a desktop", async () => {
    await opened("/");
    const { menu } = await openRepositories();

    if (narrow()) {
      await userEvent.click(within(menu).getByRole("button", { name: "Close" }));
    } else {
      await userEvent.keyboard("{Escape}");
    }

    await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
  });
});

describe("a form", () => {
  test("is a sheet on a phone and a dialog on a desktop, and its text is asked about before it is lost", async () => {
    await opened("/inbox");
    const form = await openNoteForm();
    await expectKind(form);

    await userEvent.type(within(form).getByRole("textbox"), "A note left half written");
    await userEvent.click(within(form).getByRole("button", { name: "Cancel" }));
    // Leaving it asks first, in an overlay of its own.
    const asking = await screen.findByRole("dialog", { name: /discard/i });
    await expectKind(asking);
    await userEvent.click(within(asking).getByRole("button", { name: /keep/i }));

    await expect.poll(() => screen.queryByRole("dialog", { name: /discard/i })).toBeNull();
    expect(
      (
        within(screen.getByRole("dialog", { name: "Add a note" })).getByRole(
          "textbox",
        ) as HTMLTextAreaElement
      ).value,
    ).toBe("A note left half written");
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("Back closes a sheet and leaves the page where it was", async () => {
    await opened("/inbox");
    const path = window.location.pathname;
    const { menu } = await openRepositories();
    await expectKind(menu);

    window.history.back();

    await expect.poll(() => screen.queryByRole("dialog", { name: "Repositories" })).toBeNull();
    expect(window.location.pathname).toBe(path);
    expect(path).toBe(atRepo("/inbox"));
  });
});
