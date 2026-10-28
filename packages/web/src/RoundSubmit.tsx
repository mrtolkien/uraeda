import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { CodeBlock } from "@astryxdesign/core/CodeBlock";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { type RefObject, useRef, useState } from "react";
import type { QuestionItem } from "uraeda-binding";
import { CommitActions } from "./CommitActions.tsx";
import { WriteButton } from "./writes/WriteButton.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { StatusText } from "./fields/StatusText.tsx";
import { jumpTo } from "./roundJump.ts";
import { NOTES_CHANGED, NotesRead, type useRoundNotes } from "./RoundNotes.tsx";
import { PART_IDS } from "./roundPartIds.ts";
import { useScrollMargin } from "./layout/scrollMargin.ts";
import {
  defaultRoundHome,
  type Hashes,
  isDefaultRound,
  type RoundTarget,
  useRoundWrites,
} from "./roundTarget.ts";
import { navigateHere } from "./routes.tsx";
import { handOver } from "./sessions.ts";
import { useSaveSettled } from "./settledWrites.ts";
import { plural } from "./labels.ts";
import { Foldable } from "./layout/Foldable.tsx";

type File = NonNullable<ReturnType<typeof useFile>>;
type Notes = ReturnType<typeof useRoundNotes>;

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
    <AnnouncedBanner
      collapsible={false}
      endContent={<WriteButton label="Try again" onClick={onRetry} />}
      status="error"
      title={`The pre-commit hook refused the commit. ${what}`}
    >
      <Foldable label="Hook output">
        <CodeBlock code={error.output ?? error.message} isWrapped size="sm" width="100%" />
      </Foldable>
    </AnnouncedBanner>
  );
}

/**
 * A round's submit: what is still being typed is saved first, the notes, every save in `pending`,
 * then the settled points' comments, and nothing is submitted unless it all is. `next` hands the
 * feature over to the agent once the round is committed; a hook's refusal is tried again with
 * `retry`. A default-branch round, submitted, goes back to the page that offers to apply it.
 */
export function useRoundSubmit(
  file: File,
  notes: Notes,
  pending: Set<() => Promise<boolean>>,
  target: RoundTarget,
  hashes: Hashes,
) {
  const saveSettled = useSaveSettled(file);
  const writes = useRoundWrites(target, hashes);
  const [error, setError] = useState<Refusal>();
  // Whether the last commit asked to start the agent, for its Try again.
  const continues = useRef(false);

  /** Hands the feature over to the agent, once the round is committed. */
  const proceed = () => handOver(file.folder, "answers", file.name);
  const submit = async (next: boolean, resumes = false) => {
    setError(undefined);
    continues.current = next;
    const saved = await Promise.all([...[...pending].map((flush) => flush()), notes.flush()]);
    if (!saved.every(Boolean) || !(await saveSettled())) {
      setError({
        kind: "refused",
        message:
          "Some answers were not saved: nothing was submitted. Check them, then submit again.",
      });
      return false;
    }
    const result = await writes.submit(file.name, resumes);
    if (result.error) {
      setError(refusal(result.error));
      return false;
    }
    if (isDefaultRound(target)) {
      navigateHere(defaultRoundHome(target));
    } else if (next) {
      proceed();
    }
    return true;
  };
  const retry = async () => {
    const result = await writes.retry(file.name);
    setError(result.error ? refusal(result.error) : undefined);
    if (result.error) {
      return;
    }
    if (isDefaultRound(target)) {
      navigateHere(defaultRoundHome(target));
    } else if (continues.current) {
      proceed();
    }
  };
  return { error, retry, submit };
}

/** The questions left blank, each a link that jumps to it. */
function QuestionsLeft({ blank }: { blank: ReadonlyArray<QuestionItem> }) {
  return (
    <AnnouncedBanner
      status="error"
      title={
        <>
          {plural(blank.length, "question")} left:{" "}
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
  );
}

/**
 * The end of a round's page: its notes, read-only once submitted; else the notes as typed, with
 * "Edit notes", which `onEditNotes` opens their field for, the questions left, the submit's error,
 * and Submit, all under `id="notes"`. `end` holds it all, `submitRow` Submit's buttons, which the
 * bar's Submit scrolls to and focuses.
 */
export function RoundEnd({
  blank,
  end,
  file,
  notes,
  notesShown,
  onEditNotes,
  readOnly,
  submitRow,
  submitting,
  target,
}: {
  blank: ReadonlyArray<QuestionItem>;
  end: RefObject<HTMLDivElement | null>;
  file: File;
  notes: Notes;
  /** Whether the notes' field is drawn, in the column's Notes tab or the phone's sheet. */
  notesShown: boolean;
  onEditNotes: () => void;
  readOnly: boolean;
  submitRow: RefObject<HTMLDivElement | null>;
  /** The page's submit, kept by the page: its refusal stays once the round reads as answered. */
  submitting: ReturnType<typeof useRoundSubmit>;
  target: RoundTarget;
}) {
  const { error, retry, submit } = submitting;
  const margin = useScrollMargin();
  const refused = error?.kind === "hook" && (
    <HookRefusal error={error} onRetry={retry} what="Your answers are saved, not committed." />
  );
  if (readOnly) {
    const unsaved = notes.field.entry;
    // The refused round reads as answered: its refusal stays, with Try again.
    return (
      <>
        {refused}
        {unsaved && (
          <RestoreNotice
            answered
            changed={NOTES_CHANGED}
            onDiscard={notes.field.discard}
            restored={{ at: unsaved.at, changed: false }}
          />
        )}
        {notes.read && (
          <Paragraph>
            <strong>Notes:</strong> {notes.read}
          </Paragraph>
        )}
      </>
    );
  }
  return (
    <VStack gap={3} id={PART_IDS.notes} ref={end} xstyle={margin}>
      <NotesRead fieldShown={notesShown} notes={notes} onEdit={onEditNotes} />
      {blank.length > 0 && <QuestionsLeft blank={blank} />}
      {refused || (error && <StatusText tone="error">{error.message}</StatusText>)}
      <div ref={submitRow}>
        {isDefaultRound(target) ? (
          // A default-branch round hands nothing over: its page offers to apply it.
          <WriteButton
            isDisabled={blank.length > 0}
            label="Submit answers"
            onClick={() => submit(false)}
            variant="primary"
          />
        ) : (
          <CommitActions
            folder={file.folder}
            isDisabled={blank.length > 0}
            label="Commit"
            onCommit={submit}
            // A round asked during the implementation may continue it, the spec as approved.
            {...(file.resumable
              ? {
                  continueLabel: "Answer and revise the spec",
                  resume: {
                    label: "Answer and continue implementing",
                    onCommit: () => submit(true, true),
                  },
                }
              : {})}
          />
        )}
      </div>
    </VStack>
  );
}
