import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars, typeScaleVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo } from "react";
import type { Document, QuestionItem, Span } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Pane } from "./layout/Pane.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { OptionCard } from "./QuestionOption.tsx";
import { plain } from "./Spans.tsx";
import type { useAnswer } from "./useAnswer.ts";
import { holdsStory, type Stories } from "./stories.tsx";

const styles = stylex.create({
  // On the phone, the options' borders run at the screen's edges.
  optionsPhone: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  // Room above the first option for the half of its letter over its border.
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

/**
 * A paragraph's spans without its lead, as "Example:" or "Why it matters:", which its pane's title
 * says, its first letter then capitalised. The core found the paragraph by its lead.
 */
function withoutLead(spans: ReadonlyArray<Span>, lead: RegExp): Array<Span> {
  let cut = lead.exec(plain(spans))?.[0].length ?? 0;
  const rest: Array<Span> = [];
  for (const span of spans) {
    const text = span.text.slice(Math.min(cut, span.text.length));
    cut -= span.text.length - text.length;
    if (text || span.image) {
      rest.push(rest.length === 0 ? { ...span, text: capitalised(text) } : { ...span, text });
    }
  }
  return rest;
}

const capitalised = (text: string) => text.charAt(0).toUpperCase() + text.slice(1);

/** The leads of a question's example and why, which their panes' titles replace. */
const EXAMPLE_LEAD = /^Example:\s*/;
const WHY_LEAD = /^Why it matters:?\s*/;

/** The document with a question's example and why without their leads, for their panes. */
function useWithoutLeads(document: Document, question: QuestionItem) {
  const { example, why } = question;
  return useMemo(() => {
    const leads = new Map<number, RegExp>();
    if (example !== undefined) {
      leads.set(example, EXAMPLE_LEAD);
    }
    if (why !== undefined) {
      leads.set(why, WHY_LEAD);
    }
    if (leads.size === 0) {
      return document;
    }
    const blocks = document.blocks.map((block) => {
      const lead = leads.get(block.id);
      return lead ? { ...block, spans: withoutLead(block.spans, lead) } : block;
    });
    return { ...document, blocks };
  }, [document, example, why]);
}

/**
 * A question's example in a teal pane, its context, then its "Why it matters" in a peach pane,
 * each set apart from the context. On the phone, the panes keep only their titled top border.
 */
export function QuestionContext({
  document,
  question,
}: {
  document: Document;
  question: QuestionItem;
}) {
  const panes = useWithoutLeads(document, question);
  return (
    <>
      {question.example !== undefined && (
        <Pane isOpenOnPhone level={3} title="Example" tone="example">
          <Blocks document={panes} ids={[question.example]} />
        </Pane>
      )}
      <Blocks document={document} ids={question.context} />
      {question.why !== undefined && (
        <Pane isOpenOnPhone level={3} title="Why it matters" tone="attention">
          <Blocks document={panes} ids={[question.why]} />
        </Pane>
      )}
    </>
  );
}

/**
 * A question's options, each a card toggling its letter: beside the title in a card of two
 * columns, else after the context, and on the phone to the screen's edges.
 */
export function Options({
  answer,
  document,
  question,
  readOnly,
}: {
  answer: ReturnType<typeof useAnswer>;
  document: Document;
  question: QuestionItem;
  readOnly: boolean;
}) {
  const wide = !isNarrow(useWidthClass());
  if (question.options.length === 0) {
    return null;
  }
  return (
    <VStack gap={3} xstyle={[styles.optionsSpaced, !wide && styles.optionsPhone]}>
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
