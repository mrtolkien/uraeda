import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea } from "@astryxdesign/core/TextArea";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { createContext, useCallback, useContext, useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { refusal } from "./errors.ts";
import { Spans } from "./Spans.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { type SaveState, useSave } from "./useSave.ts";
import { FileView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

const styles = stylex.create({
  // A jump puts the question at the top, below the phone's top bar, which stays in view.
  question: {
    marginBlockStart: 0,
  },
  belowBar: {
    scrollMarginTop: `calc(${spacingVars["--spacing-12"]} + ${spacingVars["--spacing-2"]})`,
  },
  belowNothing: {
    scrollMarginTop: spacingVars["--spacing-4"],
  },
  followUp: {
    marginBlockStart: spacingVars["--spacing-4"],
    paddingInlineStart: spacingVars["--spacing-3"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: colorVars["--color-accent"],
  },
  title: {
    marginBlockStart: spacingVars["--spacing-0-5"],
    marginBlockEnd: spacingVars["--spacing-2"],
  },
  // Options run to the screen's edges on the phone, split by hairlines.
  options: {
    marginBlockStart: spacingVars["--spacing-3"],
    borderBlockStartWidth: borderVars["--border-width"],
    borderBlockStartStyle: "solid",
    borderBlockStartColor: colorVars["--color-border"],
  },
  bleed: {
    marginInline: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  bleedFollowUp: {
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-3"]})`,
    marginInlineEnd: `calc(-1 * ${spacingVars["--spacing-4"]})`,
  },
  option: {
    display: "block",
    width: "100%",
    boxSizing: "border-box",
    margin: 0,
    paddingBlock: spacingVars["--spacing-3"],
    paddingInlineStart: spacingVars["--spacing-3"],
    paddingInlineEnd: spacingVars["--spacing-4"],
    borderWidth: 0,
    borderBlockEndWidth: borderVars["--border-width"],
    borderBlockEndStyle: "solid",
    borderBlockEndColor: colorVars["--color-border"],
    borderInlineStartWidth: spacingVars["--spacing-1"],
    borderInlineStartStyle: "solid",
    borderInlineStartColor: "transparent",
    backgroundColor: "transparent",
    color: "inherit",
    font: "inherit",
    fontSize: "var(--text-reading-size)",
    lineHeight: "var(--text-reading-line)",
    textAlign: "start",
    textWrap: "pretty",
    cursor: "pointer",
  },
  optionOn: {
    borderInlineStartColor: colorVars["--color-accent"],
    backgroundColor: colorVars["--color-accent-muted"],
  },
  optionOff: {
    cursor: "default",
  },
  tag: {
    display: "block",
    marginBlockEnd: spacingVars["--spacing-1"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    color: colorVars["--color-warning"],
  },
  // An option's text keeps the reading measure, its row as wide as the question.
  summary: {
    display: "block",
    maxWidth: "var(--size-reading-measure)",
    fontWeight: fontWeightVars["--font-weight-semibold"],
  },
  letter: {
    float: "left",
    display: "flex",
    alignItems: "center",
    justifyContent: "center",
    boxSizing: "border-box",
    width: spacingVars["--spacing-7"],
    height: spacingVars["--spacing-7"],
    marginInlineEnd: spacingVars["--spacing-2"],
    borderWidth: spacingVars["--spacing-0-5"],
    borderStyle: "solid",
    borderColor: colorVars["--color-text-secondary"],
    borderRadius: radiusVars["--radius-full"],
    fontSize: typeScaleVars["--text-supporting-size"],
    fontWeight: fontWeightVars["--font-weight-bold"],
    color: colorVars["--color-text-secondary"],
  },
  letterOn: {
    borderColor: colorVars["--color-accent"],
    backgroundColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  points: {
    clear: "left",
    maxWidth: "var(--size-reading-measure)",
    marginBlock: spacingVars["--spacing-1-5"],
    marginInline: 0,
    padding: 0,
    listStyle: "none",
  },
  point: {
    position: "relative",
    marginBlockStart: spacingVars["--spacing-1"],
    paddingInlineStart: spacingVars["--spacing-5"],
  },
  sign: {
    position: "absolute",
    insetInlineStart: 0,
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  pro: { color: colorVars["--color-success"] },
  con: { color: colorVars["--color-error"] },
  why: { color: colorVars["--color-warning"] },
  spaced: {
    marginBlockStart: spacingVars["--spacing-3"],
  },
  actions: {
    marginBlockStart: spacingVars["--spacing-2"],
  },
});

/** Where questions put what they still have to save, so Submit saves it first. */
export const PendingSaves = createContext<Set<() => Promise<boolean>>>(new Set());

/** The answer as the core writes it, to show while it saves. */
export function composed(letters: ReadonlyArray<string>, comment: string) {
  const sorted = [...new Set(letters)].sort();
  const picked =
    sorted.length <= 1
      ? (sorted[0] ?? "")
      : `${sorted.slice(0, -1).join(", ")} and ${sorted.at(-1)}`;
  const text = comment.trim();
  if (!picked) {
    return text;
  }
  return text ? `${picked}: ${text}` : picked;
}

export const statusStyles = stylex.create({
  saved: { color: colorVars["--color-success"] },
  error: { color: colorVars["--color-error"] },
});

function Status({ state }: { state: SaveState }) {
  switch (state.kind) {
    case "saving":
      return (
        <Text type="supporting" color="secondary">
          saving…
        </Text>
      );
    case "saved":
      return <span {...stylex.props(statusStyles.saved)}>saved ✓</span>;
    case "error":
      return <span {...stylex.props(statusStyles.error)}>Not saved: {state.message}</span>;
    default:
      return null;
  }
}

/** A text area as tall as its text, about 50 characters a row, two rows at least. */
export function GrowingTextArea({
  label,
  value,
  onChange,
  placeholder,
  isReadOnly,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
  isReadOnly?: boolean;
}) {
  const rows = Math.max(
    2,
    value.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 50)), 0),
  );
  return (
    <TextArea
      label={label}
      value={value}
      onChange={onChange}
      placeholder={placeholder}
      rows={rows}
      isReadOnly={isReadOnly}
    />
  );
}

function Option({
  choice,
  document,
  selected,
  disabled,
  onToggle,
}: {
  choice: Choice;
  document: Document;
  selected: boolean;
  disabled: boolean;
  onToggle: () => void;
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
      type="button"
      aria-pressed={selected}
      disabled={disabled}
      onClick={onToggle}
      {...stylex.props(styles.option, selected && styles.optionOn, disabled && styles.optionOff)}
    >
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
    </button>
  );
}

/**
 * A question in full: its context, every option with its text, pros, cons, and why, and a comment.
 * A tap on an option toggles its letter and saves the answer, with the comment as typed; the comment
 * alone saves with its button, or with Submit.
 */
export function Question({
  folder,
  question,
  followUps,
  document,
  readOnly,
}: {
  folder: string;
  question: QuestionItem;
  followUps: ReadonlyArray<QuestionItem>;
  document: Document;
  readOnly: boolean;
}) {
  const fate = useFateClient();
  const [letters, setLetters] = useState<ReadonlyArray<string>>(question.letters);
  const [comment, setComment] = useState(question.comment);
  // The comment as last saved or read: a comment typed since is a draft, which its button saves.
  const [savedComment, setSavedComment] = useState(question.comment);
  const save = useSave<{ letters: ReadonlyArray<string>; comment: string }>(
    async (value, previous) => {
      const result = await fate.mutations.answer.save({
        input: {
          folder,
          question: question.id,
          letters: [...value.letters],
          comment: value.comment,
          previous,
        },
        view: FileView,
      });
      if (result.error) {
        return { ok: false, message: refusal(result.error).message };
      }
      const saved = result.result?.current.items.clarifications?.questions.find(
        (q) => q.id === question.id,
      );
      setSavedComment(value.comment);
      return { ok: true, saved: saved?.answer ?? composed(value.letters, value.comment) };
    },
    question.answer,
  );
  const { settle, idle, flush, schedule } = save;
  const dirty = comment !== savedComment;
  const local = useRef({ letters, comment, dirty });
  local.current = { letters, comment, dirty };
  // An answer changed elsewhere replaces this one when nothing of it waits to be saved, and no
  // comment is being written.
  useEffect(() => {
    const shown = composed(local.current.letters, local.current.comment);
    if (idle() && !local.current.dirty && question.answer.trim() !== shown) {
      setLetters(question.letters);
      setComment(question.comment);
      setSavedComment(question.comment);
    }
    settle(question.answer);
  }, [question.answer, question.letters, question.comment, idle, settle]);
  /** Saves the answer at once, with the comment as typed. */
  const commit = useCallback(
    (value: { letters: ReadonlyArray<string>; comment: string }) => schedule(value, true),
    [schedule],
  );
  // Submit saves a comment still being written first.
  const pending = useContext(PendingSaves);
  useEffect(() => {
    const before = () => {
      if (local.current.dirty) {
        commit({ letters: local.current.letters, comment: local.current.comment });
      }
      return flush();
    };
    pending.add(before);
    return () => {
      pending.delete(before);
    };
  }, [pending, flush, commit]);

  const toggle = (letter: string) => {
    const next = letters.includes(letter)
      ? letters.filter((l) => l !== letter)
      : [...letters, letter].sort();
    setLetters(next);
    commit({ letters: next, comment });
  };
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
      <Text type="supporting" color="secondary" weight="semibold">
        {question.id}
        {parent && question.applies === "yes" && ` · because you picked ${question.parentLetter}`}
        {parent && unclear && ` · ${parent} names no option`}
      </Text>
      <Heading level={2} id={`${question.id}-title`} tabIndex={-1} xstyle={styles.title}>
        {question.title}
      </Heading>
      <Blocks document={document} ids={question.context} />
      {question.options.length > 0 && (
        <div
          {...stylex.props(styles.options, !wide && (parent ? styles.bleedFollowUp : styles.bleed))}
        >
          {question.options.map((choice) => (
            <Option
              key={choice.letter}
              choice={choice}
              document={document}
              selected={letters.includes(choice.letter)}
              disabled={readOnly}
              onToggle={() => toggle(choice.letter)}
            />
          ))}
        </div>
      )}
      {unclear && !readOnly && (
        <HStack gap={2} xstyle={styles.spaced}>
          <Button
            label="Does not apply"
            onClick={() => {
              setLetters([]);
              setComment("-");
              commit({ letters: [], comment: "-" });
            }}
          />
        </HStack>
      )}
      {readOnly ? (
        comment && <Paragraph xstyle={styles.spaced}>{comment}</Paragraph>
      ) : (
        <div {...stylex.props(styles.spaced)}>
          <GrowingTextArea label="Comment" value={comment} onChange={setComment} />
          <HStack gap={2} align="center" wrap="wrap" xstyle={styles.actions}>
            <Button
              label="Save comment"
              isDisabled={!dirty}
              onClick={() => commit({ letters, comment })}
            />
            {(!dirty || save.state.kind === "error") && <Status state={save.state} />}
          </HStack>
        </div>
      )}
      {followUps.map((followUp) => (
        <Question
          key={followUp.id}
          folder={folder}
          question={followUp}
          followUps={[]}
          document={document}
          readOnly={readOnly}
        />
      ))}
    </section>
  );
}
