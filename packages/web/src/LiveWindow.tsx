// The window a live story is drawn in: its box on the page, which grows past its column on a wide
// screen and goes full screen, its bar with its title and controls, and its stage's room, which
// scales the frame.
import { Divider } from "@astryxdesign/core/Divider";
import { Text } from "@astryxdesign/core/Text";
import {
  borderVars,
  colorVars,
  radiusVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useLayoutEffect, useRef, useState } from "react";
import { useFullScreen, useOutgrow } from "./embedLayout.ts";

const styles = stylex.create({
  bar: {
    alignItems: "center",
    display: "flex",
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-3"],
  },
  // On narrow screens, the embed takes the page's inset back (see `Page`), 16 px outside a page: the
  // phone's width is the screen's.
  bleed: {
    borderInlineWidth: 0,
    borderRadius: 0,
    marginInline: `var(--page-bleed, calc(-1 * ${spacingVars["--spacing-4"]}))`,
  },
  embed: {
    backgroundColor: colorVars["--color-background-surface"],
    borderColor: colorVars["--color-border"],
    borderRadius: radiusVars["--radius-container"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    marginBlockEnd: spacingVars["--spacing-3"],
    marginBlockStart: 0,
    marginInline: 0,
    overflow: "hidden",
  },
  // Full screen, which the browser sizes to the screen: the bar above, the story filling the rest.
  full: {
    borderRadius: 0,
    borderWidth: 0,
    display: "flex",
    flexDirection: "column",
    marginBlock: 0,
  },
  grow: (start: string, end: string) => ({ marginInlineEnd: end, marginInlineStart: start }),
  label: {
    marginInlineEnd: "auto",
  },
});

/** A length in px from a style's value, 0 when it has none. */
export const px = (value: string) => Number.parseFloat(value) || 0;

/** The window's box, its full screen, and its growth past its column. */
export function useLiveWindow(wide: boolean) {
  const figure = useRef<HTMLElement>(null);
  const screen = useFullScreen(figure);
  const grow = useOutgrow(figure, wide);
  return { figure, grow, screen };
}

/** Whether the window is full screen, and what enters or leaves it, where the browser can. */
export type FullScreen = ReturnType<typeof useFullScreen>;

/** The window: a figure named by its label, grown past its column, or full screen. */
export function LiveWindow({
  children,
  id,
  labelId,
  live,
  wide,
}: {
  children: ReactNode;
  id?: string;
  labelId: string;
  live: ReturnType<typeof useLiveWindow>;
  wide: boolean;
}) {
  const { figure, grow, screen } = live;
  return (
    <figure
      aria-labelledby={labelId}
      id={id}
      ref={figure}
      {...stylex.props(
        styles.embed,
        !wide && styles.bleed,
        wide &&
          !screen.full &&
          (grow.start > 0 || grow.end > 0) &&
          styles.grow(`-${grow.start}px`, `-${grow.end}px`),
        screen.full && styles.full,
      )}
    >
      {children}
    </figure>
  );
}

/** The window's bar: its label, then its controls. */
export function Bar({
  children,
  label,
  labelId,
}: {
  children?: ReactNode;
  label: string;
  labelId: string;
}) {
  return (
    <>
      <div {...stylex.props(styles.bar)}>
        <Text id={labelId} weight="semibold" xstyle={styles.label}>
          {label}
        </Text>
        {children}
      </div>
      {/* Astryx's divider: a border of the app's own would write the atomic rule of a list's
          dividers again, unlayered, and every list's last row would keep its divider. */}
      <Divider aria-hidden />
    </>
  );
}

/**
 * The size of the stage's content box, kept as it changes, with the theme's sizes of a story's frame,
 * in px, read from its style: undefined until measured.
 */
export function useStage(stage: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{
    desktop: number;
    height: number;
    max: number;
    story: number;
    width: number;
  }>();
  useLayoutEffect(() => {
    const element = stage.current;
    if (!element) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(element);
      const next = {
        desktop: px(style.getPropertyValue("--size-story-desktop")) || 1440,
        height: element.clientHeight - px(style.paddingTop) - px(style.paddingBottom),
        max: px(style.getPropertyValue("--size-story-max-height")) || 900,
        story: px(style.getPropertyValue("--size-story-height")) || 560,
        width: element.clientWidth - px(style.paddingLeft) - px(style.paddingRight),
      };
      setSize((known) =>
        known &&
        Object.entries(next).every(([key, value]) => known[key as keyof typeof next] === value)
          ? known
          : next,
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(element);
    return () => observer.disconnect();
  }, [stage]);
  return size;
}
