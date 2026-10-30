// A button that writes to git: its action answers once the files are written, and the page shows its
// result at once, while the commit lands behind it, in the toast (`CommitToast.tsx`). It never
// blocks another button and shows no running state; a second press while its own action has not
// answered yet does nothing, so one press makes one write.
import { Button } from "@astryxdesign/core/Button";
import { type ReactNode, useRef } from "react";

/** A button's variant, as Astryx names it. */
type Variant = "primary" | "secondary" | "destructive" | "ghost";

export function WriteButton({
  endContent,
  isDisabled = false,
  label,
  onClick,
  tooltip,
  variant,
}: {
  /** What shows after its label: its key. */
  endContent?: ReactNode;
  isDisabled?: boolean | undefined;
  label: string;
  onClick: () => Promise<unknown>;
  /** Why it is disabled, as a question left blank. */
  tooltip?: string | undefined;
  variant?: Variant | undefined;
}) {
  const answering = useRef(false);
  const click = () => {
    if (isDisabled || answering.current) {
      return;
    }
    answering.current = true;
    void onClick().finally(() => {
      answering.current = false;
    });
  };
  return (
    <Button
      endContent={endContent}
      isDisabled={isDisabled}
      label={label}
      onClick={click}
      // Astryx keeps a disabled button with a tooltip focusable, through `aria-disabled`.
      {...(tooltip === undefined ? {} : { tooltip })}
      variant={variant}
    />
  );
}
