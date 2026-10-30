import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { CommitActions } from "./CommitActions.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { StatusText } from "./fields/StatusText.tsx";
import { approveChoices, type Choices, ReviewChoices } from "./ReviewChoices.tsx";
import { HookRefusal } from "./RoundSubmit.tsx";
import { handOver } from "./sessions.ts";
import { FileView } from "./views.ts";
import { kindName, useFeatureTitle } from "./writes/labels.ts";
import { RefusedHere } from "./writes/RefusedHere.tsx";
import { useClearRefusal, writeHere } from "./writes/useWriteQueue.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

const styles = stylex.create({
  // The verdict's buttons stay the page's rows: their holder draws no box.
  contents: { display: "contents" },
});

/**
 * What a review's last write left to show: a hook's refusal, or a message; and, from its comment's
 * images, what holds a verdict and which message goes once they are in.
 */
export type Refusals = ReturnType<typeof useRefusals> & {
  hides?: (message: { text: string }) => boolean;
  hold?: () => boolean;
};

/**
 * Runs a review's writes, one result shown at a time: a hook's refusal, with its output, or any
 * other refusal as a message. Resolves with whether the write was done. `continues` keeps the
 * verdict last committed to start the agent, and `continued` reads it, once for the page, so a Try
 * again anywhere starts it.
 */
export function useRefusals() {
  const [error, setError] = useState<Refusal>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
  const last = useRef<"approval" | "changes">(undefined);
  const continues = (trigger: "approval" | "changes" | undefined) => {
    last.current = trigger;
  };
  const continued = () => last.current;
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setError(undefined);
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "hook") {
        setError(failed);
      } else {
        setMessage({ ok: false, text: failed.message });
      }
      return false;
    }
    return true;
  };
  return { continued, continues, error, message, run, setMessage };
}

/**
 * The verdict's buttons, Request changes and Approve, each committing, then opening the session
 * with the workflow's message, unsent, when the agent works on this machine; `onVerdict` resolves to
 * whether the verdict was committed.
 */
function Verdicts({
  comments,
  file,
  onVerdict,
}: {
  comments: number;
  file: File;
  onVerdict: (approve: boolean, next: boolean) => Promise<boolean>;
}) {
  return (
    <>
      <CommitActions
        isDisabled={comments === 0 || file.committed != null}
        label="Request changes"
        onCommit={(next) => onVerdict(false, next)}
        tooltip={comments === 0 ? "Add a comment first" : undefined}
        variant="destructive"
      />
      <CommitActions
        isDisabled={file.committed != null}
        label="Approve"
        onCommit={(next) => onVerdict(true, next)}
      />
    </>
  );
}

/** A spec's risk tier and plan review, as the review keeps them for the page's life. */
export type ChoicesState = [Choices, Dispatch<SetStateAction<Choices>>];

/**
 * A review's verdict, wherever its buttons are: `verdict(approve, next)` commits it with the
 * `choices` set at the page's end, then hands the feature over to the agent when `next`; `retry` commits again after a hook's refusal. Resolves to whether it was done.
 */
function useVerdict(file: File, [choices]: ChoicesState, refusals: Refusals) {
  const fate = useFateClient();
  const spec = (file.committed ?? file.current).items.spec;
  const isSpec = file.kind === "spec";
  const where = { file: file.name, folder: file.folder };
  const clearRefusal = useClearRefusal(where);
  const subject = `the ${kindName(file.kind)} of ${useFeatureTitle(file.folder)}`;

  /** Hands the feature over to the agent, once the verdict is committed. */
  const proceed = (trigger: "approval" | "changes") => handOver(file.folder, trigger, file.name);

  const verdict = async (approve: boolean, next: boolean) => {
    // No summary: what the human says beyond the verdict is a general comment.
    const input = where;
    const trigger = approve ? "approval" : "changes";
    refusals.continues(next ? trigger : undefined);
    clearRefusal();
    const done = await refusals.run(() =>
      approve
        ? fate.mutations.review.approve({
            input: {
              ...input,
              ...(isSpec ? approveChoices(spec, choices) : {}),
              write: writeHere(`Approving ${subject}`),
            },
            view: FileView,
          })
        : fate.mutations.review.requestChanges({
            input: { ...input, write: writeHere(`Requesting changes to ${subject}`) },
            view: FileView,
          }),
    );
    if (done && next) {
      proceed(trigger);
    }
    return done;
  };
  const retry = async () => {
    const done = await refusals.run(() =>
      fate.mutations.commit.retry({
        input: { ...where, write: writeHere(`Committing the review of ${subject}`) },
        view: FileView,
      }),
    );
    const trigger = refusals.continued();
    if (done && trigger) {
      proceed(trigger);
    }
  };
  return { retry, verdict };
}

/**
 * What holds a verdict back, wherever its buttons are: a hook's refusal of its commit as the queue
 * landed it, the verdict undone; one that left the review written, with Try again, `retry`; and
 * changes to the file not committed.
 */
function VerdictNotices({
  error,
  file,
  retry,
}: {
  error: Refusal | undefined;
  file: File;
  retry: () => Promise<void>;
}) {
  return (
    <>
      <RefusedHere
        what={`the ${kindName(file.kind)} awaits your verdict again.`}
        where={{ file: file.name, folder: file.folder }}
      />
      {error && (
        <HookRefusal error={error} onRetry={retry} what="Your review is saved, not committed." />
      )}
      {file.committed && (
        <StatusText tone="error">
          {file.name} has changes not committed: the review is of the committed version. Commit or
          discard them first.
        </StatusText>
      )}
    </>
  );
}

/**
 * The end of a review: a spec's risk tier and plan review, and the verdict, which
 * commits and may hand the feature over to the agent. `choices` are the review's, which the Review
 * tab's buttons commit too.
 */
export function ReviewVerdict({
  choices,
  comments,
  file,
  refusals,
}: {
  choices: ChoicesState;
  /** How many comments are pending. */
  comments: number;
  file: File;
  refusals: Refusals;
}) {
  const { error, hides, hold, message } = refusals;
  const spec = (file.committed ?? file.current).items.spec;
  const { retry, verdict } = useVerdict(file, choices, refusals);
  return (
    <>
      {file.kind === "spec" && (
        <ReviewChoices choices={choices[0]} onChange={choices[1]} spec={spec} />
      )}
      <VerdictNotices error={error} file={file} retry={retry} />
      <div id={VERDICT_ID} {...stylex.props(styles.contents)}>
        <Verdicts
          comments={comments}
          file={file}
          onVerdict={async (approve, next) => (hold?.() ? false : verdict(approve, next))}
        />
      </div>
      {message && !hides?.(message) && (
        <StatusText tone={message.ok ? "saved" : "error"}>{message.text}</StatusText>
      )}
      {comments === 0 && (
        <Text color="secondary" type="supporting">
          Request changes: Add a comment first
        </Text>
      )}
    </>
  );
}

/**
 * The element holding the page's end's verdict buttons, which "Verdict" brings into view: its colon,
 * which no heading's anchor holds, keeps it apart from them.
 */
export const VERDICT_ID = "review:verdict";

/**
 * Brings the page's end's verdict into view, its first button that can be pressed focused, not one
 * disabled, or inert behind its tooltip. Its element has no box of its own: its button is scrolled
 * to.
 */
export function toVerdict() {
  const button = document
    .getElementById(VERDICT_ID)
    ?.querySelector<HTMLButtonElement>("button:not([disabled], [aria-disabled='true'])");
  button?.scrollIntoView?.({ block: "center" });
  button?.focus({ preventScroll: true });
}
