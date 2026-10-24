import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { OptionCard } from "./QuestionOption.tsx";
import type { useAnswer } from "./useAnswer.ts";
import { holdsStory, type Stories } from "./stories.tsx";

const styles = stylex.create({
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
  const wide = !isNarrow(useWidthClass());
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
  const wide = !isNarrow(useWidthClass());
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
          question={question.id}
          selected={answer.letters.includes(choice.letter)}
        />
      ))}
    </VStack>
  );
}
