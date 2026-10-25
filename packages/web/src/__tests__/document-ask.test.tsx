// US4.2 and the agent's absence: "Ask the agent" on a proposal's paragraph quotes its lines in the
// column's Session tab, as the spec's page does; without the agent, a paragraph takes no tap.
import { screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, click, renderPage } from "./helpers.tsx";

const RECURRING = "2026-10-06-recurring-tasks";
const PROPOSAL = `/f/${RECURRING}/proposal.md`;
/** The proposal's What paragraph, on lines 5 and 6 of its file. */
const WHAT = "Let users mark a task as repeating";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

test("asking about a paragraph opens Session with the quote", async () => {
  await renderPage(PROPOSAL, undefined, { agent: true });
  const what = await screen.findByRole("region", { name: "What" });

  await click(within(what).getByText(new RegExp(WHAT)));
  await click(await screen.findByRole("button", { name: "Ask the agent" }));

  const panel = screen.getByRole("tabpanel", { name: /^Session/ });
  const box = await within(panel).findByRole("textbox", { name: "Message Claude Code" });
  await waitFor(() =>
    expect(box.textContent).toBe(
      `About specs/${RECURRING}/proposal.md, lines 5\u20136:\n` +
        '> Let users mark a task as repeating, like "water the plants" every week. When they complete it, it\n' +
        "> comes back for the next time.\n\n",
    ),
  );
  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
});

test("Clear drops the selection without asking", async () => {
  await renderPage(PROPOSAL, undefined, { agent: true });
  const what = await screen.findByRole("region", { name: "What" });

  await click(within(what).getByText(new RegExp(WHAT)));
  await click(await screen.findByRole("button", { name: "Clear" }));

  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
});

test("without the agent, a paragraph selects nothing and no Session tab shows", async () => {
  await renderPage(PROPOSAL);
  const what = await screen.findByRole("region", { name: "What" });

  await click(within(what).getByText(new RegExp(WHAT)));

  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
  const column = within(screen.getByRole("complementary", { name: "The proposal's column" }));
  expect(column.queryByRole("tab", { name: "Session" })).toBeNull();
});
