// A user story of the spec page, as a card: its id and priority, its title, its journey, its mockup
// live through the story embed (an HTML one a link), then its key scenarios as Given, When, and
// Then rows, and the others behind "N more scenarios", open as the history entry keeps the spec's
// folds. Every scenario takes a comment, as any block of the page does.
import { Badge } from "@astryxdesign/core/Badge";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, sizeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import type { Folds } from "../Folds.tsx";
import { After, Selectable, type Selection } from "../Selection.tsx";
import { Spans } from "../Spans.tsx";
import { Panel } from "./Panel.tsx";
import { GROUPS, type PartProps, type SpecItems, storyId } from "./parts.ts";

/** The icon of each step word, as the core names them. */
const STEP_ICONS: Record<string, string> = {
  Given: "uraeda:step-given",
  Then: "uraeda:step-then",
  When: "uraeda:step-when",
};

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
    rowGap: spacingVars["--spacing-2"],
  },
  step: {
    // Given, When, and Then as an icon, in the text's colour, on the scenario's first line.
    alignItems: "center",
    display: "flex",
    minHeight: "var(--text-reading-line)",
  },
  word: {
    // Given, When, and Then, at the start of the step's text, in capitals.
    fontWeight: "var(--font-weight-bold)",
    textTransform: "uppercase",
  },
});

/** What a story's card draws: the page's context and the story, its mockup among its blocks. */
export type StoryCardProps = PartProps & {
  story: SpecItems["stories"][number];
};

type Story = SpecItems["stories"][number];

/** A scenario, its Given, When, and Then each on a row, then its nested blocks; tappable. */
function ScenarioNode({
  block,
  document,
  selection,
  steps,
}: {
  block: Block;
  document: Document;
  selection: Selection | undefined;
  steps: Story["key"][number]["steps"];
}) {
  const nested = document.blocks.filter((b) => b.parent === block.id).map((b) => b.id);
  return (
    <Selectable block={block} selection={selection}>
      <div {...stylex.props(styles.scenario)}>
        {steps.map(({ spans, word }, at) => (
          // The spaces between the cells, which the grid drops, keep the words apart when read.
          <div key={at} {...stylex.props(styles.contents)}>
            <span {...stylex.props(styles.step)}>
              <Icon icon={STEP_ICONS[word] ?? "uraeda:step-then"} />
            </span>{" "}
            <span>
              <strong {...stylex.props(styles.word)}>{word}</strong> <Spans spans={spans} />
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
      {scenarios.map(({ block, steps }) => {
        const item = document.blocks[block];
        return (
          item && (
            <ScenarioNode
              block={item}
              document={document}
              key={block}
              selection={selection}
              steps={steps}
            />
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
