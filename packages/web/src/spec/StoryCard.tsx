// A user story of the spec page, as a card: its id and priority, its title, its journey, its mockup
// live through the story embed (an HTML one a link), then its key scenarios as Given, When, and
// Then rows, and the others behind "N more scenarios", open as the history entry keeps the spec's
// folds. Every scenario takes a comment, as any block of the page does.
import { Badge } from "@astryxdesign/core/Badge";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block, Document, Span } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import type { Folds } from "../Folds.tsx";
import { After, Selectable, type Selection } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps, type SpecItems, storyId } from "./parts.ts";

const styles = stylex.create({
  contents: { display: "contents" },
  foldLabel: {
    // The toggle's label, at the reading size, its row a control's height for a finger.
    alignItems: "center",
    display: "flex",
    fontSize: "var(--text-reading-size)",
    minHeight: sizeVars["--size-element-md"],
  },
  more: {
    paddingBlockStart: spacingVars["--spacing-3"],
  },
  scenario: {
    // A scenario, set apart from the one before by a hairline, its step words in a column.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    columnGap: spacingVars["--spacing-3"],
    display: "grid",
    fontSize: "var(--text-reading-size)",
    gridTemplateColumns: "auto minmax(0, 1fr)",
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    paddingBlockStart: spacingVars["--spacing-3"],
    rowGap: spacingVars["--spacing-1"],
  },
  step: {
    // Given, When, and Then, lighter than the scenario they frame, on its first line.
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    paddingBlockStart: spacingVars["--spacing-0-5"],
  },
});

/** What a story's card draws: the page's context and the story, its mockup among its blocks. */
export type StoryCardProps = PartProps & {
  story: SpecItems["stories"][number];
};

type Story = SpecItems["stories"][number];

/** The words that start a step of a scenario, in bold in the spec. */
const STEPS = new Set(["Given", "When", "Then"]);

/** A run of spans without the comma and spaces a step's word leaves before it. */
function trimmed(spans: ReadonlyArray<Span>): Array<Span> {
  const out = spans.map((span) => ({ ...span }));
  const first = out[0];
  if (first) {
    const text = first.text.trimStart();
    first.text = text.startsWith(",") ? text.slice(1).trimStart() : text;
  }
  return out.filter((span) => span.text !== "" || span.image);
}

/**
 * A scenario's steps, from its bold Given, When, and Then, each with the spans up to the next, and
 * the place of its first span in the scenario. The spans before the first step, if any, make a
 * step without a word.
 */
function stepsOf(spans: ReadonlyArray<Span>) {
  const steps: Array<{ at: number; spans: Array<Span>; step: string }> = [];
  spans.forEach((span, at) => {
    const word = span.strong ? span.text.trim() : "";
    const last = steps.at(-1);
    if (STEPS.has(word)) {
      steps.push({ at, spans: [], step: word });
    } else if (last) {
      last.spans.push(span);
    } else {
      steps.push({ at, spans: [span], step: "" });
    }
  });
  return steps.map((step) => ({ ...step, spans: trimmed(step.spans) }));
}

/** A scenario, its Given, When, and Then each on a row, then its nested blocks; tappable. */
function ScenarioNode({
  block,
  document,
  selection,
}: {
  block: Block;
  document: Document;
  selection: Selection | undefined;
}) {
  const nested = document.blocks.filter((b) => b.parent === block.id).map((b) => b.id);
  return (
    <Selectable block={block} selection={selection}>
      <div {...stylex.props(styles.scenario)}>
        {stepsOf(block.spans).map(({ at, spans, step }) => (
          // The spaces between the cells, which the grid drops, keep the words apart when read.
          <div key={at} {...stylex.props(styles.contents)}>
            <span {...stylex.props(styles.step)}>{step}</span>{" "}
            <span>
              <Spans spans={spans} />
            </span>{" "}
          </div>
        ))}
      </div>
      {nested.length > 0 && <Blocks document={document} ids={nested} selection={selection} />}
    </Selectable>
  );
}

/** Scenarios, one under the other, after what follows their introducing paragraph in a review. */
function Scenarios({
  document,
  intro,
  scenarios,
  selection,
}: {
  document: Document;
  intro: number | undefined;
  scenarios: Story["key"];
  selection: Selection | undefined;
}) {
  const title = intro === undefined ? undefined : document.blocks[intro];
  return (
    <VStack gap={3}>
      {title && selection?.after && <After>{selection.after(title)}</After>}
      {scenarios.map(({ block }) => {
        const item = document.blocks[block];
        return (
          item && (
            <ScenarioNode block={item} document={document} key={block} selection={selection} />
          )
        );
      })}
    </VStack>
  );
}

/**
 * Whether a story's more scenarios are open, and how to open or fold them: the spec's fold keyed by
 * the story's id, which the history entry keeps, and a pending comment or the selection opens.
 */
function useMoreOpen(folds: Folds | undefined, story: Story) {
  const [own, setOwn] = useState(false);
  if (!folds?.list.some((fold) => fold.key === story.id)) {
    return { isOpen: own, onOpenChange: setOwn };
  }
  return {
    isOpen: folds.open.includes(story.id),
    onOpenChange: (isOpen: boolean) => folds.onOpenChange(story.id, isOpen),
  };
}

/** A story's more scenarios, behind "N more scenarios", which reads "Fold the other scenarios" open. */
function MoreScenarios({
  document,
  folds,
  intro,
  selection,
  story,
}: {
  document: Document;
  folds: Folds | undefined;
  intro: number | undefined;
  selection: Selection | undefined;
  story: Story;
}) {
  const { isOpen, onOpenChange } = useMoreOpen(folds, story);
  const count = story.more.length;
  const label = isOpen
    ? "Fold the other scenarios"
    : `${count} more ${count === 1 ? "scenario" : "scenarios"}`;
  return (
    <Collapsible
      chevronPosition="start"
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      trigger={<span {...stylex.props(styles.foldLabel)}>{label}</span>}
    >
      <div {...stylex.props(styles.more)}>
        <Scenarios document={document} intro={intro} scenarios={story.more} selection={selection} />
      </div>
    </Collapsible>
  );
}

/**
 * A user story as a card: its id and priority, its title, its journey and its mockup, drawn by the
 * story's blocks (a story link embeds its story live, an HTML mockup is a link), then its key
 * scenarios, and the others folded.
 */
export function StoryCard({ document, folds, selection, story }: StoryCardProps) {
  const scenarioIds = new Set([...story.keyBlocks, ...story.moreBlocks]);
  const journey = story.blocks.filter((id) => !scenarioIds.has(id));
  return (
    <Panel
      badges={
        <>
          <Badge label={story.id} variant="neutral" />
          <Badge label={story.priority} variant={story.priority === "P1" ? "info" : "neutral"} />
        </>
      }
      crumbs={[GROUPS.stories.title]}
      id={storyId(document, story)}
      title={story.title}
    >
      {journey.length > 0 && <Blocks document={document} ids={journey} selection={selection} />}
      <Scenarios
        document={document}
        intro={story.keyBlocks[0]}
        scenarios={story.key}
        selection={selection}
      />
      {story.more.length > 0 && (
        <MoreScenarios
          document={document}
          folds={folds}
          intro={story.moreBlocks[0]}
          selection={selection}
          story={story}
        />
      )}
    </Panel>
  );
}
