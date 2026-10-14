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
  children,
  continueLabel = "Commit and start the agent",
  isDisabled,
  label,
  onCommit,
  onlyLabel = "Commit only",
  tooltip,
  variant = "primary",
}: {
  children?: ReactNode;
  continueLabel?: string;
  isDisabled?: boolean;
  label: string;
  onCommit: (continues: boolean) => Promise<void>;
  onlyLabel?: string;
  tooltip?: string;
  variant?: Variant;
}) {
  const agent = useAgent();
  if (!agent?.available) {
    return (
      <HStack gap={2} wrap="wrap">
        {children}
        <Button
          clickAction={() => onCommit(false)}
          isDisabled={isDisabled}
          label={label}
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
      <Button
        clickAction={() => onCommit(true)}
        isDisabled={isDisabled}
        label={continueLabel}
        tooltip={tooltip}
        variant={variant === "destructive" ? "destructive" : "primary"}
      />
      <Button
        clickAction={() => onCommit(false)}
        isDisabled={isDisabled}
        label={onlyLabel}
        tooltip={tooltip}
        variant="secondary"
      />
    </HStack>
  );
}
