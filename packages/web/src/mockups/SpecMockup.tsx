// TEMPORARY: the spec page's mockups for the specs redesign
// (`specs/2026-10-17-redesign-specs/clarifications-01.md`), drawn by `SpecPage.stories.tsx`, over
// the mockup feature's spec, written in the shape the redesign proposes (see
// `.storybook/specMockup.ts`). Two layouts of the same spec: each part a card, or one document
// whose parts are set apart by headings and bands. They walk the document tree for parts the core
// does not send yet, and show a story's mockup as a box with its name: the implementation embeds
// it live, as today. Nothing here saves.
import { Badge } from "@astryxdesign/core/Badge";
import { Blockquote } from "@astryxdesign/core/Blockquote";
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode } from "react";
import type { CommentItem, Document } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";
import { itemsOf, type SpecLayout, StoryList } from "./SpecStory.tsx";
import { type ChangeMode, DecisionChange, NewDecision } from "./DecisionChange.tsx";
import { REPEATING_TASKS, TASK_STORAGE_AFTER, TASK_STORAGE_BEFORE } from "./decisionTexts.ts";

const styles = stylex.create({
  label: {
    color: colorVars["--color-text-secondary"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    textTransform: "uppercase",
  },
  page: {
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    padding: spacingVars["--spacing-6"],
  },
  pagePhone: {
    padding: spacingVars["--spacing-4"],
  },
  rule: {
    // A part's colour, down its side, in the document layout.
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-4"],
  },
  ruleDecisions: { borderInlineStartColor: colorVars["--color-border-purple"] },
  ruleReview: { borderInlineStartColor: colorVars["--color-border-blue"] },
  ruleStories: { borderInlineStartColor: colorVars["--color-border-green"] },
  ruleWeigh: { borderInlineStartColor: colorVars["--color-border-orange"] },
});

/** The top-level blocks of each level-2 section, by its title, and those before the first one. */
function sectionsOf(document: Document): Map<string, Array<number>> {
  const sections = new Map<string, Array<number>>([["", []]]);
  let current = "";
  for (const block of document.blocks.filter((b) => b.parent === undefined)) {
    if (block.kind === "heading" && block.level === 2) {
      current = plain(block.spans);
      sections.set(current, []);
    } else {
      sections.get(current)?.push(block.id);
    }
  }
  return sections;
}

/** The answers to the last review, each under the comment it answers. */
function ReviewAnswers({
  comments,
  document,
  ids,
}: {
  comments: ReadonlyArray<CommentItem>;
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  return (
    <VStack gap={4}>
      {itemsOf(document, ids).map((item) => {
        const number = Number(/^C(\d+)/.exec(item.spans[0]?.text ?? "")?.[1]);
        const comment = comments.find((c) => c.number === number);
        const [, ...answer] = item.spans;
        const verdict = plain(answer).replace(/^:\s*/, "").split(".")[0] ?? "";
        return (
          <VStack gap={1} key={item.id}>
            <HStack align="center" gap={2}>
              <Text weight="semibold">Your comment {number}</Text>
              <Badge label={verdict} variant={verdict.startsWith("done") ? "success" : "warning"} />
            </HStack>
            {comment && comment.quote.length > 0 && (
              <Blockquote>
                {comment.quote.map((line) => line.replace(/^>\s?/, "").trim()).join(" ")}
              </Blockquote>
            )}
            {comment && <Text color="secondary">“{comment.text}”</Text>}
            <Text>
              <Spans
                spans={answer.map((s, i) =>
                  i === 0 ? { ...s, text: s.text.replace(/^:\s*\w+\.\s*/, "") } : s,
                )}
              />
            </Text>
          </VStack>
        );
      })}
    </VStack>
  );
}

/** The decisions the spec adds or changes, each with its text or its change. */
function Decisions({
  changeMode,
  document,
  ids,
}: {
  changeMode: ChangeMode;
  document: Document;
  ids: ReadonlyArray<number>;
}) {
  const relied = ids.filter((id) => document.blocks[id]?.kind === "paragraph");
  return (
    <VStack gap={4}>
      {itemsOf(document, ids).map((item) => {
        const [lead, ...rest] = item.spans;
        const isNew = (lead?.text ?? "").startsWith("New");
        const name = item.spans.find((s) => s.link)?.text ?? "";
        return (
          <Card key={item.id} padding={5}>
            <VStack gap={3}>
              <HStack align="center" gap={2}>
                <Badge label={isNew ? "New" : "Changed"} variant={isNew ? "success" : "warning"} />
                <Heading level={3}>{name}</Heading>
              </HStack>
              <Text>
                <Spans
                  spans={rest
                    .filter((s) => !s.link)
                    .map((s, i) => (i === 0 ? { ...s, text: s.text.replace(/^\.\s*/, "") } : s))}
                />
              </Text>
              {isNew ? (
                <NewDecision text={REPEATING_TASKS} />
              ) : (
                <DecisionChange
                  after={TASK_STORAGE_AFTER}
                  before={TASK_STORAGE_BEFORE}
                  mode={changeMode}
                />
              )}
              <HStack>
                <Button label="Comment on this decision" size="sm" variant="ghost" />
              </HStack>
            </VStack>
          </Card>
        );
      })}
      <Blocks document={document} ids={relied} />
    </VStack>
  );
}

/** Each part's heading, and the colour that sets it apart in the document layout. */
const PARTS = {
  Decisions: { rule: styles.ruleDecisions, title: "Decisions" },
  "User stories": { rule: styles.ruleStories, title: "What changes for users" },
  "Your review": { rule: styles.ruleReview, title: "Your review, answered" },
} as const;

/** A part of the spec: a card, or a heading with a coloured rule down its side. */
function Part({
  children,
  layout,
  rule,
  title,
}: {
  children: ReactNode;
  layout: SpecLayout;
  rule?: stylex.StyleXStyles;
  title: string;
}) {
  if (layout === "cards") {
    return (
      <VStack gap={3}>
        <Heading level={2}>{title}</Heading>
        {children}
      </VStack>
    );
  }
  return (
    <div {...stylex.props(styles.rule, rule ?? styles.ruleWeigh)}>
      <VStack gap={3}>
        <span {...stylex.props(styles.label)}>{title}</span>
        {children}
      </VStack>
    </div>
  );
}

/** Its children in a card of `variant` in the cards layout, as they are in the document one. */
function Boxed({
  children,
  layout,
  variant,
}: {
  children: ReactNode;
  layout: SpecLayout;
  variant: "blue" | "default" | "purple";
}) {
  return layout === "cards" ? (
    <Card padding={6} variant={variant}>
      {children}
    </Card>
  ) : (
    children
  );
}

/**
 * The mockup feature's spec as the redesign draws it: what is approved, the answers to the last
 * review, the decisions with their change, the stories, then what the human weighs.
 */
export type { SpecLayout };

export function SpecMockup({
  changeMode = "inline",
  folder,
  layout,
}: {
  changeMode?: ChangeMode;
  folder: string;
  layout: SpecLayout;
}) {
  const file = useFile(folder, "spec.md");
  const wide = useWidthClass() === "wide";
  if (!file) {
    return null;
  }
  const document = file.current.document;
  const sections = sectionsOf(document);
  const comments = file.review?.review?.comments ?? [];
  const opening = sections.get("") ?? [];
  const title = opening.map((id) => document.blocks[id]).find((b) => b?.kind === "heading");
  const block = opening.filter((id) => document.blocks[id]?.kind === "callout");
  const rest = [...sections.keys()].filter(
    (name) => name !== "" && !["Your review", "Decisions", "User stories"].includes(name),
  );
  const restBody = (
    <VStack gap={5}>
      {rest.map((name) => (
        <VStack gap={2} key={name}>
          <Heading level={3}>{name}</Heading>
          <Blocks document={document} ids={sections.get(name) ?? []} />
        </VStack>
      ))}
    </VStack>
  );
  return (
    <div {...stylex.props(styles.page, !wide && styles.pagePhone)}>
      <VStack gap={layout === "cards" ? 8 : 6}>
        <VStack gap={2}>
          <HStack align="center" gap={2}>
            <Badge label="Revision 2" variant="neutral" />
            <Badge label="Waiting for your review" variant="warning" />
          </HStack>
          {title && <Heading level={1}>{plain(title.spans)}</Heading>}
        </VStack>
        <Boxed layout={layout} variant="purple">
          <Blocks document={document} ids={block} />
        </Boxed>
        <Part layout={layout} rule={PARTS["Your review"].rule} title={PARTS["Your review"].title}>
          <Boxed layout={layout} variant="blue">
            <ReviewAnswers
              comments={comments}
              document={document}
              ids={sections.get("Your review") ?? []}
            />
          </Boxed>
        </Part>
        <Part layout={layout} rule={PARTS.Decisions.rule} title={PARTS.Decisions.title}>
          <Decisions
            changeMode={changeMode}
            document={document}
            ids={sections.get("Decisions") ?? []}
          />
        </Part>
        <Part layout={layout} rule={PARTS["User stories"].rule} title={PARTS["User stories"].title}>
          <StoryList document={document} ids={sections.get("User stories") ?? []} layout={layout} />
        </Part>
        <Part layout={layout} title="What else to weigh">
          <Boxed layout={layout} variant="default">
            {restBody}
          </Boxed>
        </Part>
        <HStack gap={2}>
          <Button label="Request changes" variant="secondary" />
          <Button label="Approve" variant="primary" />
        </HStack>
      </VStack>
    </div>
  );
}
