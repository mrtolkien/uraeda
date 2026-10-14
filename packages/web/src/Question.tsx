import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextArea, type TextAreaProps } from "@astryxdesign/core/TextArea";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  radiusVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  createContext,
  type ReactNode,
  useCallback,
  useContext,
  useEffect,
  useRef,
  useState,
} from "react";
import { useFateClient } from "react-fate";
import type { Choice, Document, QuestionItem } from "uraeda-binding";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageText } from "./attach/useImageText.ts";
import { Blocks } from "./Blocks.tsx";
import { refusal } from "./errors.ts";
import { StaticImages } from "./ImageView.tsx";
import { Spans } from "./Spans.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { type SaveState, useSave } from "./useSave.ts";
import { FileView } from "./views.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

const styles = stylex.create({
  actions: {
    marginBlockStart: spacingVars["--spacing-2"],
  },
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
  error: { color: colorVars["--color-error"] },
  saved: { color: colorVars["--color-success"] },
});

function Status({ state }: { state: SaveState }) {
  switch (state.kind) {
    case "saving":
      return (
        <Text color="secondary" type="supporting">
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

/**
 * A text area as tall as its text, about 50 characters a row, two rows at least. Its ref and other
 * props go to the `TextArea`, as an image field's paste and outline do.
 */
export function GrowingTextArea({
  value,
  ...props
}: Omit<TextAreaProps, "rows" | "value" | "onChange"> & {
  onChange?: (value: string) => void;
  value: string;
}) {
  const rows = Math.max(
    2,
    value.split("\n").reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / 50)), 0),
  );
  return <TextArea {...props} rows={rows} value={value} />;
}

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
 * A question's comment as it is written: it takes images pasted, dropped while it has the focus,
 * or picked with "Add image". `onImages` takes the text once they are added, to save at once.
 * `onSettled` takes how to wait for the images under way, as a submit does.
 */
function CommentField({
  path,
  id,
  comment,
  onChange,
  onImages,
  onSettled,
  children,
}: {
  path: string;
  id: string;
  comment: string;
  onChange: (comment: string) => void;
  onImages: (comment: string, added: boolean) => void;
  onSettled: (settled: () => Promise<void>) => void;
  children: ReactNode;
}) {
  const images = useImageText({
    path,
    text: comment,
    label: `${id}'s comment`,
    // The notes take a drop with no field focused: a comment takes it only while focused.
    priority: 0,
    onText: onImages,
  });
  useEffect(() => {
    onSettled(images.settled);
  }, [onSettled, images.settled]);
  return (
    <>
      <DropHint hint={images.hint}>
        <GrowingTextArea
          label="Comment"
          value={comment}
          onChange={onChange}
          {...images.fieldProps}
        />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack gap={2} align="center" wrap="wrap" xstyle={styles.actions}>
        <AttachButton onFiles={(files) => void images.addFiles(files)} />
        {children}
      </HStack>
    </>
  );
}

/**
 * A question in full: its context, every option with its text, pros, cons, and why, and a comment.
 * A tap on an option toggles its letter and saves the answer, with the comment as typed; the comment
 * alone saves with its button, or with Submit. With `onAsk`, it and its follow-ups offer "Ask the
 * agent".
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the answer's saving in a hook, and the options in a component
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
  const fate = useFateClient();
  const [letters, setLetters] = useState<ReadonlyArray<string>>(question.letters);
  const [comment, setComment] = useState(question.comment);
  // The comment as last saved or read: a comment typed since is a draft, which its button saves.
  const [savedComment, setSavedComment] = useState(question.comment);
  const save = useSave<{ comment: string; letters: ReadonlyArray<string> }>(
    async (value, previous) => {
      const result = await fate.mutations.answer.save({
        input: {
          comment: value.comment,
          folder,
          letters: [...value.letters],
          previous,
          question: question.id,
        },
        view: FileView,
      });
      if (result.error) {
        return { message: refusal(result.error).message, ok: false };
      }
      const saved = result.result?.current.items.clarifications?.questions.find(
        (q) => q.id === question.id,
      );
      setSavedComment(value.comment);
      return { ok: true, saved: saved?.answer ?? composed(value.letters, value.comment) };
    },
    question.answer,
  );
  const { flush, idle, schedule, settle } = save;
  const dirty = comment !== savedComment;
  const local = useRef({ comment, dirty, letters });
  // oxlint-disable-next-line react/refs -- before the code quality decision: the local answer, kept for the effects to read
  local.current = { comment, dirty, letters };
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
    (value: { comment: string; letters: ReadonlyArray<string> }) => schedule(value, true),
    [schedule],
  );
  // The images being added to the comment, which a submit waits for.
  const settled = useRef<() => Promise<void>>(async () => {});
  /** Saves the answer at once with the images' links, as a file with images is. */
  const onImages = useCallback(
    (value: string, added: boolean) => {
      setComment(value);
      local.current = { ...local.current, comment: value };
      if (added) {
        commit({ letters: local.current.letters, comment: value });
      }
    },
    [commit],
  );
  // Submit saves a comment still being written first, its images added.
  const pending = useContext(PendingSaves);
  useEffect(() => {
    const before = async () => {
      await settled.current();
      if (local.current.dirty) {
        commit({ comment: local.current.comment, letters: local.current.letters });
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
    commit({ comment, letters: next });
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
              onToggle={() => toggle(choice.letter)}
              selected={letters.includes(choice.letter)}
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
              commit({ comment: "-", letters: [] });
            }}
          />
        </HStack>
      )}
      {readOnly ? (
        comment && <Paragraph xstyle={styles.spaced}>{comment}</Paragraph>
      ) : (
        <div {...stylex.props(styles.spaced)}>
          <CommentField
            comment={comment}
            id={question.id}
            onChange={setComment}
            onImages={onImages}
            onSettled={(wait) => {
              settled.current = wait;
            }}
            path={path}
          >
            <Button
              isDisabled={!dirty}
              label="Save comment"
              onClick={() => commit({ comment, letters })}
            />
            {(!dirty || save.state.kind === "error") && <Status state={save.state} />}
          </CommentField>
        </div>
      )}
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
