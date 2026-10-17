// TEMPORARY: the panels and user stories of the spec page's mockups for the specs redesign, drawn
// by `SpecMockup.tsx`. On a wide screen, a panel is a card. On the phone, it has no card and takes
// the screen's width, its title sticking at the top under its breadcrumbs while it scrolls. Each
// story is a panel, its scenarios as Given, When, and Then rows.
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
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import type { Block, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";

const styles = stylex.create({
  contents: { display: "contents" },
  crumbs: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
  },
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
    // A scenario, set apart from the one before by a hairline.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: spacingVars["--spacing-0-5"],
    columnGap: spacingVars["--spacing-3"],
    display: "grid",
    fontSize: "var(--text-reading-size)",
    gridTemplateColumns: "4.5em minmax(0, 1fr)",
    lineHeight: "var(--text-reading-line)",
    paddingBlockStart: spacingVars["--spacing-3"],
    rowGap: spacingVars["--spacing-1"],
  },
  step: {
    // Given, When, and Then, lighter than the scenario they frame.
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-normal"],
    paddingBlockStart: spacingVars["--spacing-0-5"],
  },
  stickyHead: {
    // On the phone, the panel's title and breadcrumbs stay at the top while it scrolls, over the
    // page's background, to the screen's edges.
    backgroundColor: colorVars["--color-background-body"],
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: spacingVars["--spacing-0-5"],
    insetBlockStart: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-3"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
    position: "sticky",
    zIndex: 1,
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
  let key: Array<Block> = [];
  let more: Array<Block> = [];
  let into: "key" | "more" | undefined;
  for (const id of ids) {
    const block = document.blocks[id];
    const text = block?.kind === "paragraph" ? plain(block.spans) : "";
    if (storyLabel(block)) {
      mockup = storyLabel(block);
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
  return { journey, key, mockup, more };
}

/** A panel's head: its badges, its title, and on the phone, the breadcrumbs above it. */
function PanelHead({
  badges,
  crumbs,
  title,
}: {
  badges?: ReactNode;
  crumbs: ReadonlyArray<string>;
  title: string;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={1}>
      {!wide && crumbs.length > 0 && (
        <span {...stylex.props(styles.crumbs)}>{crumbs.join(" › ")}</span>
      )}
      <HStack align="center" gap={2} wrap="wrap">
        <Heading level={3}>{title}</Heading>
        {badges}
      </HStack>
    </VStack>
  );
}

/**
 * A part of the spec: a card on a wide screen, with `variant`'s tint; on the phone, no card, its
 * head sticking at the top with its breadcrumbs.
 */
export function Panel({
  badges,
  children,
  crumbs,
  id,
  title,
  variant = "default",
}: {
  badges?: ReactNode;
  children: ReactNode;
  crumbs: ReadonlyArray<string>;
  id?: string;
  title: string;
  variant?: "blue" | "default" | "purple";
}) {
  const wide = useWidthClass() === "wide";
  const head = <PanelHead badges={badges} crumbs={crumbs} title={title} />;
  if (!wide) {
    return (
      <section id={id}>
        <div {...stylex.props(styles.stickyHead)}>{head}</div>
        <VStack gap={3}>
          <span />
          {children}
        </VStack>
      </section>
    );
  }
  return (
    <section id={id}>
      <Card padding={6} variant={variant}>
        <VStack gap={3}>
          {head}
          {children}
        </VStack>
      </Card>
    </section>
  );
}

/** A user story, as a panel: its journey, its mockup, its key scenarios, then the others. */
function Story({
  crumbs,
  document,
  heading,
  ids,
}: {
  crumbs: ReadonlyArray<string>;
  document: Document;
  heading: Block;
  ids: ReadonlyArray<number>;
}) {
  const [open, setOpen] = useState(false);
  const match = /^(US\d+): (.*) \((P\d)\)$/.exec(plain(heading.spans));
  const [, id = "", title = "", priority = ""] = match ?? ["", "", plain(heading.spans), ""];
  const { journey, key, mockup, more } = storyParts(document, ids);
  return (
    <Panel
      badges={
        <>
          <Badge label={id} variant="neutral" />
          <Badge label={priority} variant={priority === "P1" ? "info" : "neutral"} />
        </>
      }
      crumbs={crumbs}
      id={id.toLowerCase()}
      title={title}
    >
      <Blocks document={document} ids={journey} />
      {mockup && <MockupBox label={mockup} />}
      <Scenarios items={key} />
      {more.length > 0 && (
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
    </Panel>
  );
}

/** The user stories, each from its heading to the next. */
export function StoryList({
  crumbs,
  document,
  ids,
}: {
  crumbs: ReadonlyArray<string>;
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  const headings = ids.filter((id) => document.blocks[id]?.kind === "heading");
  return (
    <VStack gap={6}>
      {headings.map((headingId, index) => {
        const end = headings[index + 1];
        const inStory = ids.filter((id) => id > headingId && (end === undefined || id < end));
        const heading = document.blocks[headingId];
        return (
          heading && (
            <Story
              crumbs={crumbs}
              document={document}
              heading={heading}
              ids={inStory}
              key={headingId}
            />
          )
        );
      })}
    </VStack>
  );
}

/** The story headings among `ids`: their id, like `US1`, and their title. */
export function storyHeadings(document: Document, ids: ReadonlyArray<number>) {
  return ids
    .map((id) => document.blocks[id])
    .filter((b) => b?.kind === "heading")
    .map((b) => {
      const match = /^(US\d+): (.*) \(P\d\)$/.exec(plain(b?.spans ?? []));
      return { id: match?.[1] ?? "", title: match?.[2] ?? "" };
    });
}
