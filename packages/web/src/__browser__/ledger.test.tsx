// US2 of the spec page, in the browser: each decision's pane takes its kind's colour, green when
// new, mauve when changed, red when removed (US1 key 2); every removed word is struck, so a change
// never rests on colour alone (SC-001), in both schemes; and the ledger fits the phone's screen
// (SC-006). The rows, their signs, and their folds are checked in `__tests__/ledger.test.tsx`.
import { fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { rgb } from "./colours.ts";
import { atSize, checkPage, colorScheme, commands, drawn, show } from "./helpers.tsx";

const PAGE = "/f/2026-10-17-spec-page/spec.md";

atSize("both");

/** A decision's pane, by its title. */
const pane = (name: string) => screen.getByRole("region", { name });

/** Opens every fold of the main region, folds inside folds included. */
async function unfoldAll() {
  const main = screen.getByRole("main");
  for (
    let folded = within(main).queryAllByRole("button", { expanded: false });
    folded.length > 0;
  ) {
    for (const fold of folded) {
      fireEvent.click(fold);
    }
    await drawn();
    folded = within(main).queryAllByRole("button", { expanded: false });
  }
}

test("each decision's pane takes its kind's colour, and removed words are struck", async () => {
  await commands.addSpecFeature();
  await show(PAGE, "Task storage");
  await unfoldAll();

  for (const mode of ["light", "dark"] as const) {
    await colorScheme(mode);
    await drawn();
    const border = (name: string) => getComputedStyle(pane(name)).borderTopColor;
    const [added, changed, removed] = ["Repeating tasks", "Task storage", "Task history"].map(
      border,
    );
    // Green, mauve, and red: three colours, the green's green channel and the red's red highest.
    expect(new Set([added, changed, removed]).size, mode).toBe(3);
    const [ar, ag, ab] = rgb(added!);
    expect(ag, mode).toBeGreaterThan(Math.max(ar, ab));
    const [rr, rg, rb] = rgb(removed!);
    expect(rr, mode).toBeGreaterThan(Math.max(rg, rb));
    // Every removed word, a changed rule's or a whole rule's, is struck.
    const deletions = within(screen.getByRole("main")).getAllByRole("deletion");
    expect(deletions.length).toBeGreaterThan(3);
    for (const deletion of deletions) {
      expect(getComputedStyle(deletion).textDecorationLine, deletion.textContent ?? "").toContain(
        "line-through",
      );
    }
  }
});

/** "Marked in place": the decision's own page mutes no kept part, its whole text read. */
test("the decision's page draws its kept parts as its changed ones", async () => {
  await commands.addSpecFeature();
  await show("/f/2026-10-17-spec-page/decisions/task-storage", "Task storage");

  const consequences = within(pane("Task storage")).getByRole("group", { name: "Consequences" });
  const colour = (words: RegExp) => getComputedStyle(within(consequences).getByText(words)).color;
  expect(colour(/^Stored data is tested in one place/)).toBe(
    colour(/^A corrupted value costs the user that value/),
  );
});

test("the ledger fits the screen, every fold open", async () => {
  await commands.addSpecFeature();
  await show(PAGE, "Task storage");
  await unfoldAll();

  checkPage();
});
