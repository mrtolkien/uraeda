import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { SelectableCard } from "@astryxdesign/core/SelectableCard";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useContext } from "react";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { StaticImages } from "./ImageView.tsx";
import { plain, Spans } from "./Spans.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import type { useAnswer } from "./useAnswer.ts";
import { holdsStory, type Stories, StoryContext } from "./stories.tsx";

const styles = stylex.create({
  con: { color: colorVars["--color-error"] },
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
  optionPhone: {
    // On the phone, options run to the screen's edges, as today, split by hairlines.
    borderBlockStartWidth: 0,
    borderInlineWidth: 0,
    borderRadius: 0,
  },
  optionReadOnly: {
    // An answered round's options show their letters as picked, at full contrast, untappable.
    opacity: 1,
  },
  optionsPhone: {
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  // A follow-up's options on the phone reach its accent line, not past it.
  optionsPhoneFollowUp: {
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-3"]})`,
  },
  optionsSpaced: {
    marginBlockStart: spacingVars["--spacing-3"],
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
    maxWidth: "var(--size-reading-measure)",
    padding: 0,
  },
  pro: { color: colorVars["--color-success"] },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetInlineStart: 0,
    position: "absolute",
  },
  summary: {
    // An option's text keeps the reading measure, its card as wide as its column.
    fontSize: "var(--text-reading-size)",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: "var(--text-reading-line)",
    maxWidth: "var(--size-reading-measure)",
    textWrap: "pretty",
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
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: spacingVars["--spacing-0-5"],
  },
  titlePhone: {
    fontSize: typeScaleVars["--text-heading-3-size"],
    lineHeight: typeScaleVars["--text-heading-3-leading"],
    marginBlock: 0,
  },
  variants: {
    // An option's stories, under its card, at its text's inset: on the phone, the embed takes it
    // back, to the screen's edges.
    paddingInline: spacingVars["--spacing-4"],
  },
  why: { color: colorVars["--color-warning"] },
  whyBox: {
    // Its paragraph's own margin below makes the inset at its foot.
    backgroundColor: colorVars["--color-background-muted"],
    borderRadius: radiusVars["--radius-element"],
    paddingBlockStart: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

export const statusStyles = stylex.create({
  error: { color: colorVars["--color-error"] },
  saved: { color: colorVars["--color-success"] },
});

/** Whether one of a question's options holds a story, drawn under its card. */
export function holdsVariants(stories: Stories | null, document: Document, question: QuestionItem) {
  return question.options.some((choice) =>
    choice.other.some((id) => holdsStory(stories, document, id)),
  );
}

/** An option's pros, cons, and why, each after its sign. */
function Points({ choice, document }: { choice: Choice; document: Document }) {
  const point = (id: number, sign: string, tone: stylex.StyleXStyles) => (
    <li key={`${sign}${id}`} {...stylex.props(styles.point)}>
      <span {...stylex.props(styles.sign, tone)}>{sign}</span>
      <Spans spans={document.blocks[id]?.spans ?? []} />
    </li>
  );
  if (choice.pros.length === 0 && choice.cons.length === 0 && choice.why === undefined) {
    return null;
  }
  return (
    <ul {...stylex.props(styles.points)}>
      {choice.pros.map((id) => point(id, "+", styles.pro))}
      {choice.cons.map((id) => point(id, "−", styles.con))}
      {choice.why !== undefined && point(choice.why, "★", styles.why)}
    </ul>
  );
}

/** An option's accessible name: its letter, "recommended" when it is, and its sentence. */
function optionName(choice: Choice) {
  const recommended = choice.recommended ? " (recommended)" : "";
  return `Option ${choice.letter}${recommended}: ${plain(choice.summary)}`;
}

/**
 * An option as a card the human picks: "Recommended", its letter and sentence, its points, and its
 * other blocks; its stories under the card, never inside it, where their frames would be inert.
 */
function OptionCard({
  choice,
  disabled,
  document,
  onToggle,
  selected,
}: {
  choice: Choice;
  disabled: boolean;
  document: Document;
  onToggle: () => void;
  selected: boolean;
}) {
  const wide = useWidthClass() === "wide";
  const stories = useContext(StoryContext);
  const isStory = (id: number) => holdsStory(stories, document, id);
  const other = choice.other.filter((id) => !isStory(id));
  const variants = choice.other.filter(isStory);
  return (
    <div>
      <SelectableCard
        isDisabled={disabled}
        isSelected={selected}
        label={optionName(choice)}
        onChange={onToggle}
        padding={wide ? 3 : 4}
        xstyle={[!wide && styles.optionPhone, disabled && styles.optionReadOnly]}
      >
        {/* A tap on an image picks the option: its images open no lightbox. */}
        <StaticImages>
          <VStack gap={2}>
            {choice.recommended && <span {...stylex.props(styles.tag)}>Recommended</span>}
            <HStack align="start" gap={2}>
              <span {...stylex.props(styles.letter, selected && styles.letterOn)}>
                {choice.letter}
              </span>
              <span {...stylex.props(styles.summary)}>
                <Spans spans={choice.summary} />
              </span>
            </HStack>
            <Points choice={choice} document={document} />
            {other.length > 0 && <Blocks document={document} ids={other} />}
          </VStack>
        </StaticImages>
      </SelectableCard>
      {variants.length > 0 && (
        <div {...stylex.props(styles.variants)}>
          <Blocks document={document} ids={variants} />
        </div>
      )}
    </div>
  );
}

/**
 * A question's header: its id, or a follow-up's "Q1.B · follows Q1, because you picked B", and
 * "Ask the agent", then its title, which a jump focuses.
 */
export function QuestionHead({
  onAsk,
  question,
}: {
  onAsk?: (question: QuestionItem) => void;
  question: QuestionItem;
}) {
  const wide = useWidthClass() === "wide";
  const { id, parent, parentLetter } = question;
  return (
    <>
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Text color="secondary" type="supporting" weight="semibold">
          {parent ? `${id} · follows ${parent}, because you picked ${parentLetter}` : id}
        </Text>
        {onAsk && (
          <Button label="Ask the agent" onClick={() => onAsk(question)} size="sm" variant="ghost" />
        )}
      </HStack>
      <Heading
        id={`${id}-title`}
        level={2}
        tabIndex={-1}
        xstyle={wide ? styles.title : styles.titlePhone}
      >
        {question.title}
      </Heading>
    </>
  );
}

/** A question's context, then its "Why it matters" in a muted box, set apart from it. */
export function QuestionContext({
  document,
  question,
}: {
  document: Document;
  question: QuestionItem;
}) {
  return (
    <>
      <Blocks document={document} ids={question.context} />
      {question.why !== undefined && (
        <div aria-label="Why it matters" role="note" {...stylex.props(styles.whyBox)}>
          <Blocks document={document} ids={[question.why]} />
        </div>
      )}
    </>
  );
}

/**
 * A question's options, each a card toggling its letter: beside the title in a card of two
 * columns, `beside`, else after the context, and on the phone to the screen's edges.
 */
export function Options({
  answer,
  beside,
  document,
  question,
  readOnly,
}: {
  answer: ReturnType<typeof useAnswer>;
  beside: boolean;
  document: Document;
  question: QuestionItem;
  readOnly: boolean;
}) {
  const wide = useWidthClass() === "wide";
  if (question.options.length === 0) {
    return null;
  }
  return (
    <VStack
      gap={wide ? 3 : 0}
      xstyle={[
        !beside && styles.optionsSpaced,
        !wide && styles.optionsPhone,
        !wide && question.parent !== undefined && styles.optionsPhoneFollowUp,
      ]}
    >
      {question.options.map((choice) => (
        <OptionCard
          choice={choice}
          disabled={readOnly}
          document={document}
          key={choice.letter}
          onToggle={() => answer.toggle(choice.letter)}
          selected={answer.letters.includes(choice.letter)}
        />
      ))}
    </VStack>
  );
}
