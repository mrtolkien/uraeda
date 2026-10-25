// The plan page in WebKit on a wide screen: a plan read as it is now lays its text out as the same
// plan waiting for review does, its paragraphs as far from their pane's border.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atSize, commands, drawn, show } from "./helpers.tsx";

atSize("desktop");

const FOLDER = "2026-10-13-plan-review";

/** The Goal's text's left edge, from its pane's inner edge, the plan at `status`. */
async function goalInset(plan: string, status: string) {
  await commands.commitOnBranch(FOLDER, {
    [`specs/${FOLDER}/plan.md`]: plan.replace("status: auto-approved", `status: ${status}`),
  });
  await show(`/f/${FOLDER}/plan.md`, "Global constraints");
  await drawn();
  const pane = screen.getByRole("region", { name: "Goal" });
  const text = within(pane).getByText(/the round of questions draws/);
  const range = document.createRange();
  range.selectNodeContents(text);
  const inner =
    pane.getBoundingClientRect().left + Number.parseFloat(getComputedStyle(pane).borderLeftWidth);
  return range.getClientRects()[0]!.left - inner;
}

test("a plan read as it is lays its text as far from its pane's border as waiting for review", async () => {
  const plan = await commands.fixtureText("plan-page/plan.md");
  const read = await goalInset(plan, "auto-approved");
  const waiting = await goalInset(plan, "awaiting-human");
  expect(Math.abs(read - waiting), `read at ${read} px, waiting at ${waiting} px`).toBeLessThan(1);
});
