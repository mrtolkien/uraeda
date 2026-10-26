// "Contents", a tab of the spec's and the plan's column, and the phone's sheet: every part,
// decision, and story, each with the count of pending comments on it, the part at the top marked,
// a tap jumping to it.
import type { CommentItem, DecisionChange, Document } from "uraeda-binding";
import { OutlineRows, type OutlineRow } from "../layout/OutlineRows.tsx";
import { holderOf } from "../reviewField.ts";
import { jumpTo, useQuestionAtTop } from "../roundJump.ts";
import { useColumnGo } from "./columnGo.ts";
import {
  BUILT_PARTS,
  decisionId,
  decisionPanes,
  entryOfBlock,
  entryOwners,
  GROUPS,
  groupId,
  otherParts,
  partOf,
  type SpecItems,
  storyId,
} from "./parts.ts";

/**
 * An entry of "Contents": the element it jumps to, its text, its depth, its comments, whether it
 * holds a part changed since your review, and a plan's task's state.
 */
export type Entry = OutlineRow;

/**
 * The entry a comment counts for: its decision's, for a decision comment, whose lines are the
 * decision's own; else the innermost entry of its block in the spec.
 */
function ownerOf(document: Document, owners: Map<number, string>, comment: CommentItem) {
  if (comment.decision != null) {
    return decisionId(comment.decision);
  }
  return entryOfBlock(document, owners, holderOf(document, comment.endLine));
}

/** The number of comments on each entry. */
function countsOf(document: Document, items: SpecItems, comments: ReadonlyArray<CommentItem>) {
  const owners = entryOwners(document, items);
  const counts = new Map<string, number>();
  for (const comment of comments.filter((c) => !c.general)) {
    const owner = ownerOf(document, owners, comment);
    if (owner) {
      counts.set(owner, (counts.get(owner) ?? 0) + 1);
    }
  }
  return counts;
}

/**
 * The entries of "Contents", in the page's order: what you approve; "Since your review", while its
 * pane shows; your review answered, on a revision; the decisions, the listed ones then the others
 * the branch changes, all counted (R21); the stories; the replaced behaviour, when the spec has it; the data, when the feature has a data model;
 * then the parts after them.
 */
export function entriesOf({
  changes,
  comments,
  document,
  hasData,
  hasSince = false,
  items,
  since = new Set(),
}: {
  changes: ReadonlyArray<DecisionChange>;
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  hasData: boolean;
  /** Whether the page shows "Since your review", `id="since"`. */
  hasSince?: boolean;
  items: SpecItems;
  /** The entries holding a part changed since your review. */
  since?: ReadonlySet<string>;
}): Array<Entry> {
  const counts = countsOf(document, items, comments);
  const entry = (id: string, label: string, nested = false): Entry => ({
    count: counts.get(id) ?? 0,
    id,
    label,
    nested,
    since: since.has(id),
  });
  const decisions = decisionPanes(items.decisions, changes);
  return [
    entry(GROUPS.approve.id, GROUPS.approve.title),
    ...(hasSince ? [entry("since", "Since your review")] : []),
    ...(partOf(items, "Your review")
      ? [entry(groupId(items, GROUPS.answers), GROUPS.answers.title)]
      : []),
    ...(decisions.length > 0
      ? [entry(groupId(items, GROUPS.decisions), `${GROUPS.decisions.title} · ${decisions.length}`)]
      : []),
    ...decisions.map((d) => entry(decisionId(d.name), d.title, true)),
    ...(items.stories.length > 0
      ? [entry(groupId(items, GROUPS.stories), `${GROUPS.stories.title} · ${items.stories.length}`)]
      : []),
    ...items.stories.map((s) => entry(storyId(document, s), `${s.id} ${s.title}`, true)),
    ...(partOf(items, "Replaced behaviour")
      ? [entry(groupId(items, GROUPS.replaced), GROUPS.replaced.title)]
      : []),
    ...(hasData ? [entry(GROUPS.data.id, GROUPS.data.title)] : []),
    ...BUILT_PARTS.flatMap((title) => {
      const part = partOf(items, title);
      return part ? [entry(part.anchor, part.title)] : [];
    }),
    ...otherParts(items).map((part) => entry(part.anchor, part.title)),
  ];
}

/**
 * "Contents": every entry, the part at the top marked, a tap jumping to its part and focusing its
 * title, through the column, which closes the phone's sheet first. Each entry is a link to its
 * part, which a click with a modifier opens as the browser does.
 */
export function Contents({ entries }: { entries: ReadonlyArray<Entry> }) {
  const go = useColumnGo();
  const current = useQuestionAtTop(
    entries.map((entry) => entry.id),
    true,
  );
  return (
    <OutlineRows
      asLinks
      current={current ?? entries[0]?.id}
      label="Parts"
      onPick={(id) => go(() => jumpTo(id))}
      runs={[entries]}
    />
  );
}
