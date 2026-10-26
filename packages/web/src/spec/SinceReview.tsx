// "Since your review", under the spec's block on a revision: the places changed since the version
// you reviewed, as the core compared them, each a button jumping to it, and the parts removed,
// struck, under a fold. Which blocks hold a change, so the page marks them Δ, and which entries of
// "Contents" own one. A place is an entry of "Contents", in a story its journey or a scenario.
import { List, ListItem } from "@astryxdesign/core/List";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import type { Block, Document, LineRange, SinceChange, SinceReview } from "uraeda-binding";
import { type Fold, foldOf } from "../Folds.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { jumpTo } from "../roundJump.ts";
import type { SinceMark, SinceScope } from "../sinceMarks.tsx";
import { useOpenKeys } from "../useOpenKeys.ts";
import { entryOfBlock, entryOwners, placeInStory, type SpecItems } from "./parts.ts";
import { Runs } from "./RuleLine.tsx";
import type { Entry } from "./SpecContents.tsx";
import { plural } from "../labels.ts";
import { Foldable } from "../layout/Foldable.tsx";
import { Empty } from "../layout/Empty.tsx";

const styles = stylex.create({
  removed: { margin: 0 },
});

/**
 * A place changed since your review: the entry of "Contents" owning it, its own name within that
 * entry, if any ("US2's journey"), and the id of its first marked block, a jump's target.
 */
export type SincePlace = {
  /** Its first marked block's id, its order within its entry. */
  block: number;
  entry: string | undefined;
  /** Its change's heading, its name when no entry owns it. */
  heading: string;
  id: string;
  within: string | undefined;
};

/** What changed since your review, as the page draws it. */
export type SinceModel = {
  /** The marks of the blocks holding a change's lines, by block id, in the spec's tree. */
  marks: SinceScope;
  /** The places changed or added, in the core's order: the pane sorts them in the page's. */
  places: ReadonlyArray<SincePlace>;
  /** The parts removed, drawn in the pane only. */
  removed: ReadonlyArray<SinceChange>;
  since: SinceReview;
};

/** The kinds a part of the core's cutting can be: a list, a table, or a quote only holds them. */
const HOLDERS = new Set<Block["kind"]>(["list", "table", "quote", "cell"]);

/** The block drawn for a part's lines: the innermost one spanning exactly them. */
function blockAt(document: Document, lines: LineRange): Block | undefined {
  return document.blocks.findLast(
    (b) => !HOLDERS.has(b.kind) && b.startLine === lines.start && b.endLine === lines.end,
  );
}

/** Whether a block is the title of a pane or a group: a section's heading, or a story's. */
function isTitle(items: SpecItems, block: Block): boolean {
  return (
    block.kind === "heading" &&
    (items.parts.some((part) => part.heading === block.id) ||
      items.stories.some((story) => story.headingBlock === block.id))
  );
}

/**
 * Which blocks hold a change of `since`, and the places they make, in the page's order. A title
 * changed, a section or a story renamed, marks its pane's or group's title, its place jumping
 * there.
 */
export function sinceModel(
  document: Document,
  items: SpecItems,
  since: SinceReview | undefined,
): SinceModel | undefined {
  if (!since) {
    return undefined;
  }
  const owners = entryOwners(document, items);
  const marks = new Map<number, SinceMark>();
  const titles = new Set<string>();
  const places: Array<SincePlace> = [];
  for (const change of since.parts) {
    const block = change.after && blockAt(document, change.after);
    if (!block) {
      continue;
    }
    const entry = entryOfBlock(document, owners, block);
    const within = placeInStory(document, items, block);
    const known = places.find((p) => p.entry === entry && p.within === within);
    const title = entry !== undefined && isTitle(items, block);
    const id = known ? undefined : title ? entry : `since-${places.length + 1}`;
    if (id) {
      places.push({ block: block.id, entry, heading: change.heading, id, within });
    }
    if (title) {
      titles.add(entry);
    } else {
      marks.set(block.id, { change, id });
    }
  }
  const removed = since.parts.filter((change) => change.kind === "removed");
  return { marks: { document, marks, titles }, places, removed, since };
}

/** The folds holding a block marked, which the page opens so its mark shows. */
export function sinceFolds(
  document: Document,
  model: SinceModel | undefined,
  folds: ReadonlyArray<Fold> | undefined,
): Array<string> {
  if (!model || !folds) {
    return [];
  }
  const holders = new Set(
    [...model.marks.marks.keys()].map((id) => foldOf(document, folds, document.blocks[id])),
  );
  return folds.filter((fold) => holders.has(fold)).map((fold) => fold.key);
}

/** "1 part" or "3 parts". */
const parts = (count: number) => plural(count, "part");

/** The pane's title: what it counts, the places changed, else the parts removed. */
function titleOf({ places, removed, since }: SinceModel) {
  if (since.found && places.length > 0) {
    return `Since your review · ${parts(places.length)} changed`;
  }
  if (since.found && removed.length > 0) {
    return `Since your review · ${parts(removed.length)} removed`;
  }
  return "Since your review";
}

/** The fold's key among the history entry's open items. */
const REMOVED_KEY = "since-removed";

/** The parts removed, struck, under "N parts removed", kept open in the history entry. */
function Removed({ removed }: { removed: ReadonlyArray<SinceChange> }) {
  const keys = useOpenKeys();
  const isOpen = keys.open.includes(REMOVED_KEY);
  return (
    <Foldable
      isOpen={isOpen}
      label={`${parts(removed.length)} removed`}
      onOpenChange={(open: boolean) => keys.onOpenChange(REMOVED_KEY, open)}
    >
      <VStack gap={2}>
        {removed.map((change, index) => (
          <Paragraph key={index} xstyle={styles.removed}>
            {change.heading && `${change.heading}: `}
            <Runs runs={change.runs} whole />
          </Paragraph>
        ))}
      </VStack>
    </Foldable>
  );
}

/** The pane's text, what the places are, or why none is listed. */
function Lead({ model }: { model: SinceModel }) {
  const { places, removed, since } = model;
  if (!since.found) {
    return <Paragraph>The version you reviewed is not in git anymore.</Paragraph>;
  }
  if (places.length === 0 && removed.length === 0) {
    return <Empty>No part changed since your review.</Empty>;
  }
  return (
    <Paragraph color="secondary">
      Revision {since.revision} is the one you reviewed. Each part changed since is marked Δ in the
      page and in Contents.
    </Paragraph>
  );
}

/**
 * "Since your review": the places changed since the reviewed version, each named by its entry of
 * "Contents", `entries`, or its place in a story, a tap jumping to its first marked block; then the
 * parts removed, folded.
 */
export function SinceReviewPane({
  entries,
  model,
}: {
  entries: ReadonlyArray<Entry>;
  model: SinceModel;
}) {
  const label = (place: SincePlace) =>
    place.within ?? entries.find((entry) => entry.id === place.entry)?.label ?? place.heading;
  // In the page's order: by their entries' in "Contents", then by their blocks'.
  const rank = (place: SincePlace) => {
    const at = entries.findIndex((entry) => entry.id === place.entry);
    return at < 0 ? entries.length : at;
  };
  const places = model.places.toSorted((a, b) => rank(a) - rank(b) || a.block - b.block);
  return (
    <Pane icon="uraeda:history" id="since" title={titleOf(model)} tone="attention">
      <VStack gap={3}>
        <Lead model={model} />
        {places.length > 0 && (
          <List aria-label="Places changed" density="compact">
            {places.map((place) => (
              <ListItem
                key={place.id}
                label={label(place)}
                // A place whose block draws no element of its own jumps to its pane.
                onClick={() =>
                  jumpTo(
                    window.document.getElementById(place.id) ? place.id : (place.entry ?? "since"),
                  )
                }
              />
            ))}
          </List>
        )}
        {model.removed.length > 0 && <Removed removed={model.removed} />}
      </VStack>
    </Pane>
  );
}
