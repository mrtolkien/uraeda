// A question holding a diagram keeps one column, as one holding a table does: in a split card's
// question column, about 50 characters wide, a flowchart showed a third of itself and scrolled.
import { readFile } from "uraeda-binding";
import { fixtureRepo } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { holdsWide } from "../Question.tsx";

// Break: drop the `mermaid` blocks from `holdsWide`.
test("a question with a diagram in its context holds something wide", async () => {
  const file = await readFile(fixtureRepo(), "2026-10-06-recurring-tasks", "clarifications-01.md");
  const { document, items } = file.current;
  const questions = items.clarifications!.questions;
  const diagram = questions.find((q) => q.id === "Q2")!;
  const plain = questions.find((q) => q.id === "Q1")!;

  expect(holdsWide(null, document, diagram)).toBe(true);
  expect(holdsWide(null, document, plain)).toBe(false);
});
