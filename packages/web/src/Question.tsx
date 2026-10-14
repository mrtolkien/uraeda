import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { StaticImages } from "./ImageView.tsx";
import { Spans } from "./Spans.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { useAnswer } from "./useAnswer.ts";
import { AnswerComment } from "./QuestionComment.tsx";

const styles = stylex.create({
  belowBar: {
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  belowNothing: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  bleed: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  bleedFollowUp: {
    marginInlineEnd: `calc(-1 * ${spacingVars["--spacing-4"]})`,
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-3"]})`,
  },
  con: { color: colorVars["--color-error"] },
  followUp: {
    borderInlineStartColor: colorVars["--color-accent"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    marginBlockStart: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
  },
  letter: {
    alignItems: "center",
    borderColor: colorVars["--color-text-secondary"],
    borderRadius: radiusVars["--radius-full"],
    borderStyle: "solid",
    borderWidth: spacingVars["--spacing-0-5"],
    boxSizing: "border-box",
    color: colorVars["--color-text-secondary"],
    display: "flex",
    float: "left",
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    height: spacingVars["--spacing-7"],
    justifyContent: "center",
    marginInlineEnd: spacingVars["--spacing-2"],
    width: spacingVars["--spacing-7"],
  },
  letterOn: {
    backgroundColor: colorVars["--color-accent"],
    borderColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  option: {
    backgroundColor: "transparent",
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
    borderInlineStartColor: "transparent",
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderWidth: 0,
    boxSizing: "border-box",
    color: "inherit",
    cursor: "pointer",
    display: "block",
    font: "inherit",
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    margin: 0,
    paddingBlock: spacingVars["--spacing-3"],
    paddingInlineEnd: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
    textAlign: "start",
    textWrap: "pretty",
    width: "100%",
  },
  optionOff: {
    cursor: "default",
  },
  optionOn: {
    backgroundColor: colorVars["--color-accent-muted"],
    borderInlineStartColor: colorVars["--color-accent"],
  },
  options: {
    // Options run to the screen's edges on the phone, split by hairlines.
    borderBlockStartColor: colorVars["--color-border"],
    borderBlockStartStyle: "solid",
    borderBlockStartWidth: borderVars["--border-width"],
    marginBlockStart: spacingVars["--spacing-3"],
  },
  point: {
    marginBlockStart: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-5"],
    position: "relative",
  },
  points: {
    clear: "left",
    listStyle: "none",
    marginBlock: spacingVars["--spacing-1-5"],
    marginInline: 0,
    maxWidth: "var(--size-reading-measure)",
    padding: 0,
  },
  pro: { color: colorVars["--color-success"] },
  question: {
    // A jump puts the question at the top, below the phone's top bar, which stays in view.
    marginBlockStart: 0,
  },
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    insetInlineStart: 0,
    position: "absolute",
  },
  spaced: {
    marginBlockStart: spacingVars["--spacing-3"],
  },
  summary: {
    // An option's text keeps the reading measure, its row as wide as the question.
    display: "block",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    maxWidth: "var(--size-reading-measure)",
  },
  tag: {
    color: colorVars["--color-warning"],
    display: "block",
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    marginBlockEnd: spacingVars["--spacing-1"],
  },
  title: {
    marginBlockEnd: spacingVars["--spacing-2"],
    marginBlockStart: spacingVars["--spacing-0-5"],
  },
  why: { color: colorVars["--color-warning"] },
});

export const statusStyles = stylex.create({
  error: { color: colorVars["--color-error"] },
  saved: { color: colorVars["--color-success"] },
});

function Option({
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
  const spans = (id: number) => <Spans spans={document.blocks[id]?.spans ?? []} />;
  const point = (id: number, sign: string, tone: stylex.StyleXStyles) => (
    <li key={`${sign}${id}`} {...stylex.props(styles.point)}>
      <span {...stylex.props(styles.sign, tone)}>{sign}</span>
      {spans(id)}
    </li>
  );
  return (
    // oxlint-disable-next-line react/forbid-elements -- a full-width toggle holding paragraphs and lists, which no Astryx component draws (an Astryx gap, see the plan)
    <button
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      type="button"
      {...stylex.props(styles.option, selected && styles.optionOn, disabled && styles.optionOff)}
    >
      {/* A toggle holds its images alone: a link in it is invalid, and a tap is the toggle's. */}
      <StaticImages>
        {choice.recommended && <span {...stylex.props(styles.tag)}>Recommended</span>}
        <span {...stylex.props(styles.summary)}>
          <span {...stylex.props(styles.letter, selected && styles.letterOn)}>{choice.letter}</span>{" "}
          <Spans spans={choice.summary} />
        </span>
        {(choice.pros.length > 0 || choice.cons.length > 0 || choice.why !== undefined) && (
          <ul {...stylex.props(styles.points)}>
            {choice.pros.map((id) => point(id, "+", styles.pro))}
            {choice.cons.map((id) => point(id, "−", styles.con))}
            {choice.why !== undefined && point(choice.why, "★", styles.why)}
          </ul>
        )}
        {choice.other.length > 0 && <Blocks document={document} ids={choice.other} />}
      </StaticImages>
    </button>
  );
}

/**
 * A question in full: its context, every option with its text, pros, cons, and why, and a comment.
 * A tap on an option toggles its letter and saves the answer, with the comment as typed; the comment
 * alone saves with its button, or with Submit. With `onAsk`, it and its follow-ups offer "Ask the
 * agent".
 */
export function Question({
  document,
  folder,
  followUps,
  onAsk,
  path,
  question,
  readOnly,
}: {
  document: Document;
  folder: string;
  followUps: ReadonlyArray<QuestionItem>;
  onAsk?: (question: QuestionItem) => void;
  /** The round's file, which the comments' images are attached to. */
  path: string;
  question: QuestionItem;
  readOnly: boolean;
}) {
  const answer = useAnswer(question, folder, path);
  const { letters } = answer;
  const unclear = question.applies === "unclear";
  const parent = question.parent;
  const wide = useWidthClass() === "wide";

  return (
    <section
      id={question.id}
      {...stylex.props(
        styles.question,
        wide ? styles.belowNothing : styles.belowBar,
        parent !== undefined && styles.followUp,
      )}
    >
      <HStack align="center" gap={2} justify="between" wrap="wrap">
        <Text color="secondary" type="supporting" weight="semibold">
          {question.id}
          {parent && question.applies === "yes" && ` · because you picked ${question.parentLetter}`}
          {parent && unclear && ` · ${parent} names no option`}
        </Text>
        {onAsk && (
          <Button label="Ask the agent" onClick={() => onAsk(question)} size="sm" variant="ghost" />
        )}
      </HStack>
      <Heading id={`${question.id}-title`} level={2} tabIndex={-1} xstyle={styles.title}>
        {question.title}
      </Heading>
      <Blocks document={document} ids={question.context} />
      {question.options.length > 0 && (
        <div
          {...stylex.props(styles.options, !wide && (parent ? styles.bleedFollowUp : styles.bleed))}
        >
          {question.options.map((choice) => (
            <Option
              choice={choice}
              disabled={readOnly}
              document={document}
              key={choice.letter}
              onToggle={() => answer.toggle(choice.letter)}
              selected={letters.includes(choice.letter)}
            />
          ))}
        </div>
      )}
      {unclear && !readOnly && (
        <HStack gap={2} xstyle={styles.spaced}>
          <Button label="Does not apply" onClick={answer.notApplying} />
        </HStack>
      )}
      <AnswerComment
        answer={answer}
        id={question.id}
        path={path}
        readOnly={readOnly}
        saved={question.comment}
      />
      {followUps.map((followUp) => (
        <Question
          document={document}
          folder={folder}
          followUps={[]}
          key={followUp.id}
          path={path}
          question={followUp}
          readOnly={readOnly}
          {...(onAsk ? { onAsk } : {})}
        />
      ))}
    </section>
  );
}
