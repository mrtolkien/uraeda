// The sandbox's bar, in the page's bottom-left corner, over the app without moving it: the
// "Sandbox" marker, the pick toggle, and what the last pick did. The marker hides the rest, and
// shows it again, so the bar uncovers the page's last controls (R21). Only the sandbox's page
// loads it. The pick script leaves the bar to the page, so its toggles work in pick mode.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import { VisuallyHidden } from "@astryxdesign/core/VisuallyHidden";
import {
  borderVars,
  colorVars,
  radiusVars,
  shadowVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-element"],
    bottom: spacingVars["--spacing-3"],
    boxShadow: shadowVars["--shadow-med"],
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    // Both insets bound the bar by the viewport, gutters included, on a phone; its own width keeps
    // it at its content's, in the start corner.
    insetInlineEnd: spacingVars["--spacing-3"],
    insetInlineStart: spacingVars["--spacing-3"],
    maxWidth: "var(--size-form)",
    padding: spacingVars["--spacing-2"],
    position: "fixed",
    width: "fit-content",
    // Above the app's own dialogs and popovers.
    zIndex: 2_147_483_647,
  },
  // Out of the bar's flow, its text hidden and still announced: no gap after the bar's last button.
  unseen: { position: "absolute" },
  // A framed box, so its clipped last line reads as more to scroll to.
  copy: {
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-element"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    margin: 0,
    maxHeight: "var(--size-message-image)",
    overflow: "auto",
    padding: spacingVars["--spacing-1"],
    userSelect: "all",
    whiteSpace: "pre-wrap",
    width: "100%",
  },
});

/** What the last pick did: nothing yet, copied the element named, or failed to copy `text`. */
export type PickStatus =
  | { kind: "idle" }
  | { element: string; kind: "copied" }
  | { kind: "failed"; text: string };

/** The status line, announced as it changes: the hint while picking, else the last pick's. */
function status(picking: boolean, last: PickStatus): string | undefined {
  if (picking) {
    return "Click an element to copy it. Escape to stop.";
  }
  if (last.kind === "copied") {
    return `Copied ${last.element}. Paste it to your agent.`;
  }
  if (last.kind === "failed") {
    return "Could not copy. Select the text below and copy it.";
  }
  return undefined;
}

export function SandboxBar({
  last,
  onPickingChange,
  onShownChange,
  picking,
  shortcut,
  shown = true,
}: {
  last: PickStatus;
  onPickingChange: (picking: boolean) => void;
  /** Hides the bar but its marker, or shows it again. */
  onShownChange?: (shown: boolean) => void;
  picking: boolean;
  /** The keyboard shortcut that toggles pick mode, as `aria-keyshortcuts` names it. */
  shortcut?: string;
  /** Whether the bar shows more than its marker. */
  shown?: boolean;
}) {
  const line = status(picking, last);
  // Hidden, the bar still shows a copy that failed, an error to deal with, and still announces the
  // rest.
  const failed = !picking && last.kind === "failed";
  const seen = line !== undefined && (shown || failed);
  return (
    <div data-sandbox-bar data-uraeda-pick-ignore {...stylex.props(styles.bar)}>
      <Button
        aria-expanded={shown}
        label={shown ? "Sandbox, hide the bar" : "Sandbox, show the bar"}
        onClick={() => onShownChange?.(!shown)}
        size="sm"
        variant="ghost"
      >
        <Badge label="Sandbox" variant="orange" />
      </Button>
      {shown && (
        <ToggleButton
          aria-keyshortcuts={shortcut}
          icon={<Icon icon="uraeda:pick" />}
          isPressed={picking}
          label="Pick an element"
          onPressedChange={onPickingChange}
          size="sm"
          tooltip={shortcut && `Pick an element, ${shortcut}`}
        />
      )}
      <div role="status" {...stylex.props(!seen && styles.unseen)}>
        {line !== undefined &&
          (seen ? (
            <Text size="sm">{line}</Text>
          ) : (
            <VisuallyHidden>
              <Text size="sm">{line}</Text>
            </VisuallyHidden>
          ))}
      </div>
      {failed && (
        // Reached by Tab, and selected whole as it takes focus, ready to copy with the keyboard.
        <pre
          aria-label="The pick's text"
          aria-multiline
          aria-readonly
          onFocus={(event) =>
            event.currentTarget.ownerDocument.getSelection()?.selectAllChildren(event.currentTarget)
          }
          role="textbox"
          tabIndex={0}
          {...stylex.props(styles.copy)}
        >
          <Text size="sm">{last.text}</Text>
        </pre>
      )}
    </div>
  );
}
