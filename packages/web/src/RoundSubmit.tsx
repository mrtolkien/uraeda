import { Banner } from "@astryxdesign/core/Banner";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { typeScaleVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useRef, useState } from "react";
import type { QuestionItem } from "uraeda-binding";
import { CommitActions } from "./CommitActions.tsx";
import { WriteButton } from "./writes/WriteButton.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { Paragraph } from "./layout/Paragraph.tsx";
import { statusStyles } from "./Question.tsx";
import { jumpTo } from "./RoundNav.tsx";
import { NOTES_CHANGED, NotesField, type useRoundNotes } from "./RoundNotes.tsx";
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

type File = NonNullable<ReturnType<typeof useFile>>;
type Notes = ReturnType<typeof useRoundNotes>;

const styles = stylex.create({
  output: {
    fontFamily: typographyVars["--font-family-code"],
    fontSize: typeScaleVars["--text-code-size"],
    margin: 0,
    whiteSpace: "pre-wrap",
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
      endContent={<WriteButton label="Try again" onClick={onRetry} />}
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
  );
}

/**
 * The end of a round's page: its notes, read-only once submitted; else the notes' field, the
 * questions left, the submit's error, and Submit. `end` holds it all, `submitRow` Submit's buttons,
 * which the bar's Submit scrolls to and focuses.
 */
export function RoundEnd({
  blank,
  end,
  file,
  notes,
  readOnly,
  submitRow,
  submitting,
  target,
}: {
  blank: ReadonlyArray<QuestionItem>;
  end: RefObject<HTMLDivElement | null>;
  file: File;
  notes: Notes;
  readOnly: boolean;
  submitRow: RefObject<HTMLDivElement | null>;
  /** The page's submit, kept by the page: its refusal stays once the round reads as answered. */
  submitting: ReturnType<typeof useRoundSubmit>;
  target: RoundTarget;
}) {
  const { error, retry, submit } = submitting;
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
    <VStack gap={3} ref={end}>
      <NotesField notes={notes} path={file.path} takes={file.takesImages} />
      {blank.length > 0 && <QuestionsLeft blank={blank} />}
      {refused || (error && <span {...stylex.props(statusStyles.error)}>{error.message}</span>)}
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
            label="Submit answers"
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
