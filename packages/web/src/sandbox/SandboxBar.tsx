// The sandbox's bar, in the page's bottom-left corner, over the app without moving it: the
// "Sandbox" marker, the pick toggle, and what the last pick did. Only the sandbox's page loads it.
// The pick script leaves the bar to the page, so its toggle works in pick mode.
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { ToggleButton } from "@astryxdesign/core/ToggleButton";
import {
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
    insetInlineStart: spacingVars["--spacing-3"],
    maxWidth: "var(--size-form)",
    padding: spacingVars["--spacing-2"],
    position: "fixed",
    // Above the app's own dialogs and popovers.
    zIndex: 2_147_483_647,
  },
  copy: {
    margin: 0,
    maxHeight: "var(--size-message-image)",
    overflow: "auto",
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
  picking,
  shortcut,
}: {
  last: PickStatus;
  onPickingChange: (picking: boolean) => void;
  picking: boolean;
  /** The keyboard shortcut that toggles pick mode, as `aria-keyshortcuts` names it. */
  shortcut?: string;
}) {
  const line = status(picking, last);
  return (
    <div data-sandbox-bar data-uraeda-pick-ignore {...stylex.props(styles.bar)}>
      <Badge label="Sandbox" variant="orange" />
      <ToggleButton
        aria-keyshortcuts={shortcut}
        icon={<Icon icon="uraeda:pick" />}
        isPressed={picking}
        label="Pick an element"
        onPressedChange={onPickingChange}
        size="sm"
        tooltip={shortcut && `Pick an element, ${shortcut}`}
      />
      <div role="status">{line !== undefined && <Text size="sm">{line}</Text>}</div>
      {!picking && last.kind === "failed" && (
        <pre {...stylex.props(styles.copy)}>
          <Text size="sm">{last.text}</Text>
        </pre>
      )}
    </div>
  );
}
