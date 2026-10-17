// Mockups of a round's questions as cards, for round 01 of the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/clarifications-01.md`): one export per variant, over the
// fixture's real web UI round, its Q1 answered B so that its follow-up shows. A tap picks a letter
// here only: nothing is saved.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
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
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type ReactNode, useState } from "react";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { useFile } from "./data.ts";
import { TextField } from "./fields/TextField.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { Spans } from "./Spans.tsx";

/** Where a question's options go on a wide screen. */
type Layout = "column" | "split" | "row";

/** Where a follow-up shows once its letter is picked. */
type FollowUpAt = "after" | "inside";

const styles = stylex.create({
  con: { color: colorVars["--color-error"] },
  followUpAfter: {
    marginInlineStart: spacingVars["--spacing-6"],
  },
  inside: {
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockStart: spacingVars["--spacing-2"],
    marginInlineStart: spacingVars["--spacing-6"],
    paddingInlineStart: spacingVars["--spacing-4"],
  },
  joint: {
    // The line from a question's card to its follow-up's.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    height: spacingVars["--spacing-8"],
    marginInlineStart: spacingVars["--spacing-8"],
  },
  letter: {
    alignItems: "center",
    borderColor: colorVars["--color-text-secondary"],
    borderRadius: radiusVars["--radius-full"],
    borderStyle: "solid",
    borderWidth: spacingVars["--spacing-0-5"],
    boxSizing: "border-box",
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
    flexShrink: 0,
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    height: spacingVars["--spacing-7"],
    justifyContent: "center",
    width: spacingVars["--spacing-7"],
  },
  letterOn: {
    backgroundColor: colorVars["--color-accent"],
    borderColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  measure: {
    // Reading text at the reading measure.
    maxWidth: "var(--size-reading-measure)",
  },
  page: {
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    padding: spacingVars["--spacing-6"],
  },
  pagePhone: {
    padding: spacingVars["--spacing-3"],
  },
  point: {
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    paddingInlineStart: spacingVars["--spacing-5"],
    position: "relative",
  },
  points: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  pro: { color: colorVars["--color-success"] },
  row: {
    columnGap: spacingVars["--spacing-3"],
    display: "grid",
    gridAutoColumns: "minmax(0, 1fr)",
    gridAutoFlow: "column",
  },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetInlineStart: 0,
    position: "absolute",
  },
  split: {
    alignItems: "start",
    columnGap: spacingVars["--spacing-8"],
    display: "grid",
    gridTemplateColumns: "minmax(0, 5fr) minmax(0, 6fr)",
  },
  summary: {
    fontSize: "var(--text-reading-size)",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: "var(--text-reading-line)",
  },
  tag: {
    color: colorVars["--color-warning"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
  title: {
    // The question, larger than a section's heading: the first thing read on its card.
    fontSize: typeScaleVars["--text-heading-1-size"],
    lineHeight: typeScaleVars["--text-heading-1-leading"],
    marginBlock: 0,
  },
  why: { color: colorVars["--color-warning"] },
});

/** An option's pros, cons, and why, each after its sign. */
function Points({ choice, document }: { choice: Choice; document: Document }) {
  const point = (id: number, sign: string, tone: stylex.StyleXStyles) => (
    <li key={`${sign}${id}`} {...stylex.props(styles.point)}>
      <span {...stylex.props(styles.sign, tone)}>{sign}</span>
      <Spans spans={document.blocks[id]?.spans ?? []} />
    </li>
  );
  return (
    <ul {...stylex.props(styles.points)}>
      {choice.pros.map((id) => point(id, "+", styles.pro))}
      {choice.cons.map((id) => point(id, "−", styles.con))}
      {choice.why !== undefined && point(choice.why, "★", styles.why)}
    </ul>
  );
}

/** An option as a card the human picks: its letter, its sentence, then its pros and cons. */
function OptionCard({
  choice,
  document,
  onToggle,
  picked,
}: {
  choice: Choice;
  document: Document;
  onToggle: () => void;
  picked: boolean;
}) {
  return (
    <SelectableCard
      isSelected={picked}
      label={`Option ${choice.letter}`}
      onChange={onToggle}
      padding={3}
    >
      <VStack gap={2}>
        {choice.recommended && <span {...stylex.props(styles.tag)}>Recommended</span>}
        <HStack align="start" gap={2}>
          <span {...stylex.props(styles.letter, picked && styles.letterOn)}>{choice.letter}</span>
          <span {...stylex.props(styles.summary)}>
            <Spans spans={choice.summary} />
          </span>
        </HStack>
        <Points choice={choice} document={document} />
      </VStack>
    </SelectableCard>
  );
}

/** The letters picked for each question, which a tap toggles. */
type Picks = Record<string, ReadonlyArray<string>>;

/**
 * A question as a card: its header, its title, its context, its options laid out by `layout`, and
 * its comment. `inside` draws under the option of that letter, as a follow-up shown in place.
 */
function QuestionCard({
  document,
  header,
  inside,
  layout,
  onToggle,
  picks,
  question,
}: {
  document: Document;
  header: string;
  inside?: { letter: string; node: ReactNode };
  layout: Layout;
  onToggle: (letter: string) => void;
  picks: Picks;
  question: QuestionItem;
}) {
  const wide = useWidthClass() === "wide";
  const shown = wide ? layout : "column";
  const picked = picks[question.id] ?? [];
  const options = (
    <VStack gap={3} xstyle={shown === "row" ? styles.row : undefined}>
      {question.options.map((choice) => (
        <div key={choice.letter}>
          <OptionCard
            choice={choice}
            document={document}
            onToggle={() => onToggle(choice.letter)}
            picked={picked.includes(choice.letter)}
          />
          {inside?.letter === choice.letter && picked.includes(choice.letter) && (
            <div {...stylex.props(styles.inside)}>{inside.node}</div>
          )}
        </div>
      ))}
    </VStack>
  );
  const comment = <TextField kind="line" label="Comment, or your own answer instead of a letter" />;
  const head = (
    <VStack gap={2}>
      <HStack align="center" gap={2} justify="between">
        <Text color="secondary" type="supporting" weight="semibold">
          {header}
        </Text>
        <Button label="Ask the agent" size="sm" variant="ghost" />
      </HStack>
      <Heading level={2} xstyle={styles.title}>
        {question.title}
      </Heading>
    </VStack>
  );
  if (shown === "split") {
    return (
      <Card padding={6}>
        <div {...stylex.props(styles.split)}>
          <VStack gap={3}>
            {head}
            <Blocks document={document} ids={question.context} />
          </VStack>
          <VStack gap={4}>
            {options}
            {comment}
          </VStack>
        </div>
      </Card>
    );
  }
  return (
    <Card padding={wide ? 6 : 4}>
      <VStack gap={4}>
        {head}
        <div {...stylex.props(styles.measure)}>
          <Blocks document={document} ids={question.context} />
        </div>
        {options}
        <div {...stylex.props(styles.measure)}>{comment}</div>
      </VStack>
    </Card>
  );
}

/** The fixture's web UI round, its questions as cards laid out by `layout`. */
function RoundCards({ followUpAt, layout }: { followUpAt: FollowUpAt; layout: Layout }) {
  const file = useFile("2026-10-11-web-ui", "clarifications-01.md");
  const wide = useWidthClass() === "wide";
  const [picks, setPicks] = useState<Picks>({ Q1: ["B"] });
  const round = file?.current.items.clarifications;
  if (!file || !round) {
    return null;
  }
  const document = file.current.document;
  const questions = round.questions;
  const toggle = (id: string) => (letter: string) =>
    setPicks((now) => {
      const was = now[id] ?? [];
      return {
        ...now,
        [id]: was.includes(letter) ? was.filter((l) => l !== letter) : [...was, letter],
      };
    });
  const card = (question: QuestionItem, header: string, inside?: QuestionItem) => (
    <QuestionCard
      document={document}
      header={header}
      layout={layout}
      onToggle={toggle(question.id)}
      picks={picks}
      question={question}
      {...(inside
        ? {
            inside: {
              letter: inside.parentLetter ?? "",
              node: card(inside, `${inside.id} · because you picked ${inside.parentLetter}`),
            },
          }
        : {})}
    />
  );
  return (
    <div {...stylex.props(styles.page, !wide && styles.pagePhone)}>
      <VStack gap={8}>
        {questions
          .filter((q) => !q.parent)
          .map((question) => {
            const followUps = questions.filter(
              (q) =>
                q.parent === question.id &&
                (picks[question.id] ?? []).includes(q.parentLetter ?? ""),
            );
            if (followUpAt === "inside") {
              return <div key={question.id}>{card(question, question.id, followUps[0])}</div>;
            }
            return (
              <div key={question.id}>
                {card(question, question.id)}
                {followUps.map((followUp) => (
                  <div key={followUp.id}>
                    <div {...stylex.props(styles.joint)} />
                    <div {...stylex.props(styles.followUpAfter)}>
                      {card(
                        followUp,
                        `${followUp.id} · follows ${question.id}, because you picked ${followUp.parentLetter}`,
                      )}
                    </div>
                  </div>
                ))}
              </div>
            );
          })}
      </VStack>
    </div>
  );
}

const meta = {
  component: RoundCards,
  parameters: { layout: "fullscreen" },
  title: "Mockups/Question cards",
} satisfies Meta<typeof RoundCards>;

export default meta;

type Story = StoryObj<typeof meta>;

/**
 * One column: the question, its context, and its options stacked, text at the reading measure. A
 * follow-up is its own card, after its parent's, joined to it by a line.
 */
export const OneColumn: Story = { args: { followUpAt: "after", layout: "column" } };

/** Two columns: the question and its context on the left, its options and comment on the right. */
export const TwoColumns: Story = { args: { followUpAt: "after", layout: "split" } };

/** Options side by side: the question and its context above, its options in a row of columns. */
export const OptionsInARow: Story = { args: { followUpAt: "after", layout: "row" } };

/** A follow-up inside its parent's card, under the option it depends on. */
export const FollowUpInside: Story = { args: { followUpAt: "inside", layout: "column" } };
