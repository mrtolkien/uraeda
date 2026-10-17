// TEMPORARY: the round page's mockups for the clarifications redesign
// (`specs/2026-10-17-redesign-clarifications/spec.md`), drawn by `QuestionCard.stories.tsx` and
// `RoundPage.stories.tsx`. The implementation replaces them with `RoundPage` and `Question`. They
// walk the document tree for the sub-headings the core does not send yet, which the implementation
// moves into the core. A tap picks a letter here only: nothing is saved.
import { Button } from "@astryxdesign/core/Button";
import { Card } from "@astryxdesign/core/Card";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
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
import { useState } from "react";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "../Blocks.tsx";
import { useFile } from "../data.ts";
import { TextField } from "../fields/TextField.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { plain, Spans } from "../Spans.tsx";
import { RichBlocks } from "./RichBlocks.tsx";

const styles = stylex.create({
  band: {
    // On the phone, a band between questions, to the screen's edges, as today.
    backgroundColor: colorVars["--color-background-muted"],
    height: spacingVars["--spacing-2"],
    marginBlock: spacingVars["--spacing-4"],
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  con: { color: colorVars["--color-error"] },
  followUp: {
    marginInlineStart: spacingVars["--spacing-6"],
  },
  followUpPhone: {
    // On the phone, a follow-up keeps today's accent line on its side, and little inset.
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockStart: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
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
  optionPhone: {
    // On the phone, options run to the screen's edges, as today, split by hairlines.
    borderRadius: 0,
    borderWidth: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  page: {
    boxSizing: "border-box",
    flexGrow: 1,
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    minWidth: 0,
    padding: spacingVars["--spacing-6"],
  },
  pagePhone: {
    padding: spacingVars["--spacing-4"],
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
    alignItems: "flex-start",
    display: "flex",
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
  stickyHead: {
    // On the phone, the question's title stays in view while its options scroll under it.
    backgroundColor: colorVars["--color-background-body"],
    insetBlockStart: 0,
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-4"],
    position: "sticky",
    zIndex: 1,
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
  titlePhone: {
    fontSize: typeScaleVars["--text-heading-3-size"],
    lineHeight: typeScaleVars["--text-heading-3-leading"],
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
  const wide = useWidthClass() === "wide";
  return (
    <SelectableCard
      isSelected={picked}
      label={`Option ${choice.letter}`}
      onChange={onToggle}
      padding={wide ? 3 : 4}
      {...(wide ? {} : { xstyle: styles.optionPhone })}
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

/** The letters picked for each question, and the comment typed for each. */
export type Answers = Record<string, { comment?: string; letters: ReadonlyArray<string> }>;

/**
 * A question as a card: on a wide screen, its title and context on the left, its options and its
 * comment on the right; on a phone, all in one column.
 */
function QuestionCard({
  answers,
  document,
  header,
  onToggle,
  question,
}: {
  answers: Answers;
  document: Document;
  header: string;
  onToggle: (letter: string) => void;
  question: QuestionItem;
}) {
  const wide = useWidthClass() === "wide";
  const answer = answers[question.id] ?? { letters: [] };
  const title = (
    <VStack gap={wide ? 3 : 1}>
      <HStack align="center" gap={2} justify="between">
        <Text color="secondary" type="supporting" weight="semibold">
          {header}
        </Text>
        <Button label="Ask the agent" size="sm" variant="ghost" />
      </HStack>
      <Heading level={2} xstyle={wide ? styles.title : styles.titlePhone}>
        {question.title}
      </Heading>
    </VStack>
  );
  const head = (
    <VStack gap={3}>
      {wide && title}
      <RichBlocks document={document} ids={question.context} />
    </VStack>
  );
  const answering = (
    <VStack gap={3}>
      {question.options.map((choice) => (
        <OptionCard
          choice={choice}
          document={document}
          key={choice.letter}
          onToggle={() => onToggle(choice.letter)}
          picked={answer.letters.includes(choice.letter)}
        />
      ))}
      <TextField
        kind="line"
        label="Comment, or your own answer instead of a letter"
        value={answer.comment ?? ""}
      />
    </VStack>
  );
  if (!wide) {
    // On the phone, no card: the title sticks at the top while the question scrolls.
    return (
      <section>
        <div {...stylex.props(styles.stickyHead)}>{title}</div>
        <VStack gap={4}>
          {head}
          {answering}
        </VStack>
      </section>
    );
  }
  return (
    <Card padding={6}>
      <div {...stylex.props(styles.split)}>
        {head}
        {answering}
      </div>
    </Card>
  );
}

/**
 * Every question of a round as a card, each follow-up its own card after its parent's, joined to it
 * by a line, once its letter is picked.
 */
export function QuestionCards({
  answers,
  document,
  onToggle,
  questions,
}: {
  answers: Answers;
  document: Document;
  onToggle: (id: string, letter: string) => void;
  questions: ReadonlyArray<QuestionItem>;
}) {
  const wide = useWidthClass() === "wide";
  return (
    <VStack gap={wide ? 8 : 0}>
      {questions
        .filter((q) => !q.parent)
        .map((question) => {
          const letters = answers[question.id]?.letters ?? [];
          const followUps = questions.filter(
            (q) => q.parent === question.id && letters.includes(q.parentLetter ?? ""),
          );
          return (
            <div key={question.id}>
              {!wide && <div {...stylex.props(styles.band)} />}
              <QuestionCard
                answers={answers}
                document={document}
                header={question.id}
                onToggle={(letter) => onToggle(question.id, letter)}
                question={question}
              />
              {followUps.map((followUp) => (
                <div key={followUp.id}>
                  {wide && <div {...stylex.props(styles.joint)} />}
                  <div {...stylex.props(wide ? styles.followUp : styles.followUpPhone)}>
                    <QuestionCard
                      answers={answers}
                      document={document}
                      header={`${followUp.id} · follows ${question.id}, because you picked ${followUp.parentLetter}`}
                      onToggle={(letter) => onToggle(followUp.id, letter)}
                      question={followUp}
                    />
                  </div>
                </div>
              ))}
            </div>
          );
        })}
    </VStack>
  );
}

/** The answers as the page keeps them, with a tap that toggles a letter. */
export function useAnswers(initial: Answers) {
  const [answers, setAnswers] = useState<Answers>(initial);
  const toggle = (id: string, letter: string) =>
    setAnswers((now) => {
      const was = now[id] ?? { letters: [] };
      const letters = was.letters.includes(letter)
        ? was.letters.filter((l) => l !== letter)
        : [...was.letters, letter];
      return { ...now, [id]: { ...was, letters } };
    });
  return { answers, toggle };
}

/** The top-level blocks from the level-2 heading `title` to the next level-2 heading or the notes. */
function sectionOf(document: Document, title: string): Array<number> {
  const top = document.blocks.filter((b) => b.parent === undefined);
  const start = top.findIndex(
    (b) => b.kind === "heading" && b.level === 2 && plain(b.spans) === title,
  );
  if (start < 0) {
    return [];
  }
  const rest = top.slice(start + 1);
  const end = rest.findIndex(
    (b) =>
      (b.kind === "heading" && b.level === 2) ||
      (b.kind === "paragraph" && plain(b.spans).startsWith("Notes:")),
  );
  return (end < 0 ? rest : rest.slice(0, end)).map((b) => b.id);
}

/** Each settled group's icon and colour, and whether it starts folded. */
const GROUPS: Record<string, { color: "warning" | "secondary"; folded: boolean; icon: string }> = {
  Behaviour: { color: "secondary", folded: false, icon: "info" },
  "Check these": { color: "warning", folded: false, icon: "warning" },
  "Under the hood": { color: "secondary", folded: true, icon: "wrench" },
};

/** A settled group: its icon and heading, then its points, folded until opened when it starts so. */
function SettledGroup({
  document,
  ids,
  title,
}: {
  document: Document;
  ids: ReadonlyArray<number>;
  title: string;
}) {
  const group = GROUPS[title] ?? { color: "secondary", folded: false, icon: "info" };
  const [open, setOpen] = useState(!group.folded);
  return (
    <VStack gap={2}>
      <HStack align="center" gap={2}>
        <Icon color={group.color} icon={group.icon} size="md" />
        <Heading level={3}>{title}</Heading>
        {group.folded && (
          <Button
            label={open ? "Fold" : `Show ${ids.length > 0 ? "the points" : ""}`}
            onClick={() => setOpen(!open)}
            size="sm"
            variant="ghost"
          />
        )}
      </HStack>
      {open && <Blocks document={document} ids={ids} />}
    </VStack>
  );
}

/** The settled points, split into their groups at each level-3 heading. */
function SettledGroups({ document }: { document: Document }) {
  const groups: Array<{ ids: Array<number>; title: string }> = [];
  for (const id of sectionOf(document, "Settled without the human")) {
    const block = document.blocks[id];
    if (block?.kind === "heading") {
      groups.push({ ids: [], title: plain(block.spans) });
    } else {
      groups.at(-1)?.ids.push(id);
    }
  }
  return (
    <VStack gap={5}>
      <Heading level={2}>Settled without you</Heading>
      {groups.map((group) => (
        <SettledGroup document={document} ids={group.ids} key={group.title} title={group.title} />
      ))}
    </VStack>
  );
}

/**
 * The mockup feature's round as the redesign draws it: the verdict block, the context's parts under
 * their sub-headings, the questions as cards, the settled points in their groups, and "Anything
 * else" before Submit.
 */
export function RoundMockup({ folder, initial }: { folder: string; initial: Answers }) {
  const file = useFile(folder, "clarifications-01.md");
  const wide = useWidthClass() === "wide";
  const { answers, toggle } = useAnswers(initial);
  const round = file?.current.items.clarifications;
  if (!file || !round) {
    return null;
  }
  const document = file.current.document;
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  return (
    <div {...stylex.props(styles.row)}>
      <div {...stylex.props(styles.page, !wide && styles.pagePhone)}>
        <VStack gap={6}>
          {title && <Heading level={1}>{plain(title.spans)}</Heading>}
          {round.block !== undefined && <Blocks document={document} ids={[round.block]} />}
          <RichBlocks document={document} ids={sectionOf(document, "Context")} />
          <QuestionCards
            answers={answers}
            document={document}
            onToggle={toggle}
            questions={round.questions}
          />
          {wide ? (
            <Card padding={6}>
              <SettledGroups document={document} />
            </Card>
          ) : (
            <>
              <div {...stylex.props(styles.band)} />
              <SettledGroups document={document} />
            </>
          )}
          <TextField kind="notes" label="Anything else" />
          <HStack gap={2}>
            <Button label="Submit answers" variant="primary" />
          </HStack>
        </VStack>
      </div>
    </div>
  );
}
