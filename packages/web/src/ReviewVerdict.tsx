import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import * as stylex from "@stylexjs/stylex";
import { useRef, useState } from "react";
import { useFateClient } from "react-fate";
import { CommitActions } from "./CommitActions.tsx";
import type { useFile } from "./data.ts";
import { type Refusal, refusal } from "./errors.ts";
import { GrowingTextArea, statusStyles } from "./Question.tsx";
import { HookRefusal } from "./RoundPage.tsx";
import { handOver } from "./sessions.ts";
import { FileView } from "./views.ts";

type File = NonNullable<ReturnType<typeof useFile>>;

/** What a review's last write left to show: a hook's refusal, or a message. */
export type Refusals = ReturnType<typeof useRefusals>;

/**
 * Runs a review's writes, one result shown at a time: a hook's refusal, with its output, or any
 * other refusal as a message. Resolves with whether the write was done.
 */
export function useRefusals() {
  const [error, setError] = useState<Refusal>();
  const [message, setMessage] = useState<{ text: string; ok: boolean }>();
  const run = async (call: () => Promise<{ error?: unknown }>) => {
    setError(undefined);
    setMessage(undefined);
    const result = await call();
    if (result.error) {
      const failed = refusal(result.error);
      if (failed.kind === "hook") {
        setError(failed);
      } else {
        setMessage({ text: failed.message, ok: false });
      }
      return false;
    }
    return true;
  };
  return { error, message, run };
}

/**
 * The end of a review: its summary, a spec's risk tier and plan review, and the verdict, which
 * commits and may hand the feature over to the agent.
 */
export function ReviewVerdict({
  file,
  comments,
  refusals: { error, message, run },
}: {
  file: File;
  /** How many comments are pending. */
  comments: number;
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
    const input = { folder: file.folder, file: file.name, summary: summary || undefined };
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
      <GrowingTextArea
        label="Summary"
        value={summary}
        onChange={setSummary}
        placeholder="Optional"
      />
      {isSpec && (
        <>
          <SegmentedControl
            label="Risk tier"
            value={tier}
            onChange={(value: string) => setTier(value)}
          >
            {spec?.tiers.map((choice) => (
              <SegmentedControlItem key={choice.value} value={choice.value} label={choice.value} />
            ))}
          </SegmentedControl>
          <Switch
            label="The plan waits for your review"
            value={plannedReview}
            onChange={(checked: boolean) => setPlanReview(checked)}
          />
        </>
      )}
      {error && (
        <HookRefusal
          error={error}
          what="Your review is saved, not committed."
          onRetry={async () => {
            const done = await run(() =>
              fate.mutations.commit.retry({
                input: { folder: file.folder, file: file.name },
                view: FileView,
              }),
            );
            if (done && continues.current) {
              proceed(continues.current);
            }
          }}
        />
      )}

      {file.committed && (
        <span {...stylex.props(statusStyles.error)}>
          {file.name} has changes not committed: the review is of the committed version. Commit or
          discard them first.
        </span>
      )}
      <CommitActions
        label="Request changes"
        variant="destructive"
        continueLabel="Request changes and start the agent"
        onlyLabel="Request changes only"
        isDisabled={comments === 0 || file.committed != null}
        tooltip={comments === 0 ? "Add a comment first" : undefined}
        onCommit={(next) => verdict(false, next)}
      />
      <CommitActions
        label="Approve"
        continueLabel="Approve and start the agent"
        onlyLabel="Approve only"
        isDisabled={file.committed != null}
        onCommit={(next) => verdict(true, next)}
      />
      {message && (
        <span {...stylex.props(message.ok ? statusStyles.saved : statusStyles.error)}>
          {message.text}
        </span>
      )}
      {comments === 0 && (
        <Text type="supporting" color="secondary">
          Request changes: Add a comment first
        </Text>
      )}
    </>
  );
}
