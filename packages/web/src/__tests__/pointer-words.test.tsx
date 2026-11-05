// What a pointer's user reads before pressing, with no key to learn it by (the Lolly persona of
// `specs/ui/personas.md`): the priorities' view switch says its views in words, an icon-only button
// names itself in its tooltip, a question's "Ask the agent" is a button, and a new feature's name is
// asked for in plain words.
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, fixtureRepo, renderPage } from "./helpers.tsx";

beforeEach(() => {
  atWidth(1440);
});

/** The tooltip `button` says on hover and focus: the text of what describes it. */
function tooltipOf(button: HTMLElement) {
  const ids = button.getAttribute("aria-describedby")?.split(" ") ?? [];
  return ids.map((id) => document.getElementById(id)?.textContent ?? "").join(" ");
}

test("the priorities' view switch shows Columns and List in words, and List lists them", async () => {
  await renderPage("/priorities", fixtureRepo());
  const view = await screen.findByRole("radiogroup", { name: "View" });

  const columns = within(view).getByRole("radio", { name: "Columns" });
  const list = within(view).getByRole("radio", { name: "List" });
  // Shown, not only the accessible name of an icon.
  expect(columns.textContent).toContain("Columns");
  expect(list.textContent).toContain("List");

  await click(list);
  await waitFor(() => expect(list.getAttribute("aria-checked")).toBe("true"));
});

test("the sidebar's ＋ beside the inbox names what it adds in its tooltip", async () => {
  await renderPage("/", fixtureRepo());
  const plus = await screen.findByRole("button", { name: "Add a note to the inbox" });

  await waitFor(() => expect(tooltipOf(plus)).toContain("Add a note to the inbox"));
});
