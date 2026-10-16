// US8 5, on the desktop: the decisions page's keys go from the principles to the decisions, the
// pane following, and Escape closes the pane. The fixture's decisions all changed the same day, so
// the latest first are A to Z.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atRepo, atSize, drawn, show } from "./helpers.tsx";

atSize("desktop");

/** The link of the first decision's row, Agents. */
function agents() {
  return within(screen.getByRole("list", { name: "Decisions" })).getByRole("link", {
    name: /^Agents/,
  });
}

test("↓ from the last principle selects and shows the first decision (US8 5)", async () => {
  await show("/decisions/constitution/vi", "Code is checked and stays maintainable");
  screen.getByRole("link", { name: "VI. Code is checked and stays maintainable" }).focus();
  await drawn();

  await userEvent.keyboard("{ArrowDown}");

  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions/agents"));
  await expect.poll(() => document.activeElement).toBe(agents());
  const pane = within(screen.getByRole("region", { name: "Detail" }));
  expect(await pane.findByRole("heading", { level: 2, name: "Agents" })).toBeTruthy();
  expect(agents().closest("li")?.getAttribute("aria-current")).toBe("true");

  await userEvent.keyboard("{ArrowUp}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions/constitution/vi"));

  await userEvent.keyboard("{Escape}");
  await expect.poll(() => window.location.pathname).toBe(atRepo("/decisions"));
  await expect.poll(() => screen.queryByRole("region", { name: "Detail" })).toBeNull();
});
