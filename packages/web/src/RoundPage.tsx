import { Heading } from "@astryxdesign/core/Heading";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useRef, useState } from "react";
import type { QuestionItem } from "uraeda-binding";
import { Blocks } from "./Blocks.tsx";
import { Crumbs } from "./Crumbs.tsx";
import { unsavedKey, useUnsavedOf } from "./fields/unsaved.ts";
import { Page } from "./layout/Page.tsx";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { Question } from "./Question.tsx";
import { type NavQuestion, RoundNav } from "./RoundNav.tsx";
import { useRoundNotes } from "./RoundNotes.tsx";
import { RoundEnd, useRoundSubmit } from "./RoundSubmit.tsx";
import { isTriage, RoundHash, type RoundTarget, useHashes } from "./roundTarget.ts";
import { useRepositoryPath } from "./routes.tsx";
import { askAbout, quoted } from "./sessions.ts";
import { plain } from "./Spans.tsx";
import { SettledPoints } from "./SettledPoints.tsx";
import { PendingSaves } from "./useAnswer.ts";
import { useRoundPosition } from "./useRoundPosition.ts";
import { type useFile, useAgent } from "./data.ts";

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

/**
 * A round of questions on one page: its context, every question in full with its follow-ups, the
 * points settled without the human, the notes, and Submit. `target` is what it answers: a
 * feature's round, with its crumbs and its agent to ask, or the inbox's triage, which has neither.
 */
export function RoundPage({ file, target }: { file: File; target: RoundTarget }) {
  const agent = useAgent();
  const triage = isTriage(target);
  const round = file.current.items.clarifications;
  const document = file.current.document;
  const readOnly = file.status !== "awaiting-human";
  // What questions still have to save, which Submit saves first: one set for the page's life.
  const pending = useState(() => new Set<() => Promise<boolean>>())[0];
  // The text's hash as last read or written, which the page's saves keep up to date.
  const hash = useHashes(document.hash);
  const notes = useRoundNotes(file, target, hash);
  const submitting = useRoundSubmit(file, notes, pending, target, hash);
  const wide = useWidthClass() === "wide";
  const end = useRef<HTMLDivElement>(null);
  // Submit's buttons, which the bar's Submit focuses.
  const submitRow = useRef<HTMLDivElement>(null);
  const questions = round?.questions ?? [];
  // The questions the round asks now, as the core says, a follow-up once its parent's answer
  // makes it apply, with no answer on disk and no comment typed, which Submit saves first: over a
  // blank answer, only text that is not blank is unsaved.
  const repo = useRepositoryPath();
  const keyOf = (q: QuestionItem) => unsavedKey(repo, `${file.path}#${q.id}`);
  const typed = useUnsavedOf(questions.map(keyOf));
  const blank = questions.filter((q) => q.asked && !q.answer.trim() && !typed.has(keyOf(q)));
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);
  const nav = navOf(questions);
  useRoundPosition(file.folder, file.name, nav);
  if (!round) {
    return null;
  }

  const toEnd = () => toSubmit(end, submitRow);

  /** Opens the feature's session with a question's title quoted. */
  const ask = (question: { id: string; title: string }) =>
    askAbout(file.folder, quoted(`About ${question.id} of ${file.path}:`, [question.title]));

  const content = (
    <>
      {!triage && <Crumbs current={file.name} folder={file.folder} />}
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
              followUps={questions.filter((q) => q.parent === question.id && q.asked)}
              path={file.path}
              question={question}
              readOnly={readOnly}
              takes={file.takesImages}
              target={target}
              {...(agent?.available && !triage ? { onAsk: ask } : {})}
            />
          </div>
        ))}
      <div {...stylex.props(styles.band, !wide && styles.bandBleed)} />
      <SettledPoints file={file} readOnly={readOnly} />
      <RoundEnd
        blank={blank}
        end={end}
        file={file}
        notes={notes}
        readOnly={readOnly}
        submitRow={submitRow}
        submitting={submitting}
        target={target}
      />
    </>
  );

  return (
    <RoundHash value={hash}>
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
    </RoundHash>
  );
}

/** Submit, at the page's end, `end`, in view, and its first button in `row` focused. */
function toSubmit(end: RefObject<HTMLDivElement | null>, row: RefObject<HTMLDivElement | null>) {
  const behavior = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches
    ? "auto"
    : "smooth";
  end.current?.scrollIntoView?.({ behavior, block: "end" });
  row.current
    ?.querySelector<HTMLButtonElement>("button:not([disabled])")
    ?.focus({ preventScroll: true });
}

/** The applicable questions in the page's order, each follow-up after its parent. */
function navOf(questions: ReadonlyArray<QuestionItem>): Array<NavQuestion> {
  return questions
    .flatMap((q) => (q.parent ? [] : [q, ...questions.filter((f) => f.parent === q.id && f.asked)]))
    .map((q) => ({
      answered: q.answer.trim() !== "",
      id: q.id,
      level: q.parent ? 2 : 1,
      title: q.title,
    }));
}
