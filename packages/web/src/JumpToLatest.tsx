import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { RefObject } from "react";

const styles = stylex.create({
  jump: {
    // Above the composer, over the transcript's end, without moving it.
    bottom: "100%",
    display: "flex",
    insetInline: 0,
    justifyContent: "center",
    paddingBlockEnd: spacingVars["--spacing-2"],
    pointerEvents: "none",
    position: "absolute",
  },
  jumpButton: {
    // The secondary button's fill is translucent: the page's surface under it keeps the transcript's
    // text from showing through.
    backgroundColor: colorVars["--color-background-surface"],
    borderRadius: radiusVars["--radius-element"],
    display: "inline-flex",
    pointerEvents: "auto",
  },
});

/**
 * "Jump to the latest", above the composer, while the page does not follow the transcript's end.
 * Pressed, it goes as the page follows again: the focus moves first to the composer's text field,
 * in `composer`, rather than falling to the page.
 */
export function JumpToLatest({
  composer,
  onJump,
}: {
  composer: RefObject<HTMLElement | null>;
  onJump: () => void;
}) {
  const jump = () => {
    composer.current
      ?.querySelector<HTMLElement>('[role="textbox"]')
      ?.focus({ preventScroll: true });
    onJump();
  };
  return (
    <div {...stylex.props(styles.jump)}>
      <span {...stylex.props(styles.jumpButton)}>
        <Button
          clickAction={jump}
          elevation="low"
          icon={<Icon icon="arrowDown" />}
          label="Jump to the latest"
          size="sm"
          variant="secondary"
        />
      </span>
    </div>
  );
}
