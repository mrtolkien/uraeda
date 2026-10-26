// US3 3 and the priorities' `i` and `m` in a real browser, where the focus is real: `m` opens the
// line's menu with its first item focused, and once the menu closes the focus is back on the line,
// so the keys go on; `i` puts the focus in the line's editor, and leaving it returns the focus.
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atSize, show } from "./helpers.tsx";

const commands = browserCommands as unknown as RepoCommands;

atSize("desktop");

const PRIORITIES = `# Priorities

## Now

- Now line 1

## Next

- Next line 1
- Next line 2

## Later

- Later line 1
`;

/** Opens the page with the focus on the card of `line`. */
async function onLine(line: string) {
  await commands.writeRepo(PRIORITIES, "specs/PRIORITIES.md");
  await show("/priorities", line);
  const link = screen
    .getAllByRole("link", { name: new RegExp(line) })
    .find((one) => one.closest("[data-row]") !== null) as HTMLElement;
  link.focus();
  expect(document.activeElement).toBe(link);
  return link;
}

test("m opens the menu of the line, and the focus returns to the line once it closes", async () => {
  const link = await onLine("Next line 2");

  await userEvent.keyboard("m");

  expect(await screen.findByRole("menuitem", { name: "Move to Later" })).toBeTruthy();
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("menuitem")).toBeNull());
  await waitFor(() => expect(document.activeElement).toBe(link));
  // The keys go on: k moves the selection to the line before it, wherever the focus was.
  await userEvent.keyboard("k");
  await waitFor(() => expect(document.activeElement?.textContent).toContain("Next line 1"));
});

test("m, then an item, moves the line, as the button does", async () => {
  await onLine("Next line 2");

  await userEvent.keyboard("m");
  await userEvent.click(await screen.findByRole("menuitem", { name: "Move to Later" }));

  await expect
    .poll(async () =>
      (await commands.readRepo()).includes("## Later\n\n- Later line 1\n- Next line 2"),
    )
    .toBe(true);
});

test("i puts the focus in the line's editor, and Escape returns it to the line", async () => {
  await onLine("Next line 2");

  await userEvent.keyboard("i");

  const field = await screen.findByRole("textbox", { name: "Edit Next line 2" });
  await waitFor(() => expect(document.activeElement).toBe(field));
  await userEvent.keyboard("{Escape}");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: /^Edit / })).toBeNull());
  // The line's link is drawn again once the editor leaves: the focus is on it, not on the page.
  await waitFor(() => {
    expect(document.activeElement?.closest("[data-row]")).not.toBeNull();
    expect(document.activeElement?.textContent).toContain("Next line 2");
  });
});

test("a opens the add form, and the focus is in its text field", async () => {
  await onLine("Next line 2");

  await userEvent.keyboard("a");

  const field = await screen.findByRole("textbox", { name: "Priority" });
  await waitFor(() => expect(document.activeElement).toBe(field));
});
