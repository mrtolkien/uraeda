import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import type { Document, QuestionItem } from "uraeda-binding";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useWidthOf } from "./layout/useWidthOf.ts";
import { QuestionCard } from "./QuestionCard.tsx";
import type { RoundTarget } from "./roundTarget.ts";

const styles = stylex.create({
  band: {
    // A band between sibling questions; on the phone, to the screen's edges.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-5"],
  },
  bandBleed: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  card: {
    // On a wide screen, cards apart from each other and from the round's opening.
    marginBlockStart: spacingVars["--spacing-8"],
  },
  followUp: {
    // On a wide screen, a follow-up's card is indented under its parent's.
    marginInlineStart: spacingVars["--spacing-6"],
  },
  followUpPhone: {
    // On the phone, a follow-up keeps its accent line on its side, and little inset.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockStart: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  joint: {
    // The accent line from a card to the follow-up's after it.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    height: spacingVars["--spacing-8"],
    marginInlineStart: spacingVars["--spacing-8"],
  },
});

/** The muted band between sibling questions; on the phone, to the screen's edges. */
export function Band() {
  const wide = useWidthClass() === "wide";
  return <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />;
}

/** The follow-ups of a question the round asks now, in the order of their letters. */
export function followUpsOf(
  questions: ReadonlyArray<QuestionItem>,
  parent: string,
): Array<QuestionItem> {
  return questions
    .filter((q) => q.parent === parent && q.asked)
    .sort((a, b) => (a.parentLetter ?? "").localeCompare(b.parentLetter ?? ""));
}

/** Whether an element is at least the theme's `--size-round-split` wide, where a card splits. */
function useRoomy(ref: RefObject<HTMLElement | null>) {
  const width = useWidthOf(ref);
  const [split, setSplit] = useState(Number.POSITIVE_INFINITY);
  useLayoutEffect(() => {
    const element = ref.current;
    if (element) {
      const value = getComputedStyle(element).getPropertyValue("--size-round-split");
      setSplit(Number.parseFloat(value) || Number.POSITIVE_INFINITY);
    }
  }, [ref]);
  return width >= split;
}

/** What draws a question's card: the round's file and where its answers go. */
type CardProps = {
  document: Document;
  onAsk?: (question: QuestionItem) => void;
  path: string;
  readOnly: boolean;
  takes: boolean;
  target: RoundTarget;
};

/**
 * A question's card, then its follow-ups' that the round asks. Its follow-ups take its card's
 * columns: indented, they would be narrower than the split by the indent alone (R19).
 */
function QuestionGroup({
  card,
  followUps,
  question,
}: {
  card: CardProps;
  followUps: ReadonlyArray<QuestionItem>;
  question: QuestionItem;
}) {
  const wide = useWidthClass() === "wide";
  const group = useRef<HTMLDivElement>(null);
  const roomy = useRoomy(group);
  return (
    <div ref={group} {...stylex.props(wide && styles.card)}>
      {!wide && <Band />}
      <QuestionCard question={question} roomy={roomy} {...card} />
      {followUps.map((followUp) => (
        <div key={followUp.id}>
          {wide && <div {...stylex.props(styles.joint)} />}
          <div {...stylex.props(wide ? styles.followUp : styles.followUpPhone)}>
            <QuestionCard question={followUp} roomy={roomy} {...card} />
          </div>
        </div>
      ))}
    </div>
  );
}

/**
 * The round's questions, each a card; on the phone, each after a band. A follow-up the round asks
 * is a card of its own after its parent's, joined to it by a line on a wide screen, with an accent
 * line on its side on the phone.
 */
export function QuestionCards({
  questions,
  ...card
}: CardProps & { questions: ReadonlyArray<QuestionItem> }) {
  return questions
    .filter((q) => !q.parent)
    .map((question) => (
      <QuestionGroup
        card={card}
        followUps={followUpsOf(questions, question.id)}
        key={question.id}
        question={question}
      />
    ));
}
