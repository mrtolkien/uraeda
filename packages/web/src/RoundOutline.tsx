import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import type { Document, RoundItems, SettledGroup, SettledKind } from "uraeda-binding";
import { NavTile } from "./layout/NavBar.tsx";
import { OutlineRows, type OutlineRow, type StateNames } from "./layout/OutlineRows.tsx";
import { useKeys } from "./keys/registry.tsx";
import { openAnchor } from "./routeHistory.ts";
import { PART_IDS } from "./roundPartIds.ts";
import {
  afterSheetCloses,
  endJump,
  jumpTo,
  type NavQuestion,
  questionAtTop,
  questionJumpedTo,
  useQuestionAtTop,
} from "./roundJump.ts";

const styles = stylex.create({
  action: {
    // Next or Submit keeps its width beside the count: its label is never cut.
    flexShrink: 0,
  },
});

/** A question's state, as a screen reader hears it after its title. */
const ANSWERED: StateNames = { done: "answered", open: "unanswered" };

/** The parts the page draws for each kind of settled group, by their ids, and their rows' names. */
const GROUPS: Record<SettledKind, { id: string; label: string; mark: string }> = {
  behaviour: { id: PART_IDS.behaviour, label: "Behaviour", mark: "·" },
  check: { id: PART_IDS.check, label: "Check these", mark: "⚑" },
  hood: { id: PART_IDS.hood, label: "Under the hood", mark: "·" },
};

/** The part that opens through the address, as a link to it does: Today, folded to its title. */
const OPENS_BY_ADDRESS = new Set<string>([PART_IDS.today]);

/** A settled group's row, none for a group without points, as the page draws no pane for it. */
function groupRow(group: SettledGroup | undefined): Array<OutlineRow> {
  if (!group || group.points === 0) {
    return [];
  }
  const { id, label, mark } = GROUPS[group.kind];
  return [
    {
      id,
      label: `${label} · ${group.points}`,
      mark,
      nested: false,
      ...(group.kind === "check" ? { tone: "warning" } : {}),
    },
  ];
}

/** The questions' rows, follow-ups under their parent. */
function questionRows(questions: ReadonlyArray<NavQuestion>): Array<OutlineRow> {
  return questions.map((q) => ({
    id: q.id,
    label: `${q.id} ${q.title}`,
    nested: q.level === 2,
    state: q.answered ? "done" : "open",
  }));
}

/**
 * The outline's rows, in the page's order, in three runs: the opening (the block, the context, the
 * points to check), the questions with their follow-ups, and the end (the settled points, the notes).
 */
function rowsOf(round: RoundItems, document: Document, questions: ReadonlyArray<NavQuestion>) {
  const group = (kind: SettledKind) => round.settledGroups.find((g) => g.kind === kind);
  const opening: Array<OutlineRow> = [
    ...(round.block === undefined
      ? []
      : [
          {
            id: PART_IDS.summary,
            label: round.verdict ? "Verdict and summary" : "Summary",
            mark: "!",
            nested: false,
          },
        ]),
    ...round.context.map((part) => {
      const anchor = part.heading === undefined ? undefined : document.blocks[part.heading]?.anchor;
      return anchor
        ? { id: anchor, label: part.title, mark: "·", nested: true }
        : { id: PART_IDS.context, label: "Context", mark: "·", nested: true };
    }),
    ...groupRow(group("check")),
  ];
  const asked = questionRows(questions);
  const end: Array<OutlineRow> = [
    ...groupRow(group("behaviour")),
    ...groupRow(group("hood")),
    { id: PART_IDS.notes, label: "Notes and submit", mark: "✎", nested: false },
  ];
  return [opening, asked, end].filter((run) => run.length > 0);
}

/**
 * Brings a part to the top. Today, folded to its title, opens through the address first, as a
 * link to `#today` opens it, then comes to the top once open.
 */
function goTo(id: string) {
  if (!OPENS_BY_ADDRESS.has(id)) {
    jumpTo(id);
    return;
  }
  openAnchor(id);
  requestAnimationFrame(() => jumpTo(id));
}

/**
 * Jumps to the round's blank questions: `next`, the first blank one after the one at the top, the
 * first one when `wrap`, and `previous`, the last blank one before it.
 */
function useBlankJumps(questions: ReadonlyArray<NavQuestion>) {
  const ids = questions.map((q) => q.id);
  const blank = questions.filter((q) => !q.answered);
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
  return { blank, next, previous };
}

/**
 * `n` and `p`, to the next and previous blank question, whatever the column's open tab and the
 * width, declared in the key registry with the status line's hint for them, `n p unanswered`. A
 * jump under way ends with the page: the next round's starts from its own top.
 */
export function useBlankKeys(questions: ReadonlyArray<NavQuestion>) {
  const { next, previous } = useBlankJumps(questions);
  useEffect(() => endJump, []);
  useKeys([
    { hint: "n p", keys: "n", label: "unanswered", run: () => next(false) },
    { keys: "p", label: "previous unanswered", run: previous },
  ]);
}

/** Next, to the next blank question, or Submit once none is, which `onSubmit` does. */
export function NextOrSubmit({
  onSubmit,
  questions,
}: {
  onSubmit: () => void;
  questions: ReadonlyArray<NavQuestion>;
}) {
  const { blank, next } = useBlankJumps(questions);
  return blank.length ? (
    <Button label="Next" onClick={() => next(true)} variant="primary" xstyle={styles.action} />
  ) : (
    <Button label="Submit" onClick={onSubmit} variant="primary" xstyle={styles.action} />
  );
}

/**
 * The phone's bar's Next, a help, its icon in the accent, or Submit once no question is blank, the
 * page's action, filled with it.
 */
export function NextTile({
  onSubmit,
  questions,
}: {
  onSubmit: () => void;
  questions: ReadonlyArray<NavQuestion>;
}) {
  const { blank, next } = useBlankJumps(questions);
  return blank.length ? (
    <NavTile icon="uraeda:arrow-right" isTinted label="Next" onPress={() => next(true)} />
  ) : (
    <NavTile icon="uraeda:badge-check" isAction label="Submit" onPress={onSubmit} />
  );
}

/** "N of M answered". */
const countOf = (questions: ReadonlyArray<NavQuestion>) =>
  `${questions.filter((q) => q.answered).length} of ${questions.length} answered`;

/**
 * The round's outline: how many questions are answered, Next, which goes to the next blank
 * question, or Submit once none is, then every part of the round, its questions with their
 * follow-ups under them, the part at the top marked. A row brings its part to the top. While
 * `isActive`, it follows the page's scroll. `onSubmit` takes the page to its end.
 */
export function RoundOutline({
  document,
  isActive,
  onSubmit,
  questions,
  round,
}: {
  document: Document;
  isActive: boolean;
  onSubmit: () => void;
  questions: ReadonlyArray<NavQuestion>;
  round: RoundItems;
}) {
  const runs = rowsOf(round, document, questions);
  const parts = runs.flat().map((row) => row.id);
  const current = useQuestionAtTop(parts, isActive);
  const { blank } = useBlankJumps(questions);

  return (
    <nav aria-label="Outline">
      <VStack gap={3}>
        <HStack align="center" gap={2} justify="between">
          <Text weight="semibold">{countOf(questions)}</Text>
          <NextOrSubmit onSubmit={onSubmit} questions={questions} />
        </HStack>
        <ProgressBar
          isLabelHidden
          label="Questions answered"
          max={questions.length}
          value={questions.length - blank.length}
        />
        <OutlineRows
          current={current ?? parts[0]}
          onPick={goTo}
          runs={runs}
          stateNames={ANSWERED}
        />
        <Text color="secondary" type="supporting">
          n / p: next / previous unanswered
        </Text>
      </VStack>
    </nav>
  );
}

/**
 * On the phone, the outline's rows in its sheet, the part at the top marked: a tap on a row closes
 * the sheet, `onClose`, then brings its part to the top once the page can scroll again.
 */
export function OutlineSheetPanel({
  document,
  onClose,
  questions,
  round,
}: {
  document: Document;
  onClose: () => void;
  questions: ReadonlyArray<NavQuestion>;
  round: RoundItems;
}) {
  const runs = rowsOf(round, document, questions);
  const parts = runs.flat().map((row) => row.id);
  return (
    <VStack gap={2}>
      <Text color="secondary">{countOf(questions)}</Text>
      <OutlineRows
        current={questionAtTop(parts) ?? parts[0]}
        onPick={(id) => {
          onClose();
          afterSheetCloses(() => goTo(id));
        }}
        runs={runs}
        stateNames={ANSWERED}
      />
    </VStack>
  );
}
