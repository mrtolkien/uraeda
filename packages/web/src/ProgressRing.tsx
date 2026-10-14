// A feature's progress through its plan, as a ring: the sidebar's progress row and the phone's
// progress line draw it beside the words that say it.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";

/** The ring's circle, in the SVG's 16 × 16 box. */
const CENTER = 8;
const RADIUS = 6;

const styles = stylex.create({
  fill: {
    stroke: colorVars["--color-icon-accent"],
  },
  ring: {
    // The size of a row's status dot, so a progress row lines up with the rows around it.
    flexShrink: 0,
    height: spacingVars["--spacing-4"],
    width: spacingVars["--spacing-4"],
  },
  track: {
    stroke: colorVars["--color-border-emphasized"],
  },
});

/**
 * A ring filled to `position / total`, from the top, clockwise, in the theme's accent colour over
 * a grey track. Hidden from screen readers: the row it is in says the same in words.
 */
export function ProgressRing({ position, total }: { position: number; total: number }) {
  const filled = total > 0 ? Math.min(Math.max(position, 0), total) : 0;
  return (
    <svg aria-hidden="true" viewBox="0 0 16 16" {...stylex.props(styles.ring)}>
      <circle
        cx={CENTER}
        cy={CENTER}
        fill="none"
        r={RADIUS}
        strokeWidth={3}
        {...stylex.props(styles.track)}
      />
      {filled > 0 && (
        <circle
          cx={CENTER}
          cy={CENTER}
          fill="none"
          // The circle's length counted in tasks, so the dash is the filled part.
          pathLength={total}
          r={RADIUS}
          strokeDasharray={`${filled} ${total}`}
          strokeWidth={3}
          transform={`rotate(-90 ${CENTER} ${CENTER})`}
          {...stylex.props(styles.fill)}
        />
      )}
    </svg>
  );
}
