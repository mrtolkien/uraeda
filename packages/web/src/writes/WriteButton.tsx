// A button that writes to git: once clicked, it reads what it does, with a spinner, until the
// write ends, and every other one is blocked meanwhile; the item it writes to shows the same on its
// card. Its action resolves to `false` when it failed, which shows the card's status again.
import type { ReactNode } from "react";
import { useOwnWrite } from "./useOwnWrite.ts";
import { type Variant, WriteButtonView } from "./WriteFeedback.tsx";

export function WriteButton({
  endContent,
  folder,
  isDisabled = false,
  label,
  onClick,
  runningLabel = "Committing…",
  tooltip,
  variant,
}: {
  /** What shows after its label, but while it runs: its key. */
  endContent?: ReactNode;
  /** The feature or change it writes to, whose card shows `runningLabel`. */
  folder?: string | undefined;
  isDisabled?: boolean | undefined;
  label: string;
  onClick: () => Promise<unknown>;
  runningLabel?: string;
  tooltip?: string | undefined;
  variant?: Variant | undefined;
}) {
  const { start, state } = useOwnWrite({
    label: runningLabel,
    ...(folder === undefined ? {} : { folder }),
  });
  const click = () => {
    if (!isDisabled) {
      start(onClick);
    }
  };
  return (
    <WriteButtonView
      endContent={endContent}
      isDisabled={isDisabled}
      label={label}
      onClick={click}
      runningLabel={runningLabel}
      state={state}
      tooltip={tooltip}
      variant={variant}
    />
  );
}
