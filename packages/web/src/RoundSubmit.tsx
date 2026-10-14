import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Collapsible } from "@astryxdesign/core/Collapsible";
import { Link } from "@astryxdesign/core/Link";
import { VStack } from "@astryxdesign/core/VStack";
import { typeScaleVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import type { QuestionItem } from "uraeda-binding";
import { CommitActions } from "./CommitActions.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { Paragraph } from "./layout/Paragraph.tsx";
import { statusStyles } from "./Question.tsx";
import { jumpTo } from "./RoundNav.tsx";
import { NotesField, type useRoundNotes } from "./RoundNotes.tsx";
import { handOver } from "./sessions.ts";
import { FileView } from "./views.ts";

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
 * A round's submit: what is still being typed is saved first, the notes and every save in
 * `pending`, and nothing is submitted unless it all is. `next` hands the feature over to the agent
 * once the round is committed; a hook's refusal is tried again with `retry`.
 */
export function useRoundSubmit(file: File, notes: Notes, pending: Set<() => Promise<boolean>>) {
  const fate = useFateClient();
  const [error, setError] = useState<Refusal>();
  // Whether the last commit asked to start the agent, for its Try again.
  const continues = useRef(false);

  /** Hands the feature over to the agent, once the round is committed. */
  const proceed = () => handOver(file.folder, "answers", file.name);
  const submit = async (next: boolean) => {
    setError(undefined);
    continues.current = next;
    const saved = await Promise.all([...[...pending].map((flush) => flush()), notes.flush()]);
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
  pending,
  readOnly,
  submitRow,
}: {
  blank: ReadonlyArray<QuestionItem>;
  end: RefObject<HTMLDivElement | null>;
  file: File;
  notes: Notes;
  pending: Set<() => Promise<boolean>>;
  readOnly: boolean;
  submitRow: RefObject<HTMLDivElement | null>;
}) {
  const { error, retry, submit } = useRoundSubmit(file, notes, pending);
  if (readOnly) {
    return (
      notes.text && (
        <Paragraph>
          <strong>Notes:</strong> {notes.text}
        </Paragraph>
      )
    );
  }
  return (
    <VStack gap={3} ref={end}>
      <NotesField notes={notes} path={file.path} />
      {blank.length > 0 && <QuestionsLeft blank={blank} />}
      {error?.kind === "hook" ? (
        <HookRefusal error={error} onRetry={retry} what="Your answers are saved, not committed." />
      ) : (
        error && <span {...stylex.props(statusStyles.error)}>{error.message}</span>
      )}
      <div ref={submitRow}>
        <CommitActions isDisabled={blank.length > 0} label="Submit answers" onCommit={submit} />
      </div>
    </VStack>
  );
}
