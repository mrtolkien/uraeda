import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useRef, useState } from "react";
import type { QuestionItem } from "uraeda-binding";
import { CandidatesContext } from "./decisions/Candidates.tsx";
import { unsavedKey, useUnsavedOf } from "./fields/unsaved.ts";
import { Page } from "./layout/Page.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Band, followUpsOf, QuestionCards } from "./QuestionCards.tsx";
import { RoundOpening } from "./RoundOpening.tsx";
import { RoundColumn, useRoundActions } from "./RoundColumn.tsx";
import type { NavQuestion } from "./roundJump.ts";
import { RoundIndex } from "./RoundOutline.tsx";
import { useRoundNotes } from "./RoundNotes.tsx";
import { RoundEnd, useRoundSubmit } from "./RoundSubmit.tsx";
import { isDefaultRound, RoundHash, type RoundTarget, useHashes } from "./roundTarget.ts";
import { useRepositoryPath } from "./routes.tsx";
import { SettledPoints } from "./SettledPoints.tsx";
import { PendingSaves } from "./useAnswer.ts";
import { featureDraftKey, useDraft } from "./useDraft.ts";
import { useRoundPosition } from "./useRoundPosition.ts";
import { type useFile, useAgent } from "./data.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  measure: {
    // The round's reading text, a default-branch round's too, holds to the round's measure.
    "--size-reading-measure": "var(--size-round-measure)",
  },
});

/**
 * A round of questions on one page: its context, every question in full with its follow-ups, the
 * points settled without the human, the notes, and Submit. `target` is what it answers: a
 * feature's round, with its crumbs and its agent to ask, or a round on the default branch, the
 * inbox's triage or the decisions check, which has neither.
 */
export function RoundPage({ file, target }: { file: File; target: RoundTarget }) {
  const agent = useAgent();
  const round = file.current.items.clarifications;
  const document = file.current.document;
  const readOnly = file.status !== "awaiting-human";
  // What questions still have to save, which Submit saves first: one set for the page's life.
  const pending = useState(() => new Set<() => Promise<boolean>>())[0];
  // The text's hash as last read or written, which the page's saves keep up to date.
  const hash = useHashes(document.hash);
  const notes = useRoundNotes(file, target, hash);
  const submitting = useRoundSubmit(file, notes, pending, target, hash);
  const wide = !isNarrow(useWidthClass());
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
  const nav = navOf(questions);
  useRoundPosition(file.folder, file.name, nav);
  // The feature's session draft, kept while its column comes and goes and shared with the
  // session's page, for a feature whose agent can be asked.
  const draft = useDraft(featureDraftKey(repo, file.folder));
  const actions = useRoundActions(
    file,
    agent?.available && !isDefaultRound(target) ? draft : undefined,
  );
  if (!round) {
    return null;
  }

  const toEnd = () => toSubmit(end, submitRow);
  const content = (
    <RoundBody
      file={file}
      index={!readOnly && !wide && <RoundIndex questions={nav} />}
      readOnly={readOnly}
      target={target}
      {...(actions.asks ? { onAsk: actions.asks } : {})}
    >
      <RoundEnd
        blank={blank}
        end={end}
        file={file}
        notes={notes}
        notesShown={actions.notesShown}
        onEditNotes={actions.editNotes}
        readOnly={readOnly}
        submitRow={submitRow}
        submitting={submitting}
        target={target}
      />
    </RoundBody>
  );

  return (
    <RoundHash value={hash}>
      <CandidatesContext value={file.candidates}>
        <PendingSaves value={pending}>
          {readOnly ? (
            <Page isPaired isReading>{content}</Page>
          ) : (
            // While the round waits on answers, its column beside it.
            <RoundColumn
              actions={actions}
              content={<Page isPaired isReading>{content}</Page>}
              draft={actions.asks && draft}
              file={file}
              nav={nav}
              notes={notes}
              onSubmit={toEnd}
            />
          )}
        </PendingSaves>
      </CandidatesContext>
    </RoundHash>
  );
}

/**
 * The round's page itself: its opening, `index` after its block and its points to check after its
 * context, its questions, its other settled points, then `children`, its end. `onAsk` asks the
 * agent about a question, or sends a point's comment to it.
 */
function RoundBody({
  children,
  file,
  index,
  onAsk,
  readOnly,
  target,
}: {
  children: ReactNode;
  file: File;
  index: ReactNode;
  onAsk?: {
    point: (subject: string, text: string) => Promise<string | undefined>;
    question: (question: { id: string; title: string }) => void;
  };
  readOnly: boolean;
  target: RoundTarget;
}) {
  const wide = !isNarrow(useWidthClass());
  const round = file.current.items.clarifications;
  const document = file.current.document;
  if (!round) {
    return null;
  }
  const asks = onAsk ? { onAsk: onAsk.point } : {};
  // On the phone, a band before the settled points of the end, which a wide screen draws in panes.
  const ends = round.settledGroups.some((group) => group.kind !== "check" && group.points > 0);
  return (
    <div {...stylex.props(styles.measure)}>
      <RoundOpening
        check={<SettledPoints file={file} part="check" readOnly={readOnly} {...asks} />}
        document={document}
        round={round}
        {...(isDefaultRound(target) ? {} : { crumbs: { folder: file.folder, name: file.name } })}
      >
        {index}
      </RoundOpening>
      <QuestionCards
        document={document}
        path={file.path}
        questions={round.questions}
        readOnly={readOnly}
        takes={file.takesImages}
        target={target}
        {...(onAsk ? { onAsk: onAsk.question } : {})}
      />
      {!wide && ends && <Band />}
      <SettledPoints file={file} part="end" readOnly={readOnly} {...asks} />
      {children}
    </div>
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

/** The applicable questions in the page's order, each follow-up after its parent, by letter. */
function navOf(questions: ReadonlyArray<QuestionItem>): Array<NavQuestion> {
  return questions
    .flatMap((q) => (q.parent ? [] : [q, ...followUpsOf(questions, q.id)]))
    .map((q) => ({
      answered: q.answer.trim() !== "",
      id: q.id,
      level: q.parent ? 2 : 1,
      title: q.title,
    }));
}
