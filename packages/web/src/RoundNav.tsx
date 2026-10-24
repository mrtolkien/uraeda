import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { useHotkeys } from "@astryxdesign/core/hooks";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useId, useState } from "react";
import { Overlay } from "./layout/Overlay.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { useStatusHints } from "./statusHints.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import {
  afterSheetCloses,
  endJump,
  jumpTo,
  type NavQuestion,
  questionAtTop,
  questionJumpedTo,
  useQuestionAtTop,
} from "./roundJump.ts";

export type { NavQuestion };

const styles = stylex.create({
  action: {
    // Next or Submit keeps its width beside the count: its label is never cut.
    flexShrink: 0,
  },
  column: {
    // Beside the questions on wide screens, in view while they scroll, scrolling on its own when
    // taller than the window.
    alignSelf: "flex-start",
    boxSizing: "border-box",
    flexShrink: 0,
    maxHeight: "var(--size-viewport-height)",
    overflowY: "auto",
    paddingBlock: spacingVars["--spacing-6"],
    paddingInlineEnd: spacingVars["--spacing-4"],
    position: "sticky",
    top: 0,
    width: "var(--size-round-index)",
  },
  followUp: {
    paddingInlineStart: spacingVars["--spacing-4"],
  },
  inPage: {
    marginBlockEnd: spacingVars["--spacing-6"],
  },
  label: {
    // An index row's text wraps: no title is cut.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
});

/** Every applicable question with its state, the one at the top marked current. */
function Index({
  current,
  label = "Questions",
  onPick,
  questions,
}: {
  current: string | undefined;
  /** The list's own name, none where its nav or heading already names it. */
  label?: string | null;
  onPick: (id: string) => void;
  questions: ReadonlyArray<NavQuestion>;
}) {
  return (
    <List {...(label ? { "aria-label": label } : {})} density="compact">
      {questions.map((question) => (
        <ListItem
          isSelected={question.id === current}
          key={question.id}
          label={
            <span {...stylex.props(styles.label)}>
              {question.answered ? "✓" : "○"} {question.id} {question.title}
            </span>
          }
          onClick={() => onPick(question.id)}
          xstyle={question.level === 2 ? styles.followUp : undefined}
        />
      ))}
    </List>
  );
}

/**
 * On narrow screens, the round's index at its start, under its block: the human sees every question
 * before answering the first, and a later one's answer does not go into an earlier comment.
 */
export function RoundIndex({ questions }: { questions: ReadonlyArray<NavQuestion> }) {
  const title = useId();
  return (
    <nav aria-labelledby={title} {...stylex.props(styles.inPage)}>
      <Heading id={title} level={2}>
        Questions
      </Heading>
      <Index current={undefined} label={null} onPick={(id) => jumpTo(id)} questions={questions} />
    </nav>
  );
}

/**
 * The round's navigation: how many questions are answered, Next, which goes to the next blank
 * question, or Submit once none is, and the index of the questions. On narrow screens, in the top
 * bar, the count opening the index in a sheet; on wide screens, a sticky column with `n` and `p`.
 * `onSubmit` takes the page to its end.
 */
export function RoundNav({
  onSubmit,
  questions,
}: {
  onSubmit: () => void;
  questions: ReadonlyArray<NavQuestion>;
}) {
  const wide = !isNarrow(useWidthClass());
  const [open, setOpen] = useState(false);
  const ids = questions.map((q) => q.id);
  const current = useQuestionAtTop(ids, wide);
  const answered = questions.filter((q) => q.answered).length;
  const blank = questions.filter((q) => !q.answered);
  // A jump under way ends with the navigation: the next round's starts from its own top.
  useEffect(() => endJump, []);

  /** The first blank question after the one at the top, the first one when `wrap`. */
  const next = (wrap: boolean) => {
    const from = ids.indexOf(questionJumpedTo(ids) ?? "");
    const target = questions.find((q, index) => index > from && !q.answered) ?? (wrap && blank[0]);
    if (target) {
      jumpTo(target.id);
    }
  };
  const previous = () => {
    const from = ids.indexOf(questionJumpedTo(ids) ?? "");
    const target = questions
      .slice(0, Math.max(from, 0))
      .reverse()
      .find((q) => !q.answered);
    if (target) {
      jumpTo(target.id);
    }
  };
  useHotkeys([
    { isDisabled: !wide, keys: "n", onPress: () => next(false) },
    { isDisabled: !wide, keys: "p", onPress: previous },
  ]);
  useStatusHints(wide ? [{ keys: "n p", label: "unanswered" }] : []);

  const action = blank.length ? (
    <Button label="Next" onClick={() => next(true)} variant="primary" xstyle={styles.action} />
  ) : (
    <Button label="Submit" onClick={onSubmit} variant="primary" xstyle={styles.action} />
  );
  const count = `${answered} of ${questions.length} answered`;

  if (wide) {
    return (
      <nav aria-label="Questions" {...stylex.props(styles.column)}>
        <VStack gap={3}>
          <HStack align="center" gap={2} justify="between">
            <Text weight="semibold">{count}</Text>
            {action}
          </HStack>
          <ProgressBar
            isLabelHidden
            label="Questions answered"
            max={questions.length}
            value={answered}
          />
          <Index current={current ?? ids[0]} onPick={(id) => jumpTo(id)} questions={questions} />
          <Text color="secondary" type="supporting">
            n / p: next / previous unanswered
          </Text>
        </VStack>
      </nav>
    );
  }
  return (
    <>
      <TopBarSlot>
        <HStack align="center" gap={1}>
          <Button
            label={`${answered}/${questions.length}`}
            onClick={() => setOpen(true)}
            variant="ghost"
          />
          {action}
        </HStack>
      </TopBarSlot>
      {/* No field to type in: the sheet needs no room for a keyboard, and the round shows above. */}
      <Overlay isOpen={open} label="Questions" onClose={() => setOpen(false)} sheetHeight="capped">
        <VStack gap={2}>
          <Text color="secondary">{count}</Text>
          <Index
            current={questionAtTop(ids) ?? ids[0]}
            onPick={(id) => {
              setOpen(false);
              afterSheetCloses(() => jumpTo(id));
            }}
            questions={questions}
          />
        </VStack>
      </Overlay>
    </>
  );
}
