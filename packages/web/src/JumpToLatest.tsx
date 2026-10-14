import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

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
    pointerEvents: "auto",
  },
});

/** "Jump to the latest", above the composer, while the page does not follow the transcript's end. */
export function JumpToLatest({ onJump }: { onJump: () => void }) {
  return (
    <div {...stylex.props(styles.jump)}>
      <span {...stylex.props(styles.jumpButton)}>
        <Button
          clickAction={onJump}
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
