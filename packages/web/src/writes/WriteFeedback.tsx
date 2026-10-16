// What the UI shows while a git write runs: the button that started it spins at once with what it
// does, every other button that writes is blocked, still focusable, and a thin bar runs at the top
// of the page. Reading and moving around stay free.
import { Button } from "@astryxdesign/core/Button";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { Spinner } from "@astryxdesign/core/Spinner";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

/** A writing button's state: free, running its own write, or blocked by another one. */
export type WriteState = "idle" | "running" | "blocked";

const styles = stylex.create({
  bar: {
    insetInline: 0,
    paddingInline: spacingVars["--spacing-0"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
});

/** The thin bar at the top of the page, while any git write runs. */
export function WriteProgress({ isRunning }: { isRunning: boolean }) {
  if (!isRunning) {
    return null;
  }
  return (
    <div {...stylex.props(styles.bar)}>
      <ProgressBar isIndeterminate isLabelHidden label="Saving to git" />
    </div>
  );
}

/**
 * A button that writes to git, drawn in its state: its running label with a spinner while its own
 * write runs, blocked while another one does.
 */
export function WriteButtonView({
  label,
  onClick,
  runningLabel,
  state,
  variant,
}: {
  label: string;
  onClick: () => void;
  /** What it does while running: "Committing…". */
  runningLabel: string;
  state: WriteState;
  variant?: "primary" | "secondary";
}) {
  if (state === "running") {
    // Astryx's `isLoading` hides the label: the spinner goes beside it instead, and the button stays
    // focusable through the tooltip's `aria-disabled`.
    return (
      <Button
        aria-busy
        icon={<Spinner shade="inherit" size="sm" />}
        isDisabled
        label={runningLabel}
        onClick={onClick}
        tooltip="Saving to git"
        variant={variant}
      />
    );
  }
  return (
    <Button
      isDisabled={state === "blocked"}
      label={label}
      onClick={onClick}
      // Astryx keeps a disabled button with a tooltip focusable, through `aria-disabled`.
      {...(state === "blocked" ? { tooltip: "Another change is being saved to git" } : {})}
      variant={variant}
    />
  );
}
