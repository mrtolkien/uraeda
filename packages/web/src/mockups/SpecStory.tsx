// TEMPORARY: the user stories of the spec page's mockups for the specs redesign, drawn by
// `SpecMockup.tsx`: each story as a card, its scenarios as Given, When, and Then rows, or as a band
// of the document, its scenarios as today's list.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { plain, Spans } from "../Spans.tsx";

/** How the page lays out the spec's parts. */
export type SpecLayout = "cards" | "document";

const styles = stylex.create({
  band: {
    backgroundColor: colorVars["--color-background-muted"],
    borderRadius: radiusVars["--radius-element"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  contents: { display: "contents" },
  mockup: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-muted"],
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "dashed",
    borderWidth: spacingVars["--spacing-0-5"],
    display: "flex",
    justifyContent: "center",
    minHeight: "var(--size-message-image)",
  },
  scenario: {
    columnGap: spacingVars["--spacing-3"],
    display: "grid",
    fontSize: "var(--text-reading-size)",
    gridTemplateColumns: "4.5em minmax(0, 1fr)",
    lineHeight: "var(--text-reading-line)",
    rowGap: spacingVars["--spacing-1"],
  },
  step: {
    color: colorVars["--color-text-secondary"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
});

/** The items of the lists among `ids`. */
export function itemsOf(document: Document, ids: ReadonlyArray<number>): Array<Block> {
  return ids.flatMap((id) =>
    document.blocks[id]?.kind === "list"
      ? document.blocks.filter((b) => b.parent === id && b.kind === "item")
      : [],
  );
}

/** Whether a block is a paragraph that only links a story, which the page embeds. */
function storyLabel(block: Block | undefined): string | undefined {
  const [only, ...rest] = block?.kind === "paragraph" ? block.spans : [];
  return only?.link?.story && rest.length === 0 ? only.text : undefined;
}

/** A story's mockup, as a box with its name: live in the implementation. */
function MockupBox({ label }: { label: string }) {
  return (
    <div {...stylex.props(styles.mockup)}>
      <Text color="secondary">Live mockup: {label}</Text>
    </div>
  );
}

/** A scenario, its Given, When, and Then each on a row of their own. */
function Scenario({ item }: { item: Block }) {
  const steps: Array<{ spans: Array<Block["spans"][number]>; step: string }> = [];
  for (const span of item.spans) {
    if (span.strong && ["Given", "When", "Then"].includes(span.text)) {
      steps.push({ spans: [], step: span.text });
    } else {
      steps.at(-1)?.spans.push({ ...span, text: span.text.replace(/^,?\s+/, "") });
    }
  }
  return (
    <div {...stylex.props(styles.scenario)}>
      {steps.map(({ spans, step }) => (
        <div key={step} {...stylex.props(styles.contents)}>
          <span {...stylex.props(styles.step)}>{step}</span>
          <span>
            <Spans spans={spans.filter((s, i) => i > 0 || s.text !== "")} />
          </span>
        </div>
      ))}
    </div>
  );
}

/** Scenarios, one under the other. */
function Scenarios({ items }: { items: ReadonlyArray<Block> }) {
  return (
    <VStack gap={3}>
      {items.map((item) => (
        <Scenario item={item} key={item.id} />
      ))}
    </VStack>
  );
}

/** A story's parts: its journey, its mockup, its key scenarios, and the others behind a toggle. */
function storyParts(document: Document, ids: ReadonlyArray<number>) {
  const journey: Array<number> = [];
  let mockup: string | undefined;
  let mockupId: number | undefined;
  let key: Array<Block> = [];
  let more: Array<Block> = [];
  let into: "key" | "more" | undefined;
  for (const id of ids) {
    const block = document.blocks[id];
    const text = block?.kind === "paragraph" ? plain(block.spans) : "";
    if (storyLabel(block)) {
      mockup = storyLabel(block);
      mockupId = id;
    } else if (text === "Key scenarios:") {
      into = "key";
    } else if (text === "More scenarios:") {
      into = "more";
    } else if (block?.kind === "list" && into) {
      const items = itemsOf(document, [id]);
      if (into === "key") {
        key = items;
      } else {
        more = items;
      }
    } else if (block) {
      journey.push(id);
    }
  }
  return { journey, key, mockup, mockupId, more };
}

/** A user story, as a card or a band of the document. */
function Story({
  document,
  heading,
  ids,
  layout,
}: {
  document: Document;
  heading: Block;
  ids: ReadonlyArray<number>;
  layout: SpecLayout;
}) {
  const [open, setOpen] = useState(false);
  const match = /^(US\d+): (.*) \((P\d)\)$/.exec(plain(heading.spans));
  const [, id, title, priority] = match ?? ["", "", plain(heading.spans), ""];
  const { journey, key, mockup, mockupId, more } = storyParts(document, ids);
  const body = (
    <VStack gap={3}>
      <Blocks document={document} ids={journey} />
      {mockup && <MockupBox label={mockup} />}
      {layout === "cards" ? (
        <Scenarios items={key} />
      ) : (
        <Blocks
          document={document}
          ids={ids.filter((i) => !journey.includes(i) && i !== mockupId)}
        />
      )}
      {layout === "cards" && more.length > 0 && (
        <VStack gap={3}>
          <HStack>
            <Button
              label={open ? "Fold the other scenarios" : `${more.length} more scenarios`}
              onClick={() => setOpen(!open)}
              size="sm"
              variant="ghost"
            />
          </HStack>
          {open && <Scenarios items={more} />}
        </VStack>
      )}
    </VStack>
  );
  if (layout === "document") {
    return (
      <VStack gap={2}>
        <div {...stylex.props(styles.band)}>
          <Text color="secondary" type="supporting">
            {id} · {priority}
          </Text>
          <Heading level={3}>{title}</Heading>
        </div>
        {body}
      </VStack>
    );
  }
  return (
    <Card padding={6}>
      <VStack gap={3}>
        <HStack align="center" gap={2}>
          <Badge label={id} variant="neutral" />
          <Badge label={priority} variant={priority === "P1" ? "info" : "neutral"} />
        </HStack>
        <Heading level={3}>{title}</Heading>
        {body}
      </VStack>
    </Card>
  );
}

/** The user stories, each from its heading to the next. */
export function StoryList({
  document,
  ids,
  layout,
}: {
  document: Document;
  ids: ReadonlyArray<number>;
  layout: SpecLayout;
}) {
  const headings = ids.filter((id) => document.blocks[id]?.kind === "heading");
  return (
    <VStack gap={layout === "cards" ? 6 : 8}>
      {headings.map((headingId, index) => {
        const end = headings[index + 1];
        const inStory = ids.filter((id) => id > headingId && (end === undefined || id < end));
        const heading = document.blocks[headingId];
        return (
          heading && (
            <Story
              document={document}
              heading={heading}
              ids={inStory}
              key={headingId}
              layout={layout}
            />
          )
        );
      })}
    </VStack>
  );
}
