import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import type { ReactNode } from "react";
import { useAgent } from "./data.ts";

type Variant = "primary" | "secondary" | "destructive";

/**
 * The buttons of an action that commits and leads to an agent step: "Commit and start the agent"
 * and "Commit only" when the agent works on this machine, else the page's single button, as
 * before. `onCommit` commits, then hands the feature over to the agent when `continues`: its
 * session opens with the workflow's message. `children` lead the row.
 */
export function CommitActions({
  label,
  variant = "primary",
  isDisabled,
  tooltip,
  continueLabel = "Commit and start the agent",
  onlyLabel = "Commit only",
  onCommit,
  children,
}: {
  label: string;
  variant?: Variant;
  isDisabled?: boolean;
  tooltip?: string;
  continueLabel?: string;
  onlyLabel?: string;
  onCommit: (continues: boolean) => Promise<void>;
  children?: ReactNode;
}) {
  const agent = useAgent();
  if (!agent?.available) {
    return (
      <HStack gap={2} wrap="wrap">
        {children}
        <Button
          variant={variant}
          label={label}
          isDisabled={isDisabled}
          tooltip={tooltip}
          clickAction={() => onCommit(false)}
        />
      </HStack>
    );
  }
  return (
    // A long label takes its own line rather than being cut.
    <HStack gap={2} wrap="wrap">
      {children}
      <Button
        variant={variant === "destructive" ? "destructive" : "primary"}
        label={continueLabel}
        isDisabled={isDisabled}
        tooltip={tooltip}
        clickAction={() => onCommit(true)}
      />
      <Button
        variant="secondary"
        label={onlyLabel}
        isDisabled={isDisabled}
        tooltip={tooltip}
        clickAction={() => onCommit(false)}
      />
    </HStack>
  );
}
