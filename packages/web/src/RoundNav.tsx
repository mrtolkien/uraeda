import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { useHotkeys } from "@astryxdesign/core/hooks";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useState } from "react";
import { Overlay } from "./layout/Overlay.tsx";
import { TopBarSlot } from "./layout/TopBarSlot.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";

/** An applicable question of a round, in the page's order: follow-ups at level 2. */
export type NavQuestion = { id: string; title: string; level: 1 | 2; answered: boolean };

const styles = stylex.create({
  // Beside the questions on wide screens, in view while they scroll, scrolling on its own when
  // taller than the window.
  column: {
    position: "sticky",
    top: 0,
    alignSelf: "flex-start",
    flexShrink: 0,
    boxSizing: "border-box",
    width: "var(--size-round-index)",
    maxHeight: "var(--size-viewport-height)",
    overflowY: "auto",
    paddingBlock: spacingVars["--spacing-6"],
    paddingInlineEnd: spacingVars["--spacing-4"],
  },
  followUp: {
    paddingInlineStart: spacingVars["--spacing-4"],
  },
  // An index row's text wraps: no title is cut.
  label: {
    whiteSpace: "normal",
    overflowWrap: "anywhere",
  },
});

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/**
 * Brings a question to the top of the screen, below the bar (its `scroll-margin-top`), and gives
 * its title the focus. Instant under reduced motion, or when `instant`.
 */
export function jumpTo(id: string, instant = false) {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }
  section.scrollIntoView?.({
    block: "start",
    behavior: instant || reducedMotion() ? "auto" : "smooth",
  });
  document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
}

/**
 * The question at the top of the screen: the last one whose top has reached the line a jump puts
 * it on. None before the first question.
 */
export function questionAtTop(ids: ReadonlyArray<string>): string | undefined {
  let at: string | undefined;
  for (const id of ids) {
    const section = document.getElementById(id);
    if (!section) {
      continue;
    }
    const line = parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    if (section.getBoundingClientRect().top <= line + 2) {
      at = id;
    }
  }
  return at;
}

/** The question at the top, followed while the page scrolls. */
function useQuestionAtTop(ids: ReadonlyArray<string>, isActive: boolean) {
  const [at, setAt] = useState<string>();
  const key = ids.join(" ");
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const list = key.split(" ");
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setAt(questionAtTop(list));
    };
    const onScroll = () => {
      frame ??= requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [key, isActive]);
  return at;
}

/**
 * Runs once a sheet's scroll lock is gone: while a modal sheet is open the page cannot scroll, and
 * closing it puts the page back where it was, then returns the focus to the sheet's trigger.
 */
function afterSheetCloses(run: () => void) {
  const start = performance.now();
  const tick = () => {
    if (document.body.style.position === "fixed" && performance.now() - start < 2000) {
      requestAnimationFrame(tick);
      return;
    }
    run();
  };
  requestAnimationFrame(tick);
}

/** Every applicable question with its state, the one at the top marked current. */
function Index({
  questions,
  current,
  onPick,
}: {
  questions: ReadonlyArray<NavQuestion>;
  current: string | undefined;
  onPick: (id: string) => void;
}) {
  return (
    <List aria-label="Questions" density="compact">
      {questions.map((question) => (
        <ListItem
          key={question.id}
          label={
            <span {...stylex.props(styles.label)}>
              {question.answered ? "✓" : "○"} {question.id} {question.title}
            </span>
          }
          isSelected={question.id === current}
          onClick={() => onPick(question.id)}
          xstyle={question.level === 2 ? styles.followUp : undefined}
        />
      ))}
    </List>
  );
}

/**
 * The round's navigation: how many questions are answered, Next, which goes to the next blank
 * question, or Submit once none is, and the index of the questions. On narrow screens, in the top
 * bar, the count opening the index in a sheet; on wide screens, a sticky column with `n` and `p`.
 * `onSubmit` takes the page to its end.
 */
export function RoundNav({
  questions,
  onSubmit,
}: {
  questions: ReadonlyArray<NavQuestion>;
  onSubmit: () => void;
}) {
  const wide = useWidthClass() === "wide";
  const [open, setOpen] = useState(false);
  const ids = questions.map((q) => q.id);
  const current = useQuestionAtTop(ids, wide);
  const answered = questions.filter((q) => q.answered).length;
  const blank = questions.filter((q) => !q.answered);

  /** The first blank question after the one at the top, the first one when `wrap`. */
  const next = (wrap: boolean) => {
    const from = ids.indexOf(questionAtTop(ids) ?? "");
    const target = questions.find((q, index) => index > from && !q.answered) ?? (wrap && blank[0]);
    if (target) {
      jumpTo(target.id);
    }
  };
  const previous = () => {
    const from = ids.indexOf(questionAtTop(ids) ?? "");
    const target = questions
      .slice(0, Math.max(from, 0))
      .reverse()
      .find((q) => !q.answered);
    if (target) {
      jumpTo(target.id);
    }
  };
  useHotkeys([
    { keys: "n", onPress: () => next(false), isDisabled: !wide },
    { keys: "p", onPress: previous, isDisabled: !wide },
  ]);

  const action = blank.length ? (
    <Button variant="primary" label="Next" onClick={() => next(true)} />
  ) : (
    <Button variant="primary" label="Submit" onClick={onSubmit} />
  );
  const count = `${answered} of ${questions.length} answered`;

  if (wide) {
    return (
      <nav aria-label="Questions" {...stylex.props(styles.column)}>
        <VStack gap={3}>
          <HStack justify="between" align="center" gap={2}>
            <Text weight="semibold">{count}</Text>
            {action}
          </HStack>
          <ProgressBar
            value={answered}
            max={questions.length}
            label="Questions answered"
            isLabelHidden
          />
          <Index questions={questions} current={current ?? ids[0]} onPick={(id) => jumpTo(id)} />
          <Text type="supporting" color="secondary">
            n / p: next / previous unanswered
          </Text>
        </VStack>
      </nav>
    );
  }
  return (
    <>
      <TopBarSlot>
        <HStack gap={1} align="center">
          <Button
            variant="ghost"
            label={`${answered}/${questions.length}`}
            onClick={() => setOpen(true)}
          />
          {action}
        </HStack>
      </TopBarSlot>
      {/* No field to type in: the sheet needs no room for a keyboard, and the round shows above. */}
      <Overlay label="Questions" isOpen={open} onClose={() => setOpen(false)} sheetHeight="capped">
        <VStack gap={2}>
          <Text color="secondary">{count}</Text>
          <Index
            questions={questions}
            current={questionAtTop(ids) ?? ids[0]}
            onPick={(id) => {
              setOpen(false);
              afterSheetCloses(() => jumpTo(id));
            }}
          />
        </VStack>
      </Overlay>
    </>
  );
}
