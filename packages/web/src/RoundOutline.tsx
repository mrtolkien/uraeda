import { Button } from "@astryxdesign/core/Button";
import { Divider } from "@astryxdesign/core/Divider";
import { HStack } from "@astryxdesign/core/HStack";
import { useHotkeys } from "@astryxdesign/core/hooks";
import { List, ListItem } from "@astryxdesign/core/List";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Text } from "@astryxdesign/core/Text";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect } from "react";
import type { Document, RoundItems, SettledGroup, SettledKind } from "uraeda-binding";
import { Overlay } from "./layout/Overlay.tsx";
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
import { useStatusHints } from "./statusHints.tsx";

const styles = stylex.create({
  action: {
    // Next or Submit keeps its width beside the count: its label is never cut.
    flexShrink: 0,
  },
  label: {
    // A row's text wraps: no title is cut.
    overflowWrap: "anywhere",
    whiteSpace: "normal",
  },
  mark: {
    // The marks line up in one column, whatever their glyph's width.
    display: "inline-block",
    textAlign: "center",
    width: spacingVars["--spacing-3"],
  },
  sub: {
    paddingInlineStart: spacingVars["--spacing-4"],
  },
});

/** A row of the outline: the part it jumps to, by its id on the page, and how it reads. */
type Row = {
  id: string;
  label: string;
  /** Before the label, for a part: what kind of part it is. */
  mark?: string;
  /** A question's state: a glyph before its label, and words at the end of its name. */
  state?: "answered" | "unanswered";
  /** Under the row before it: a part of the context, a follow-up under its question. */
  sub?: boolean;
  tone?: "warning";
};

/** The parts the page draws for each kind of settled group, by their ids, and their rows' names. */
const GROUPS: Record<SettledKind, { id: string; label: string; mark: string }> = {
  behaviour: { id: PART_IDS.behaviour, label: "Behaviour", mark: "·" },
  check: { id: PART_IDS.check, label: "Check these", mark: "⚑" },
  hood: { id: PART_IDS.hood, label: "Under the hood", mark: "·" },
};

/** The part that opens through the address, as a link to it does: Today, folded to its title. */
const OPENS_BY_ADDRESS = new Set(["today"]);

/** A settled group's row, none for a group without points, as the page draws no pane for it. */
function groupRow(group: SettledGroup | undefined): Array<Row> {
  if (!group || group.points === 0) {
    return [];
  }
  const { id, label, mark } = GROUPS[group.kind];
  return [
    {
      id,
      label: `${label} · ${group.points}`,
      mark,
      ...(group.kind === "check" ? { tone: "warning" } : {}),
    },
  ];
}

/**
 * The outline's rows, in the page's order, in three runs: the opening (the block, the context, the
 * points to check), the questions with their follow-ups, and the end (the settled points, the notes).
 */
function rowsOf(round: RoundItems, document: Document, questions: ReadonlyArray<NavQuestion>) {
  const group = (kind: SettledKind) => round.settledGroups.find((g) => g.kind === kind);
  const opening: Array<Row> = [
    ...(round.block === undefined
      ? []
      : [
          {
            id: PART_IDS.summary,
            label: round.verdict ? "Verdict and summary" : "Summary",
            mark: "!",
          },
        ]),
    ...round.context.map((part) => {
      const anchor = part.heading === undefined ? undefined : document.blocks[part.heading]?.anchor;
      return anchor
        ? { id: anchor, label: part.title, mark: "·", sub: true }
        : { id: PART_IDS.context, label: "Context", mark: "·", sub: true };
    }),
    ...groupRow(group("check")),
  ];
  const asked: Array<Row> = questions.map((q) => ({
    id: q.id,
    label: `${q.id} ${q.title}`,
    state: q.answered ? "answered" : "unanswered",
    sub: q.level === 2,
  }));
  const end: Array<Row> = [
    ...groupRow(group("behaviour")),
    ...groupRow(group("hood")),
    { id: PART_IDS.notes, label: "Notes and submit", mark: "✎" },
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

/** The outline's runs of rows, the part at the top, `current`, marked. */
function Rows({
  current,
  onPick,
  runs,
}: {
  current: string | undefined;
  onPick: (id: string) => void;
  runs: ReadonlyArray<ReadonlyArray<Row>>;
}) {
  return runs.map((run, index) => (
    <VStack gap={2} key={run[0]?.id}>
      {index > 0 && <Divider />}
      <List density="compact">
        {run.map((row) => (
          <ListItem
            isSelected={row.id === current}
            key={row.id}
            label={
              <span {...stylex.props(styles.label)}>
                {row.state && <span aria-hidden>{row.state === "answered" ? "✓ " : "○ "}</span>}
                {row.label}
                {row.state && <VisuallyHidden> ({row.state})</VisuallyHidden>}
              </span>
            }
            onClick={() => onPick(row.id)}
            {...(row.mark
              ? {
                  startContent: (
                    <Text aria-hidden color={row.tone ?? "secondary"} xstyle={styles.mark}>
                      {row.mark}
                    </Text>
                  ),
                }
              : {})}
            xstyle={row.sub ? styles.sub : undefined}
          />
        ))}
      </List>
    </VStack>
  ));
}

/** "N of M answered". */
const countOf = (questions: ReadonlyArray<NavQuestion>) =>
  `${questions.filter((q) => q.answered).length} of ${questions.length} answered`;

/**
 * The round's outline: how many questions are answered, Next, which goes to the next blank
 * question, or Submit once none is, then every part of the round, its questions with their
 * follow-ups under them, the part at the top marked. A row brings its part to the top. While
 * `isActive`, it follows the page's scroll, and `n` and `p` go to the next and previous blank
 * question. `onSubmit` takes the page to its end.
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
  const ids = questions.map((q) => q.id);
  const answered = questions.filter((q) => q.answered).length;
  const blank = questions.filter((q) => !q.answered);
  // A jump under way ends with the outline: the next round's starts from its own top.
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
    { isDisabled: !isActive, keys: "n", onPress: () => next(false) },
    { isDisabled: !isActive, keys: "p", onPress: previous },
  ]);
  useStatusHints(isActive ? [{ keys: "n p", label: "unanswered" }] : []);

  return (
    <nav aria-label="Outline">
      <VStack gap={3}>
        <HStack align="center" gap={2} justify="between">
          <Text weight="semibold">{countOf(questions)}</Text>
          {blank.length ? (
            <Button
              label="Next"
              onClick={() => next(true)}
              variant="primary"
              xstyle={styles.action}
            />
          ) : (
            <Button label="Submit" onClick={onSubmit} variant="primary" xstyle={styles.action} />
          )}
        </HStack>
        <ProgressBar
          isLabelHidden
          label="Questions answered"
          max={questions.length}
          value={answered}
        />
        <Rows current={current ?? parts[0]} onPick={goTo} runs={runs} />
        <Text color="secondary" type="supporting">
          n / p: next / previous unanswered
        </Text>
      </VStack>
    </nav>
  );
}

/**
 * On the phone, the outline's rows in a sheet, the part at the top marked: a tap on a row closes
 * the sheet, then brings its part to the top once the page can scroll again.
 */
export function OutlineSheet({
  document,
  isOpen,
  onClose,
  questions,
  round,
}: {
  document: Document;
  isOpen: boolean;
  onClose: () => void;
  questions: ReadonlyArray<NavQuestion>;
  round: RoundItems;
}) {
  const runs = rowsOf(round, document, questions);
  const parts = runs.flat().map((row) => row.id);
  return (
    // No field to type in: the sheet needs no room for a keyboard, and the round shows above.
    <Overlay isOpen={isOpen} label="Outline" onClose={onClose} sheetHeight="capped">
      <VStack gap={2}>
        <Text color="secondary">{countOf(questions)}</Text>
        <Rows
          current={questionAtTop(parts) ?? parts[0]}
          onPick={(id) => {
            onClose();
            afterSheetCloses(() => goTo(id));
          }}
          runs={runs}
        />
      </VStack>
    </Overlay>
  );
}
