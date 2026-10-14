import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { CommitActions } from "./CommitActions.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { TextField } from "./fields/TextField.tsx";
import { statusStyles } from "./Question.tsx";
import { HookRefusal } from "./RoundSubmit.tsx";
import { handOver } from "./sessions.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

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
 * other refusal as a message. Resolves with whether the write was done.
 */
export function useRefusals() {
  const [error, setError] = useState<Refusal>();
  const [message, setMessage] = useState<{ ok: boolean; text: string }>();
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
  return { error, message, run, setMessage };
}

/**
 * The end of a review: its summary, a spec's risk tier and plan review, and the verdict, which
 * commits and may hand the feature over to the agent.
 */
// oxlint-disable-next-line max-lines-per-function -- over the limit before the code quality decision: the tier and plan review choices in a component
export function ReviewVerdict({
  comments,
  file,
  refusals: { error, hides, hold, message, run },
}: {
  /** How many comments are pending. */
  comments: number;
  file: File;
  refusals: Refusals;
}) {
  const fate = useFateClient();
  const spec = (file.committed ?? file.current).items.spec;
  const isSpec = file.kind === "spec";
  const [summary, setSummary] = useState("");
  const [tier, setTier] = useState(spec?.riskTier ?? spec?.tiers[0]?.value ?? "");
  const [planReview, setPlanReview] = useState<boolean>();
  // The verdict last committed to start the agent, for its Try again.
  const continues = useRef<"approval" | "changes">(undefined);

  /** Hands the feature over to the agent, once the verdict is committed. */
  const proceed = (trigger: "approval" | "changes") => handOver(file.folder, trigger, file.name);

  const verdict = async (approve: boolean, next: boolean) => {
    const input = { file: file.name, folder: file.folder, summary: summary || undefined };
    const trigger = approve ? "approval" : "changes";
    continues.current = next ? trigger : undefined;
    const done = await run(() =>
      approve
        ? fate.mutations.review.approve({
            input: {
              ...input,
              ...(isSpec && tier !== spec?.riskTier ? { tier } : {}),
              ...(isSpec && planReview !== undefined ? { planReview } : {}),
            },
            view: FileView,
          })
        : fate.mutations.review.requestChanges({ input, view: FileView }),
    );
    if (done && next) {
      proceed(trigger);
    }
  };

  // The plan review the core gives the tier picked, unless the human set it.
  const plannedReview =
    planReview ?? spec?.tiers.find((choice) => choice.value === tier)?.planReview ?? false;

  return (
    <>
      <TextField
        kind="comment"
        label="Summary"
        onChange={setSummary}
        placeholder="Optional"
        value={summary}
      />
      {isSpec && (
        <>
          <SegmentedControl
            label="Risk tier"
            onChange={(value: string) => setTier(value)}
            value={tier}
          >
            {spec?.tiers.map((choice) => (
              <SegmentedControlItem key={choice.value} label={choice.value} value={choice.value} />
            ))}
          </SegmentedControl>
          <Switch
            label="The plan waits for your review"
            onChange={(checked: boolean) => setPlanReview(checked)}
            value={plannedReview}
          />
        </>
      )}
      {error && (
        <HookRefusal
          error={error}
          onRetry={async () => {
            const done = await run(() =>
              fate.mutations.commit.retry({
                input: { file: file.name, folder: file.folder },
                view: FileView,
              }),
            );
            if (done && continues.current) {
              proceed(continues.current);
            }
          }}
          what="Your review is saved, not committed."
        />
      )}

      {file.committed && (
        <span {...stylex.props(statusStyles.error)}>
          {file.name} has changes not committed: the review is of the committed version. Commit or
          discard them first.
        </span>
      )}
      <CommitActions
        continueLabel="Request changes and start the agent"
        isDisabled={comments === 0 || file.committed != null}
        label="Request changes"
        onCommit={async (next) => (hold?.() ? undefined : verdict(false, next))}
        onlyLabel="Request changes only"
        tooltip={comments === 0 ? "Add a comment first" : undefined}
        variant="destructive"
      />
      <CommitActions
        continueLabel="Approve and start the agent"
        isDisabled={file.committed != null}
        label="Approve"
        onCommit={async (next) => (hold?.() ? undefined : verdict(true, next))}
        onlyLabel="Approve only"
      />
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
