// What "Ask the agent" quotes of a review's selection: the reviewed file's lines, or a decision's
// parts, from the decision's own file.
import type { DecisionChange, Run } from "uraeda-binding";
import { linesOf } from "./reviewField.ts";
import { quoted } from "./sessions.ts";
import { rangeOf } from "./spec/ledger/context.ts";
import type { Range } from "./useCommentDraft.ts";

/** The words of a part on one side: the branch's, or, for a removed part, the removed words. */
function wordsOf(runs: ReadonlyArray<Run>, removed: boolean) {
  return runs
    .filter((run) => run.kind !== (removed ? "added" : "removed"))
    .map((run) => run.text)
    .join(" ");
}

/**
 * The quote of a decision's parts in `range`: `About specs/decisions/<name>.md, lines A–B:`, then
 * each part's words, a part removed by the branch read from the default branch's file, "About the
 * removed rule of …", or "removed part" outside the rules, "rules" or "parts" when several are.
 */
function decisionQuote(
  changes: ReadonlyArray<DecisionChange>,
  range: Range & { decision: NonNullable<Range["decision"]> },
) {
  const { name, removed } = range.decision;
  const path = `specs/decisions/${name}.md`;
  const lines = (changes.find((change) => change.name === name)?.sections ?? []).flatMap(
    (section) =>
      section.parts.flatMap((part) => {
        const at = rangeOf(name, section.title, part);
        const inside =
          at?.decision.removed === removed && at.start >= range.start && at.end <= range.end;
        return inside ? [wordsOf(part.runs, removed)] : [];
      }),
  );
  const part = `${range.heading === "Rules" ? "rule" : "part"}${lines.length > 1 ? "s" : ""}`;
  const what = removed ? `the removed ${part} of ` : "";
  return quoted(`About ${what}${path}, ${linesOf(range)}:`, lines);
}

/**
 * The quote of the selected lines: `About <path>, lines A–B:` then each line as the reviewed
 * version's `text` has it after `> `; a decision's lines quote its parts (see `decisionQuote`).
 */
export function quoteOfRange(
  file: { decisionChanges: ReadonlyArray<DecisionChange>; path: string },
  text: string,
  range: Range,
) {
  if (range.decision) {
    return decisionQuote(file.decisionChanges, { ...range, decision: range.decision });
  }
  const lines = text.split("\n").slice(range.start - 1, range.end);
  return quoted(`About ${file.path}, ${linesOf(range)}:`, lines);
}
