// The live window a story or an HTML mockup is drawn in, wherever `Blocks` draws one: a pane with
// the theme's double sapphire border, titled "live · <name>", then its width and scale, a phone's or
// a monitor's icon by its width, its controls in its top border. On a wide screen, it grows past
// its column into the empty space beside it, and it goes full screen, where its page shows at 100%.
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef } from "react";
import { useFullScreen, useOutgrow } from "./embedLayout.ts";
import { Pane } from "./layout/Pane.tsx";
import { type Fit, PHONE_BELOW } from "./LiveFrame.tsx";

const styles = stylex.create({
  figure: {
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
    marginInline: 0,
  },
  // Full screen, which the browser sizes to the screen, on the page's own background.
  full: {
    backgroundColor: colorVars["--color-background-body"],
    marginBlock: 0,
    overflow: "auto",
    paddingInline: spacingVars["--spacing-2"],
  },
  grow: (start: string, end: string) => ({ marginInlineEnd: end, marginInlineStart: start }),
});

/**
 * The window's box, its full screen, and its growth past its column toward `width`, in px, the
 * desktop's by default.
 */
export function useLiveWindow(wide: boolean, width?: number) {
  const figure = useRef<HTMLElement>(null);
  const screen = useFullScreen(figure);
  const grow = useOutgrow(figure, wide, width);
  return { figure, grow, screen };
}

/** Whether the window is full screen, and what enters or leaves it, where the browser can. */
export type FullScreen = ReturnType<typeof useFullScreen>;

/** The window's box, its full screen, and its growth, from `useLiveWindow`. */
export type Live = ReturnType<typeof useLiveWindow>;

/** "Full screen", or "Leave full screen" once in it: none where the browser has no full screen. */
export function FullScreenButton({ screen }: { screen: FullScreen }) {
  const { full, toggle } = screen;
  return (
    toggle && (
      <IconButton
        icon={<Icon icon={full ? "uraeda:minimize" : "uraeda:maximize"} />}
        label={full ? "Leave full screen" : "Full screen"}
        onClick={() => void toggle()}
        size="sm"
        variant="ghost"
      />
    )
  );
}

/**
 * The window: a figure named by its label, holding a pane toned `live`, titled "live · <label>",
 * then, once its frame is measured, "· <width> px · <scale>%". `actions` sit in its top border;
 * `after` follows the pane, in the figure, as a story's comment form does.
 */
export function LiveWindow({
  actions,
  after,
  children,
  fit,
  id,
  label,
  live,
  wide,
}: {
  actions?: ReactNode;
  after?: ReactNode;
  children?: ReactNode;
  fit?: Fit;
  id?: string;
  label: string;
  live: Live;
  wide: boolean;
}) {
  const { figure, grow, screen } = live;
  const phone = fit !== undefined && fit.width < PHONE_BELOW;
  return (
    <figure
      aria-label={label}
      id={id}
      ref={figure}
      {...stylex.props(
        styles.figure,
        wide &&
          !screen.full &&
          (grow.start > 0 || grow.end > 0) &&
          styles.grow(`-${grow.start}px`, `-${grow.end}px`),
        screen.full && styles.full,
      )}
    >
      <Pane
        actions={actions}
        icon={phone ? "uraeda:smartphone" : "uraeda:monitor"}
        level={3}
        title={`live · ${label}`}
        titleSuffix={fit && `· ${fit.width} px · ${Math.round(fit.scale * 100)}%`}
        tone="live"
      >
        {children}
      </Pane>
      {after}
    </figure>
  );
}
