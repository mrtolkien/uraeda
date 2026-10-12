import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { useEffect, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { Blocks } from "./Blocks.tsx";
import { CommitActions } from "./CommitActions.tsx";
import { type Refusal, refusal } from "./errors.ts";
import { GrowingTextArea, PendingSaves, Question } from "./Question.tsx";
import { startRun, type Started } from "./runs.ts";
import { plain } from "./Spans.tsx";
import { useSave } from "./useSave.ts";
import { FileView } from "./views.ts";
import type { useFile } from "./data.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** A hook's refusal: the answers are saved, the commit is not, and it can be tried again. */
export function HookRefusal({
  error,
  what,
  onRetry,
}: {
  error: Refusal;
  what: string;
  onRetry: () => Promise<void>;
}) {
  return (
    <Banner
      status="error"
      title={`The pre-commit hook refused the commit. ${what}`}
      endContent={<Button label="Try again" clickAction={onRetry} />}
      collapsible={false}
    >
      <Collapsible trigger="Hook output">
        <pre className="mono" style={{ whiteSpace: "pre-wrap" }}>
          {error.output ?? error.message}
        </pre>
      </Collapsible>
    </Banner>
  );
}

/**
 * A round of questions on one page: its context, every question in full with its follow-ups, the
 * points settled without the human, the notes, and Submit.
 */
export function RoundPage({ file }: { file: File }) {
  const fate = useFateClient();
  const round = file.current.items.clarifications;
  const document = file.current.document;
  const readOnly = file.status !== "awaiting-human";
  const [notes, setNotes] = useState(round?.notes ?? "");
  const [error, setError] = useState<Refusal>();
  // Whether the last commit asked to continue, for its Try again.
  const continues = useRef(false);
  const [started, setStarted] = useState<Started>();
  const pending = useRef(new Set<() => Promise<boolean>>()).current;
  const notesSave = useSave<string>(async (value, previous) => {
    const result = await fate.mutations.notes.save({
      input: { folder: file.folder, notes: value, previous },
      view: FileView,
    });
    if (result.error) {
      return { ok: false, message: refusal(result.error).message };
    }
    return { ok: true, saved: result.result?.current.items.clarifications?.notes ?? value };
  }, round?.notes ?? "");
  const { settle, idle } = notesSave;
  const shownNotes = useRef(notes);
  shownNotes.current = notes;
  // Notes changed elsewhere replace these when nothing of them waits to be saved.
  useEffect(() => {
    const read = round?.notes ?? "";
    if (idle() && read !== shownNotes.current) {
      setNotes(read);
    }
    settle(read);
  }, [round?.notes, idle, settle]);
  if (!round) {
    return null;
  }
  const questions = round.questions;
  // A follow-up shows once its parent's answer makes it apply: with its letter, or with no
  // letter at all, when it needs an answer, `-` if it does not apply.
  const answers = new Map(questions.map((q) => [q.id, q.answer.trim()]));
  const shown = (q: (typeof questions)[number]) =>
    q.applies === "yes"
      ? !q.parent || answers.get(q.parent) !== ""
      : q.applies === "unclear" && answers.get(q.parent ?? "") !== "";
  const applicable = questions.filter(shown);
  const blank = applicable.filter((q) => !q.answer.trim());
  const title = document.blocks.find((b) => b.kind === "heading" && b.level === 1);

  /** Starts the agent on the next step, once the round is committed. */
  const proceed = async () => {
    setStarted(await startRun(fate, { folder: file.folder, trigger: "answers", file: file.name }));
  };
  const submit = async (next: boolean) => {
    setError(undefined);
    setStarted(undefined);
    continues.current = next;
    // What is still being typed is saved first, and nothing is submitted unless it all is.
    const saved = await Promise.all([...[...pending].map((flush) => flush()), notesSave.flush()]);
    if (!saved.every(Boolean)) {
      setError({
        kind: "refused",
        message:
          "Some answers were not saved: nothing was submitted. Check them, then submit again.",
      });
      return;
    }
    const result = await fate.mutations.answers.submit({
      input: { folder: file.folder },
      view: FileView,
    });
    if (result.error) {
      setError(refusal(result.error));
    } else if (next) {
      await proceed();
    }
  };
  const retry = async () => {
    const result = await fate.mutations.commit.retry({
      input: { folder: file.folder, file: file.name },
      view: FileView,
    });
    setError(result.error ? refusal(result.error) : undefined);
    if (!result.error && continues.current) {
      await proceed();
    }
  };

  return (
    <PendingSaves value={pending}>
      <div className="page">
        {!readOnly && applicable.length > 0 && (
          <div
            className="progress"
            role="progressbar"
            aria-valuenow={applicable.length - blank.length}
            aria-valuemax={applicable.length}
          >
            <div
              style={{
                width: `${((applicable.length - blank.length) / applicable.length) * 100}%`,
              }}
            />
          </div>
        )}
        <p className="small muted">
          {applicable.length - blank.length} of {applicable.length} answered
        </p>
        {title && <h1 className="title-l">{plain(title.spans)}</h1>}
        {round.block !== undefined && <Blocks document={document} ids={[round.block]} />}
        <Blocks document={document} ids={round.context} />
        {questions
          .filter((q) => !q.parent)
          .map((question) => (
            <div key={question.id}>
              <div className="band" />
              <Question
                folder={file.folder}
                question={question}
                followUps={questions.filter((q) => q.parent === question.id && shown(q))}
                document={document}
                readOnly={readOnly}
              />
            </div>
          ))}
        <div className="band" />
        {round.settled.length > 0 && (
          <>
            <div className="label">Settled without you</div>
            <Blocks document={document} ids={round.settled} />
          </>
        )}
        {readOnly ? (
          notes && (
            <p>
              <strong>Notes:</strong> {notes}
            </p>
          )
        ) : (
          <>
            <GrowingTextArea
              label="Notes"
              value={notes}
              onChange={(value) => {
                setNotes(value);
                notesSave.schedule(value);
              }}
            />
            {notesSave.state.kind === "error" && (
              <p className="not-saved">Not saved: {notesSave.state.message}</p>
            )}
            {blank.length > 0 && (
              <div style={{ margin: "14px 0" }}>
                <Banner
                  status="error"
                  title={
                    <>
                      {blank.length} {blank.length === 1 ? "question" : "questions"} left:{" "}
                      {blank.map((q, index) => (
                        <span key={q.id}>
                          {index > 0 && ", "}
                          <a href={`#${q.id}`}>{q.id}</a>
                        </span>
                      ))}
                    </>
                  }
                />
              </div>
            )}
            {error?.kind === "hook" ? (
              <HookRefusal
                error={error}
                what="Your answers are saved, not committed."
                onRetry={retry}
              />
            ) : (
              error && <p className="not-saved">{error.message}</p>
            )}
            <CommitActions label="Submit answers" isDisabled={blank.length > 0} onCommit={submit} />
          </>
        )}
        {started && <p className={started.ok ? "saved" : "not-saved"}>{started.message}</p>}
      </div>
    </PendingSaves>
  );
}
