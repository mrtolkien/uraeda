// "An open detail MUST be in the URL, so reload, Back, or a width change keeps it" (the UI layout
// decision), and text being typed is never dropped (the UI behaviour decision): the window crosses
// the width classes' edge, from a wide screen to a narrow one and back, with a pane open and a
// comment half written. happy-dom has no window to resize.
import { screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, opened } from "./helpers.tsx";

atSize("desktop");

const WIDE = { height: 900, width: 1440 };
const NARROW = { height: 900, width: 700 };

afterEach(async () => {
  await page.viewport(WIDE.width, WIDE.height);
});

/** A narrow window's layout is drawn once the width has changed. */
async function resizeTo(size: typeof WIDE) {
  await page.viewport(size.width, size.height);
  await expect.poll(() => window.innerWidth).toBe(size.width);
}

/** The links to a line of the priorities, outside the pane. */
function rows() {
  const pane = screen.queryByRole("region", { name: "Detail" });
  return within(screen.getByRole("main"))
    .queryAllByRole("link")
    .filter(
      (link) =>
        (link.getAttribute("href") ?? "").startsWith(`${atRepo("/priorities")}/`) &&
        !pane?.contains(link),
    );
}

test("a pane open keeps its address as the window narrows and widens again", async () => {
  await opened("/priorities");
  await userEvent.click(rows()[0]!);
  const address = window.location.pathname;
  expect(address).not.toBe(atRepo("/priorities"));
  await expect.poll(() => screen.queryByRole("region", { name: "Detail" })).not.toBeNull();

  await resizeTo(NARROW);

  // The pane is a page of its own, at the same address, with the list no longer beside it.
  await expect.poll(() => screen.queryByRole("region", { name: "Detail" })).toBeNull();
  expect(rows()).toHaveLength(0);
  expect(window.location.pathname).toBe(address);

  await resizeTo(WIDE);

  // Beside the list again, at the same address.
  expect(await screen.findByRole("region", { name: "Detail" })).toBeTruthy();
  expect(rows().length).toBeGreaterThan(1);
  expect(window.location.pathname).toBe(address);
});

test("a comment being typed keeps its text and focus as the window narrows", async () => {
  await opened("/f/2026-10-11-web-ui/clarifications-01.md");
  const field = screen.getAllByRole("textbox", { name: /^Comment/ })[0] as HTMLTextAreaElement;
  await userEvent.click(field);
  await userEvent.keyboard("Only from home");

  await resizeTo(NARROW);

  // The narrow layout is drawn: the page keeps its field, with its text and the focus in it.
  await expect.poll(() => field.isConnected).toBe(true);
  expect(field.value).toBe("Only from home");
  expect(document.activeElement).toBe(field);
});
