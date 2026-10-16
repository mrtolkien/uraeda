import { HStack } from "@astryxdesign/core/HStack";
import type { ReactNode } from "react";
import { useAgent } from "./data.ts";
import { WriteButton } from "./writes/WriteButton.tsx";

type Variant = "primary" | "secondary" | "destructive";

/**
 * The buttons of an action that commits and leads to an agent step: "Commit and start the agent"
 * and "Commit only" when the agent works on this machine, else the page's single button, as
 * before. `onCommit` commits, then hands the feature over to the agent when `continues`: its
 * session opens with the workflow's message; it resolves to `false` when nothing was committed.
 * While one commits, it reads "Committing…", the others are blocked, and the card of `folder`, the
 * feature it commits to, says the same. `children` lead the row.
 */
export function CommitActions({
  children,
  continueLabel = "Commit and start the agent",
  folder,
  isDisabled,
  label,
  onCommit,
  onlyLabel = "Commit only",
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
  onlyLabel?: string;
  /** What the clicked button reads while it runs. */
  runningLabel?: string;
  tooltip?: string;
  variant?: Variant;
}) {
  const agent = useAgent();
  if (!agent?.available) {
    return (
      <HStack gap={2} wrap="wrap">
        {children}
        <WriteButton
          folder={folder}
          isDisabled={isDisabled}
          label={label}
          onClick={() => onCommit(false)}
          runningLabel={runningLabel}
          tooltip={tooltip}
          variant={variant}
        />
      </HStack>
    );
  }
  return (
    // A long label takes its own line rather than being cut.
    <HStack gap={2} wrap="wrap">
      {children}
      <WriteButton
        folder={folder}
        isDisabled={isDisabled}
        label={continueLabel}
        onClick={() => onCommit(true)}
        runningLabel={runningLabel}
        tooltip={tooltip}
        variant={variant === "destructive" ? "destructive" : "primary"}
      />
      <WriteButton
        folder={folder}
        isDisabled={isDisabled}
        label={onlyLabel}
        onClick={() => onCommit(false)}
        runningLabel={runningLabel}
        tooltip={tooltip}
        variant="secondary"
      />
    </HStack>
  );
}
