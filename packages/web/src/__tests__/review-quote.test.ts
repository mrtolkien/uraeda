// What "Ask the agent" quotes of a decision's parts: one removed part is "the removed rule", or
// "part" outside the rules; several are "rules" or "parts".
import type { DecisionChange, PartChange } from "uraeda-binding";
import { expect, test } from "vite-plus/test";
import { quoteOfRange } from "../reviewQuote.ts";

/** A part removed by the branch, at `start`, one line long. */
const removed = (start: number, text: string): PartChange => ({
  before: { end: start, start },
  check: [],
  kind: "removed",
  runs: [{ kind: "removed", text }],
});

/** The decision `storage`, whose rules and context each lost two parts. */
const change: DecisionChange = {
  compared: true,
  fields: [],
  kind: "changed",
  listed: true,
  name: "storage",
  sections: [
    { parts: [removed(10, "One."), removed(11, "Two.")], title: "Rules" },
    { parts: [removed(20, "Three."), removed(21, "Four.")], title: "Context" },
  ],
  title: "Storage",
};

/** The quote of lines `start` to `end` of the removed side of `storage`'s `heading`. */
const quote = (heading: string, start: number, end: number) =>
  quoteOfRange({ decisionChanges: [change], path: "specs/f/spec.md" }, "", {
    decision: { name: "storage", removed: true },
    end,
    heading,
    start,
  });

test("one removed rule is the removed rule", () => {
  expect(quote("Rules", 10, 10)).toBe(
    "About the removed rule of specs/decisions/storage.md, line 10:\n> One.",
  );
});

test("several removed rules are the removed rules", () => {
  expect(quote("Rules", 10, 11)).toBe(
    "About the removed rules of specs/decisions/storage.md, lines 10–11:\n> One.\n> Two.",
  );
});

test("several removed parts outside the rules are the removed parts", () => {
  expect(quote("Context", 20, 21)).toBe(
    "About the removed parts of specs/decisions/storage.md, lines 20–21:\n> Three.\n> Four.",
  );
});
