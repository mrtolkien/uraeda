import { HStack } from "@astryxdesign/core/HStack";
import type { ReactNode } from "react";
import { useAgent } from "./data.ts";
import { WriteButton } from "./writes/WriteButton.tsx";

type Variant = "primary" | "secondary" | "destructive";

/**
 * The button of an action that commits and leads to an agent step, the page's single button,
 * `label`: when the agent works on this machine, `onCommit` commits, then hands the feature over to
 * the agent, its session opened with the workflow's message in its composer, unsent, for the human
 * to send or not; it resolves to `false` when nothing was committed. While one commits, it reads
 * "Committing…", the others are blocked, and the card of `folder`, the feature it commits to, says
 * the same. `children` lead the row. `resume` adds the primary button of an answer that continues
 * the work in progress, reading as `resume.label`: the page's button then turns secondary, as the
 * way back, and reads as `continueLabel`.
 */
export function CommitActions({
  children,
  continueLabel,
  folder,
  isDisabled,
  label,
  onCommit,
  resume,
  runningLabel = "Committing…",
  tooltip,
  variant = "primary",
}: {
  children?: ReactNode;
  continueLabel?: string;
  folder?: string | undefined;
  isDisabled?: boolean;
  label: string;
  onCommit: (continues: boolean) => Promise<unknown>;
  resume?: { label: string; onCommit: () => Promise<unknown> };
  /** What the clicked button reads while it runs. */
  runningLabel?: string;
  tooltip?: string;
  variant?: Variant;
}) {
  const agent = useAgent();
  const continues = agent?.available === true;
  const resumes = continues && resume !== undefined;
  return (
    // A long label takes its own line rather than being cut.
    <HStack gap={2} wrap="wrap">
      {children}
      {resumes && (
        <WriteButton
          folder={folder}
          isDisabled={isDisabled}
          label={resume.label}
          onClick={resume.onCommit}
          runningLabel={runningLabel}
          tooltip={tooltip}
          variant="primary"
        />
      )}
      <WriteButton
        folder={folder}
        isDisabled={isDisabled}
        label={resumes ? (continueLabel ?? label) : label}
        onClick={() => onCommit(continues)}
        runningLabel={runningLabel}
        tooltip={tooltip}
        variant={resumes ? "secondary" : variant}
      />
    </HStack>
  );
}
