// The sandbox's bar, in the page's top-right corner, over the app without moving it: the
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
import { type PointerEvent, useRef, useState } from "react";

/** How far the pointer moves before a press on the marker is a drag, in pixels. */
const DRAG_THRESHOLD = 4;

const styles = stylex.create({
  bar: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-element"],
    boxShadow: shadowVars["--shadow-med"],
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    // Both insets bound the bar by the viewport, gutters included, on a phone; its own width keeps
    // it at its content's, in the end corner.
    insetInlineEnd: spacingVars["--spacing-3"],
    insetInlineStart: spacingVars["--spacing-3"],
    marginInlineStart: "auto",
    maxWidth: "var(--size-form)",
    padding: spacingVars["--spacing-2"],
    position: "fixed",
    top: spacingVars["--spacing-3"],
    width: "fit-content",
    // Above the app's own dialogs and popovers.
    zIndex: 2_147_483_647,
  },
  // The bar drags from anywhere on it: a touch drags it too, not the page.
  handle: { cursor: "grab", touchAction: "none", userSelect: "none" },
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
  shown: shownProp,
}: {
  last: PickStatus;
  onPickingChange: (picking: boolean) => void;
  /** Hides the bar but its marker, or shows it again. */
  onShownChange?: (shown: boolean) => void;
  picking: boolean;
  /** The keyboard shortcut that toggles pick mode, as `aria-keyshortcuts` names it. */
  shortcut?: string;
  /** Whether the bar shows more than its marker: by default, it does. */
  shown?: boolean;
}) {
  // Not a default in the parameters, which the React Compiler cannot lower yet.
  const shown = shownProp !== false;
  const line = status(picking, last);
  // Hidden, the bar still shows a copy that failed, an error to deal with, and still announces the
  // rest.
  const failed = !picking && last.kind === "failed";
  const seen = line !== undefined && (shown || failed);
  // The marker drags the bar, to uncover what is under it, kept in the window: a press that moved
  // is a drag, and does not toggle the bar.
  const bar = useRef<HTMLDivElement>(null);
  const [offset, setOffset] = useState({ x: 0, y: 0 });
  const drag = useRef<{ moved: boolean; ox: number; oy: number; px: number; py: number }>(null);
  const dragged = useRef(false);
  const dragTo = (event: PointerEvent<HTMLElement>) => {
    const start = drag.current;
    const rect = bar.current?.getBoundingClientRect();
    if (!start || !rect) {
      return;
    }
    const dx = event.clientX - start.px;
    const dy = event.clientY - start.py;
    if (!start.moved && Math.hypot(dx, dy) < DRAG_THRESHOLD) {
      return;
    }
    if (!start.moved) {
      // From here the bar has the pointer, so the buttons under it get no click: a drag is not one.
      event.currentTarget.setPointerCapture(event.pointerId);
    }
    start.moved = true;
    // The bar's place without its offset, which the new offset is kept within the window from.
    const left = rect.left - offset.x;
    const top = rect.top - offset.y;
    setOffset({
      x: Math.min(Math.max(start.ox + dx, -left), window.innerWidth - rect.width - left),
      y: Math.min(Math.max(start.oy + dy, -top), window.innerHeight - rect.height - top),
    });
  };
  return (
    <div
      data-sandbox-bar
      data-uraeda-pick-ignore
      onClickCapture={(event) => {
        // The click that ends a drag, which the bar's buttons must not take.
        if (dragged.current) {
          dragged.current = false;
          event.stopPropagation();
        }
      }}
      onPointerDown={(event) => {
        // Anywhere on the bar, its buttons too, but not the failed copy's text, which is selected.
        if (event.button !== 0 || (event.target as Element).closest("pre")) {
          return;
        }
        drag.current = { moved: false, ox: offset.x, oy: offset.y, px: event.clientX, py: event.clientY };
      }}
      onPointerMove={dragTo}
      onPointerUp={() => {
        // The click that ends a drag follows at once: a press that gets none does not hold back
        // the next one.
        dragged.current = drag.current?.moved ?? false;
        drag.current = null;
        setTimeout(() => (dragged.current = false), 100);
      }}
      ref={bar}
      {...stylex.props(styles.bar, styles.handle)}
      style={{ transform: `translate(${offset.x}px, ${offset.y}px)` }}
    >
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
