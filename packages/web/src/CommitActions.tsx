import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import type { ReactNode } from "react";
import { useAgent } from "./data.ts";

type Variant = "primary" | "secondary" | "destructive";

/**
 * The buttons of an action that commits and leads to an agent step: "Commit and continue" and
 * "Commit only" when the agent works on this machine, else the page's single button, as before.
 * `onCommit` commits, then starts the agent when `continues`. `children` lead the row.
 */
export function CommitActions({
  label,
  variant = "primary",
  isDisabled,
  tooltip,
  continueLabel = "Commit and continue",
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
