import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useRef } from "react";
import type { Document, QuestionItem } from "uraeda-binding";
import { Band } from "./layout/Band.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { useAtLeast } from "./layout/useWidthOf.ts";
import { QuestionCard } from "./QuestionCard.tsx";
import type { RoundTarget } from "./roundTarget.ts";

const styles = stylex.create({
  card: {
    // On a wide screen, cards apart from each other and from the round's opening.
    marginBlockStart: spacingVars["--spacing-8"],
  },
  followUp: {
    // On a wide screen, a follow-up's card is indented under its parent's.
    marginInlineStart: spacingVars["--spacing-6"],
  },
  followUpPhone: {
    // On the phone, a follow-up has no line on its side, so its text keeps the screen's width: an
    // accent border on top, from edge to edge, above its header.
    borderBlockStartColor: colorVars["--color-accent"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: `calc(2 * ${borderVars["--border-width"]})`,
    marginBlockStart: spacingVars["--spacing-6"],
    marginInline: "var(--page-bleed)",
    paddingInline: "var(--page-inset)",
  },
  joint: {
    // The accent line from a card to the follow-up's after it.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: "var(--size-round-accent)",
    height: spacingVars["--spacing-8"],
    marginInlineStart: spacingVars["--spacing-8"],
  },
});

/** The follow-ups of a question the round asks now, in the order of their letters. */
export function followUpsOf(
  questions: ReadonlyArray<QuestionItem>,
  parent: string,
): Array<QuestionItem> {
  return questions
    .filter((q) => q.parent === parent && q.asked)
    .sort((a, b) => (a.parentLetter ?? "").localeCompare(b.parentLetter ?? ""));
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
  const wide = !isNarrow(useWidthClass());
  const group = useRef<HTMLDivElement>(null);
  // Two columns once the group has a split card's width: narrower, the question would read under
  // 50 characters a line.
  const roomy = useAtLeast(group, "--size-split-card");
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
 * is a card of its own after its parent's, joined to it by a line on a wide screen, under an accent
 * border on top on the phone. Only the first `count` questions with their follow-ups are mounted,
 * all without it: the round's page mounts them in steps.
 */
export function QuestionCards({
  count = Number.POSITIVE_INFINITY,
  questions,
  ...card
}: CardProps & { count?: number; questions: ReadonlyArray<QuestionItem> }) {
  return questions
    .filter((q) => !q.parent)
    .slice(0, count)
    .map((question) => (
      <QuestionGroup
        card={card}
        followUps={followUpsOf(questions, question.id)}
        key={question.id}
        question={question}
      />
    ));
}
