// A live window's frame on its hatched stage: the page at its real width, scaled to fit the stage's
// room, never above 100%, so a phone's width shows at its size wherever it fits; full screen, at
// 100%, the stage scrolling where the screen is narrower. The frame loads only once its stage is on
// screen, then stays loaded: a page of many windows loads only those it shows. The hatched stage is
// an Astryx gap (plan, Complexity tracking): no Astryx surface has a pattern, so it is a gradient of
// the theme's tokens.
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useEffect, useLayoutEffect, useState } from "react";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";

const styles = stylex.create({
  // The scaled frame's box, as wide and tall as the frame drawn: a scaled frame keeps its unscaled
  // layout box, so the box takes the scaled size and clips the rest.
  box: {
    flexShrink: 0,
    overflow: "hidden",
    position: "relative",
  },
  frame: {
    backgroundColor: colorVars["--color-background-body"],
    borderWidth: 0,
    display: "block",
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: "absolute",
    transformOrigin: "0 0",
  },
  height: (height: string) => ({ height }),
  hidden: { visibility: "hidden" },
  scale: (transform: string) => ({ transform }),
  size: (width: string, height: string) => ({ height, width }),
  // The stage: hatched in the theme's surface and gray, the frame centred on it, and its start kept
  // in view where the frame is wider than the stage.
  stage: {
    backgroundImage: `repeating-linear-gradient(-45deg, ${colorVars["--color-background-surface"]} 0 6px, ${colorVars["--color-background-gray"]} 6px 12px)`,
    display: "flex",
    justifyContent: "safe center",
    padding: spacingVars["--spacing-2"],
  },
  // On a narrow screen, a thinner hatch around the frame, which keeps the room for it.
  stageFull: {
    boxSizing: "content-box",
    overflow: "auto",
  },
  stageNarrow: {
    padding: spacingVars["--spacing-1"],
  },
});

/** A live frame's width and scale, which its window's title says. */
export type Fit = { scale: number; width: number };

/** The widths below which a page is a phone's: its icon, and a story's taller frame. */
export const PHONE_BELOW = 768;

/** How much taller a phone story's frame is than the theme's heights, which the desktop's keep. */
const PHONE_TALLER = 1.5;

/** How far below the window's top, in px, a box must reach to count as on screen. */
const EDGE = 32;

/** The room below the stage in full screen: the window's border and inset. */
const FULL_FOOT = 8;

/** A length in px from a style's value, 0 when it has none. */
const px = (value: string) => Number.parseFloat(value) || 0;

/**
 * Whether the box has been on screen since it was drawn: false until it first is, then true for
 * good. Without IntersectionObserver, true at once.
 */
export function useSeen(box: RefObject<HTMLDivElement | null>) {
  const [seen, setSeen] = useState(() => typeof IntersectionObserver === "undefined");
  useEffect(() => {
    const outer = box.current;
    if (seen || !outer) {
      return;
    }
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setSeen(true);
        }
      },
      // A sliver at the window's top is not on screen: a scroll to the window below another leaves
      // the last pixel of the one above in view. At the bottom, a frame coming into view loads.
      { rootMargin: `-${EDGE}px 0px 0px` },
    );
    observer.observe(outer);
    return () => observer.disconnect();
  }, [box, seen]);
  return seen;
}

/**
 * The width of the stage's content box, kept as it changes, with the theme's sizes of a frame, in
 * px, read from its style: undefined until measured.
 */
function useStage(stage: RefObject<HTMLElement | null>) {
  const [size, setSize] = useState<{
    desktop: number;
    max: number;
    phone: number;
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
        max: px(style.getPropertyValue("--size-story-max-height")) || 900,
        phone: px(style.getPropertyValue("--size-story-phone")) || 402,
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

/**
 * The stage's height in full screen: the screen's, below the stage's top, less the window's foot.
 * Undefined out of full screen.
 */
function useFullHeight(stage: RefObject<HTMLElement | null>, full: boolean) {
  const [height, setHeight] = useState<number>();
  useLayoutEffect(() => {
    const element = stage.current;
    if (!full || !element) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(element);
      setHeight(
        Math.max(
          0,
          window.innerHeight -
            element.getBoundingClientRect().top -
            px(style.paddingTop) -
            px(style.paddingBottom) -
            FULL_FOOT,
        ),
      );
    };
    measure();
    window.addEventListener("resize", measure);
    return () => window.removeEventListener("resize", measure);
  }, [full, stage]);
  return full ? height : undefined;
}

/**
 * A frame on its stage, at `width`, in px or the theme's phone or desktop width, scaled to fit, or
 * at 100% when `full`. Its unscaled height is `asked`, a story's reported height, at most the
 * theme's maximum, the phone's 50% taller; the theme's story height without one; the theme's
 * maximum with `"max"`; the screen's in full screen. `onFit` hears its width and scale.
 */
export function LiveFrame({
  asked,
  frame,
  full,
  onFit,
  sandbox,
  src,
  stage,
  title,
  width,
}: {
  asked?: number | "max";
  frame?: RefObject<HTMLIFrameElement | null>;
  full: boolean;
  onFit?: (fit: Fit) => void;
  sandbox: string;
  src: string;
  stage: RefObject<HTMLDivElement | null>;
  title: string;
  width: number | "desktop" | "phone";
}) {
  const seen = useSeen(stage);
  const space = useStage(stage);
  const narrow = isNarrow(useWidthClass());
  const fullHeight = useFullHeight(stage, full);
  const pixels = typeof width === "number" ? width : space?.[width];
  const scale =
    space && pixels ? (full ? 1 : Math.min(1, Math.max(0, space.width) / pixels)) : undefined;
  const taller = pixels !== undefined && pixels < PHONE_BELOW ? PHONE_TALLER : 1;
  const own =
    space &&
    (asked === "max" ? space.max : Math.min(asked ?? space.story * taller, space.max * taller));
  const height = full ? fullHeight : own;
  useEffect(() => {
    if (pixels !== undefined && scale !== undefined) {
      onFit?.({ scale, width: pixels });
    }
  }, [onFit, pixels, scale]);
  const drawn = pixels !== undefined && scale !== undefined && height !== undefined;
  return (
    <div
      ref={stage}
      {...stylex.props(
        styles.stage,
        narrow && styles.stageNarrow,
        full && styles.stageFull,
        fullHeight !== undefined && styles.height(`${fullHeight}px`),
      )}
    >
      <div
        {...stylex.props(
          styles.box,
          drawn ? styles.size(`${pixels * scale}px`, `${height * scale}px`) : styles.hidden,
        )}
      >
        <iframe
          ref={frame}
          sandbox={sandbox}
          src={seen ? src : undefined}
          title={title}
          {...stylex.props(
            styles.frame,
            drawn
              ? [styles.size(`${pixels}px`, `${height}px`), styles.scale(`scale(${scale})`)]
              : styles.hidden,
          )}
        />
      </div>
    </div>
  );
}
