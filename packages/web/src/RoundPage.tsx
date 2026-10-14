import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  spacingVars,
  typeScaleVars,
  typographyVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { AttachButton } from "./attach/AttachButton.tsx";
import { AttachStatus } from "./attach/AttachStatus.tsx";
import { DropHint } from "./attach/DropHint.tsx";
import { useImageText } from "./attach/useImageText.ts";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { type Refusal, refusal } from "./errors.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { GrowingTextArea, PendingSaves, Question, statusStyles } from "./Question.tsx";
import { jumpTo, type NavQuestion, RoundNav } from "./RoundNav.tsx";
import { askAbout, handOver, quoted } from "./sessions.ts";
import { plain } from "./Spans.tsx";
import { useRoundPosition } from "./useRoundPosition.ts";
import { useSave } from "./useSave.ts";
import { FileView } from "./views.ts";
import { type useFile, useAgent } from "./data.ts";
import { Paragraph } from "./layout/Paragraph.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;

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
  columns: {
    // On wide screens, the questions and the index beside them, side by side in the middle.
    alignItems: "flex-start",
    display: "flex",
    justifyContent: "center",
  },
  output: {
    fontFamily: typographyVars["--font-family-code"],
    fontSize: typeScaleVars["--text-code-size"],
    margin: 0,
    whiteSpace: "pre-wrap",
  },
  questions: {
    flexGrow: 1,
    flexShrink: 1,
    maxWidth: "var(--size-page-max)",
    minWidth: 0,
  },
  title: {
    marginBlockEnd: spacingVars["--spacing-3"],
  },
});

/** A hook's refusal: the answers are saved, the commit is not, and it can be tried again. */
export function HookRefusal({
  error,
  onRetry,
  what,
}: {
  error: Refusal;
  onRetry: () => Promise<void>;
  what: string;
}) {
  return (
    <Banner
      collapsible={false}
      endContent={<Button clickAction={onRetry} label="Try again" />}
      status="error"
      title={`The pre-commit hook refused the commit. ${what}`}
    >
      <Collapsible trigger="Hook output">
        <pre {...stylex.props(styles.output)}>{error.output ?? error.message}</pre>
      </Collapsible>
    </Banner>
  );
}

/**
 * The round's notes as they are written: the page's main field, which takes the images dropped
 * with no field focused, as well as those pasted or picked. `onText` takes the text once they are
 * added, to save at once; `onSettled` takes how to wait for the images under way, as a submit does.
 */
function NotesField({
  path,
  notes,
  onChange,
  onText,
  onSettled,
}: {
  path: string;
  notes: string;
  onChange: (notes: string) => void;
  onText: (notes: string, added: boolean) => void;
  onSettled: (settled: () => Promise<void>) => void;
}) {
  const images = useImageText({ path, text: notes, label: "the notes", priority: 1, onText });
  useEffect(() => {
    onSettled(images.settled);
  }, [onSettled, images.settled]);
  return (
    <VStack gap={2}>
      <DropHint hint={images.hint} isLabelled>
        <GrowingTextArea label="Notes" value={notes} onChange={onChange} {...images.fieldProps} />
      </DropHint>
      <AttachStatus status={images.status} />
      <HStack gap={2}>
        <AttachButton
          name="Add image to the notes"
          onFiles={(files) => void images.addFiles(files)}
        />
      </HStack>
    </VStack>
  );
}

/**
 * A round of questions on one page: its context, every question in full with its follow-ups, the
 * points settled without the human, the notes, and Submit.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the notes' saving and the submit in hooks
export function RoundPage({ file }: { file: File }) {
  const fate = useFateClient();
  const agent = useAgent();
  const round = file.current.items.clarifications;
  const document = file.current.document;
  const readOnly = file.status !== "awaiting-human";
  const [notes, setNotes] = useState(round?.notes ?? "");
  const [error, setError] = useState<Refusal>();
  // Whether the last commit asked to start the agent, for its Try again.
  const continues = useRef(false);
  // oxlint-disable-next-line react/refs -- before the code quality decision: a set made once, kept for the page's life
  const pending = useRef(new Set<() => Promise<boolean>>()).current;
  // The images being added to the notes, which a submit waits for.
  const notesSettled = useRef<() => Promise<void>>(async () => {});
  const notesSave = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.notes.save({
      input: { folder: file.folder, notes: value, previous },
      view: FileView,
    });
    if (result.error) {
      return { message: refusal(result.error).message, ok: false };
    }
    return { ok: true, saved: result.result?.current.items.clarifications?.notes ?? value };
  }, round?.notes ?? "");
  const { idle, settle } = notesSave;
  const shownNotes = useRef(notes);
  // oxlint-disable-next-line react/refs -- before the code quality decision: the shown notes, kept for the effects to read
  shownNotes.current = notes;
  // Notes changed elsewhere replace these when nothing of them waits to be saved.
  useEffect(() => {
    const read = round?.notes ?? "";
    if (idle() && read !== shownNotes.current) {
      setNotes(read);
    }
    settle(read);
  }, [round?.notes, idle, settle]);
  const wide = useWidthClass() === "wide";
  const end = useRef<HTMLDivElement>(null);
  // Submit's buttons, which the bar's Submit focuses.
  const submitRow = useRef<HTMLDivElement>(null);
  const questions = round?.questions ?? [];
  // The questions the round asks now, as the core says: a follow-up once its parent's answer
  // makes it apply.
  const blank = questions.filter((q) => q.asked && !q.answer.trim());
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  // The applicable questions in the page's order, each follow-up after its parent.
  const nav: Array<NavQuestion> = questions
    .flatMap((q) => (q.parent ? [] : [q, ...questions.filter((f) => f.parent === q.id && f.asked)]))
    .map((q) => ({
      answered: q.answer.trim() !== "",
      id: q.id,
      level: q.parent ? 2 : 1,
      title: q.title,
    }));
  useRoundPosition(file.folder, file.name, nav);
  if (!round) {
    return null;
  }

  /** Submit, at the page's end, in view and focused. */
  const toEnd = () => {
    const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
      ? "auto"
      : "smooth";
    end.current?.scrollIntoView?.({ behavior, block: "end" });
    submitRow.current
      ?.querySelector<HTMLButtonElement>("button:not([disabled])")
      ?.focus({ preventScroll: true });
  };

  /** Opens the feature's session with a question's title quoted. */
  const ask = (question: { id: string; title: string }) =>
    askAbout(file.folder, quoted(`About ${question.id} of ${file.path}:`, [question.title]));

  /** Hands the feature over to the agent, once the round is committed. */
  const proceed = () => handOver(file.folder, "answers", file.name);
  const submit = async (next: boolean) => {
    setError(undefined);
    continues.current = next;
    // What is still being typed is saved first, and nothing is submitted unless it all is.
    const saved = await Promise.all([
      ...[...pending].map((flush) => flush()),
      notesSettled.current().then(() => notesSave.flush()),
    ]);
    if (!saved.every(Boolean)) {
      setError({
        kind: "refused",
        message:
          "Some answers were not saved: nothing was submitted. Check them, then submit again.",
      });
      return;
    }
    const result = await fate.mutations.answers.submit({
      input: { file: file.name, folder: file.folder },
      view: FileView,
    });
    if (result.error) {
      setError(refusal(result.error));
    } else if (next) {
      proceed();
    }
  };
  const retry = async () => {
    const result = await fate.mutations.commit.retry({
      input: { file: file.name, folder: file.folder },
      view: FileView,
    });
    setError(result.error ? refusal(result.error) : undefined);
    if (!result.error && continues.current) {
      proceed();
    }
  };

  const content = (
    <>
      <Crumbs current={file.name} folder={file.folder} />
      {title && (
        <Heading level={1} xstyle={styles.title}>
          {plain(title.spans)}
        </Heading>
      )}
      {round.block !== undefined && <Blocks document={document} ids={[round.block]} />}
      <Blocks document={document} ids={round.context} />
      {questions
        .filter((q) => !q.parent)
        .map((question) => (
          <div key={question.id}>
            <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
            <Question
              document={document}
              folder={file.folder}
              followUps={questions.filter((q) => q.parent === question.id && q.asked)}
              path={file.path}
              question={question}
              readOnly={readOnly}
              {...(agent?.available ? { onAsk: ask } : {})}
            />
          </div>
        ))}
      <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
      {round.settled.length > 0 && (
        <>
          <Heading level={2} xstyle={styles.title}>
            Settled without you
          </Heading>
          <Blocks document={document} ids={round.settled} />
        </>
      )}
      {readOnly ? (
        notes && (
          <Paragraph>
            <strong>Notes:</strong> {notes}
          </Paragraph>
        )
      ) : (
        <VStack gap={3} ref={end}>
          <NotesField
            notes={notes}
            onChange={(value) => {
              setNotes(value);
              notesSave.schedule(value);
            }}
            onSettled={(wait) => {
              notesSettled.current = wait;
            }}
            onText={(value, added) => {
              setNotes(value);
              notesSave.schedule(value, added);
            }}
            path={file.path}
          />
          {notesSave.state.kind === "error" && (
            <span {...stylex.props(statusStyles.error)}>Not saved: {notesSave.state.message}</span>
          )}
          {blank.length > 0 && (
            <Banner
              status="error"
              title={
                <>
                  {blank.length} {blank.length === 1 ? "question" : "questions"} left:{" "}
                  {blank.map((q, index) => (
                    <span key={q.id}>
                      {index > 0 && ", "}
                      <Link
                        hasUnderline
                        href={`#${q.id}`}
                        onClick={(event: React.MouseEvent) => {
                          event.preventDefault();
                          jumpTo(q.id);
                        }}
                      >
                        {q.id}
                      </Link>
                    </span>
                  ))}
                </>
              }
            />
          )}
          {error?.kind === "hook" ? (
            <HookRefusal
              error={error}
              onRetry={retry}
              what="Your answers are saved, not committed."
            />
          ) : (
            error && <span {...stylex.props(statusStyles.error)}>{error.message}</span>
          )}
          <div ref={submitRow}>
            <CommitActions isDisabled={blank.length > 0} label="Submit answers" onCommit={submit} />
          </div>
        </VStack>
      )}
    </>
  );

  return (
    <PendingSaves value={pending}>
      {readOnly || nav.length === 0 ? (
        <Page>{content}</Page>
      ) : (
        <div {...stylex.props(wide && styles.columns)}>
          <div {...stylex.props(styles.questions)}>
            <Page>{content}</Page>
          </div>
          <RoundNav onSubmit={toEnd} questions={nav} />
        </div>
      )}
    </PendingSaves>
  );
}
