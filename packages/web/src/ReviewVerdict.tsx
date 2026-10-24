import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { type Dispatch, type SetStateAction, useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { CommitActions } from "./CommitActions.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { RestoreNotice } from "./fields/RestoreNotice.tsx";
import { TextField } from "./fields/TextField.tsx";
import { useTextField } from "./fields/useTextField.ts";
import { statusStyles } from "./Question.tsx";
import { approveChoices, type Choices, ReviewChoices } from "./ReviewChoices.tsx";
import { HookRefusal } from "./RoundSubmit.tsx";
import { handOver } from "./sessions.ts";
import { FileView } from "./views.ts";

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

/** A review's summary, kept in the unsaved store until the verdict sends it. */
function SummaryField({ summary }: { summary: ReturnType<typeof useTextField> }) {
  return (
    <>
      {summary.restored && (
        <RestoreNotice changed="" onDiscard={summary.discard} restored={summary.restored} />
      )}
      <TextField
        kind="comment"
        label="Summary"
        onChange={summary.change}
        placeholder="Optional"
        value={summary.text}
      />
    </>
  );
}

/**
 * The verdict's buttons, Request changes and Approve, each committing, then starting the agent or
 * not; `onVerdict` resolves to whether the verdict was committed.
 */
export function Verdicts({
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
        continueLabel="Request changes, start the agent"
        folder={file.folder}
        isDisabled={comments === 0 || file.committed != null}
        label="Request changes"
        onCommit={(next) => onVerdict(false, next)}
        onlyLabel="Request changes only"
        tooltip={comments === 0 ? "Add a comment first" : undefined}
        variant="destructive"
      />
      <CommitActions
        continueLabel="Approve and start the agent"
        folder={file.folder}
        isDisabled={file.committed != null}
        label="Approve"
        onCommit={(next) => onVerdict(true, next)}
        onlyLabel="Approve only"
      />
    </>
  );
}

/** A spec's risk tier and plan review, as the review keeps them for the page's life. */
export type ChoicesState = [Choices, Dispatch<SetStateAction<Choices>>];

/**
 * A review's verdict, wherever its buttons are: `verdict(approve, next)` commits it with the
 * summary typed at the page's end and the `choices` set there, then hands the feature over to the
 * agent when `next`; `retry` commits again after a hook's refusal. Resolves to whether it was done.
 */
export function useVerdict(file: File, [choices]: ChoicesState, refusals: Refusals) {
  const fate = useFateClient();
  const spec = (file.committed ?? file.current).items.spec;
  const isSpec = file.kind === "spec";
  const where = { file: file.name, folder: file.folder };
  // Drawn by the page's end, read here: the summary another component draws.
  const summary = useTextField(`${file.path}#summary`, "", { drawn: false });

  /** Hands the feature over to the agent, once the verdict is committed. */
  const proceed = (trigger: "approval" | "changes") => handOver(file.folder, trigger, file.name);

  const verdict = async (approve: boolean, next: boolean) => {
    const sent = summary.unsavedNow()?.text ?? "";
    const input = { ...where, summary: sent || undefined };
    const trigger = approve ? "approval" : "changes";
    refusals.continues(next ? trigger : undefined);
    const done = await refusals.run(() =>
      approve
        ? fate.mutations.review.approve({
            input: { ...input, ...(isSpec ? approveChoices(spec, choices) : {}) },
            view: FileView,
          })
        : fate.mutations.review.requestChanges({ input, view: FileView }),
    );
    // The summary sent goes; text typed while the verdict was sent stays unsaved.
    if (done && summary.unsavedNow()?.text === sent) {
      summary.discard();
    }
    if (done && next) {
      proceed(trigger);
    }
    return done;
  };
  const retry = async () => {
    const done = await refusals.run(() =>
      fate.mutations.commit.retry({ input: where, view: FileView }),
    );
    const trigger = refusals.continued();
    if (done && trigger) {
      proceed(trigger);
    }
  };
  return { retry, verdict };
}

/**
 * What holds a verdict back, wherever its buttons are: a hook's refusal of its commit, with Try
 * again, `retry`, and changes to the file not committed.
 */
export function VerdictNotices({
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
      {error && (
        <HookRefusal error={error} onRetry={retry} what="Your review is saved, not committed." />
      )}
      {file.committed && (
        <span {...stylex.props(statusStyles.error)}>
          {file.name} has changes not committed: the review is of the committed version. Commit or
          discard them first.
        </span>
      )}
    </>
  );
}

/**
 * The end of a review: its summary, a spec's risk tier and plan review, and the verdict, which
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
  const summary = useTextField(`${file.path}#summary`, "");
  const { retry, verdict } = useVerdict(file, choices, refusals);
  return (
    <>
      <SummaryField summary={summary} />
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
        <span {...stylex.props(message.ok ? statusStyles.saved : statusStyles.error)}>
          {message.text}
        </span>
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
