// US8 5, on the desktop: the decisions page's keys go from the principles to the decisions, the
// reader following, and Escape returns the reader to the constitution (R25). US4 of the layout
// look: the list takes 30% of the window, the active pane, and `/` opens the palette, which previews
// the entry under the cursor beside its list. The fixture's decisions all changed the
// same day, so the latest first are A to Z.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { commands as browserCommands, userEvent } from "vite-plus/test/browser";
import type { RepoCommands } from "../../vite.browser.config.ts";
import { atRepo, atSize, drawn, reload, show } from "./helpers.tsx";

atSize("desktop");

/** The link of the first decision's row, Agents. */
function agents() {
  return within(screen.getByRole("list", { name: "Decisions" })).getByRole("link", {
    name: /^Agents/,
  });
}

test("↓ from the last principle selects and shows the first decision (US8 5)", async () => {
  await show("/decisions/constitution/vi", "Code is checked and stays maintainable");
  within(screen.getByRole("region", { name: "Constitution" }))
    .getByRole("link", { name: /Code is checked and stays maintainable/ })
    .focus();
  await drawn();

  await userEvent.keyboard("{ArrowDown}");

  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions/agents"));
  await expect.poll(() => document.activeElement).toBe(agents());
  const pane = within(screen.getByRole("region", { name: "Detail" }));
  expect(await pane.findByRole("heading", { level: 2, name: "Agents" })).toBeTruthy();
  expect(agents().closest("li")?.getAttribute("aria-current")).toBe("true");

  await userEvent.keyboard("{ArrowUp}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions/constitution/vi"));

  // The reader stays open: Escape returns it to the constitution.
  await userEvent.keyboard("{Escape}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions"));
  // The page is drawn anew for the new entry: the reader is found once it is.
  await screen.findByRole("heading", { name: "Uraeda Constitution" });
  const reader = within(screen.getByRole("region", { name: "Detail" }));
  expect(reader.getByRole("heading", { name: "Uraeda Constitution" })).toBeTruthy();
});

/** Where the reader shows principle V, "Tools are optional": its heading's top, from the reader's. */
function fifthPrinciple() {
  const reader = screen.getByRole("region", { name: "Detail" });
  const heading = within(reader).getByRole("heading", { name: /Tools are optional/ });
  return heading.getBoundingClientRect().top - reader.getBoundingClientRect().top;
}

// The UI behaviour decision: Back and reload keep the human's place, over the principle the address
// names.
test("scrolled to principle V from principle III's address, a reload keeps the reader at V", async () => {
  await show("/decisions/constitution/iii", "Asynchronous by default");
  const reader = screen.getByRole("region", { name: "Detail" });
  await expect.poll(() => reader.scrollTop).toBeGreaterThan(0);
  reader.scrollTop += fifthPrinciple();
  await drawn();
  const place = reader.scrollTop;
  // Saved in the entry within 500 ms of the scroll, as a reload's `pagehide` would.
  await expect.poll(() => (window.history.state as { pane?: number } | null)?.pane).toBe(place);

  await reload("Asynchronous by default");

  const again = screen.getByRole("region", { name: "Detail" });
  await expect.poll(() => again.scrollTop).toBe(place);
  await drawn();
  expect(again.scrollTop).toBe(place);
  expect(Math.abs(fifthPrinciple())).toBeLessThan(2);
});

const commands = browserCommands as unknown as RepoCommands;

const NOTIFICATIONS = `---
status: active
approved-by: mrtolkien
icon: bell
---

# Notifications

The server tells the human when a feature waits on them, through the browser's notifications.

## Rules

- The server MUST notify the human when a feature waits on them. Checked by the browser tests.
- A notification SHOULD name the feature and its step. Checked by review.
`;

test("`/`, “noti”, and Enter open Notifications, previewed beside the list (US4 3, SC-005)", async () => {
  await commands.commitOnBranch("main", { "specs/decisions/notifications.md": NOTIFICATIONS });
  await show("/decisions/agents", "runs coding agents");
  agents().focus();
  await drawn();

  await userEvent.keyboard("/");
  const field = await screen.findByRole("combobox", { name: "Jump to a decision or principle" });
  await expect.poll(() => document.activeElement).toBe(field);
  // ↓ moves the palette's cursor, never the list behind it.
  await userEvent.keyboard("{ArrowDown}");
  expect(window.location.pathname).toBe(atRepo("/decisions/agents"));

  await userEvent.keyboard("noti");
  const option = await screen.findByRole("option", { name: "Notifications" });
  const preview = screen.getByRole("region", { name: "Preview" });
  await expect
    .poll(() => within(preview).queryByRole("heading", { name: "Notifications" }))
    .toBeTruthy();
  expect(within(preview).getByText(/tells the human when a feature waits on them/)).toBeVisible();
  expect(within(preview).getByText(/notify the human when a feature waits on them/)).toBeVisible();
  // The preview sits beside the list, not under it.
  expect(preview.getBoundingClientRect().left).toBeGreaterThanOrEqual(
    option.getBoundingClientRect().right,
  );

  await userEvent.keyboard("{Enter}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions/notifications"));
  // The page is drawn anew for the new entry: the reader is found once it is.
  await screen.findByRole("heading", { level: 2, name: "Notifications" });
  const reader = within(screen.getByRole("region", { name: "Detail" }));
  expect(reader.getByRole("heading", { level: 2, name: "Notifications" })).toBeTruthy();
  expect(screen.queryByRole("combobox", { name: "Jump to a decision or principle" })).toBeNull();
});

/** An element's top border's colour. */
const border = (element: HTMLElement) => getComputedStyle(element).borderTopColor;

test("the list is the active pane, 30% of the window, the reader taking the rest (US4)", async () => {
  await show("/decisions", "Uraeda Constitution");

  const list = screen.getByRole("region", { name: "Constitution and decisions" });
  const reader = screen.getByRole("region", { name: "specs/CONSTITUTION.md" });
  const width = list.getBoundingClientRect().width;
  // The pane's border is inside its column, a few pixels narrower than 30%.
  expect(width / window.innerWidth).toBeGreaterThan(0.28);
  expect(width / window.innerWidth).toBeLessThanOrEqual(0.3);
  expect(reader.getBoundingClientRect().width).toBeGreaterThan(width);
  // The active pane's border is the accent's, the reader's the neutral one.
  expect(border(list)).not.toBe(border(reader));
});
