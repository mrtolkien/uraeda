// A story's frame, sandboxed without `allow-same-origin`, and the messages of its window. One frame,
// at the phone's width or the desktop's: a change of width resizes and rescales it, and never
// reloads it. On a wide screen, the phone's frame stands centred on a background of its own, framed
// as a phone's screen, and the desktop's is 1440 px wide, scaled to the embed's width. The frame is
// as tall as its story says, up to the theme's maximum, the phone's frame 50% taller; full screen,
// it fills the screen. Its colour mode is sent when it says it is ready and when it changes,
// with pick mode, and its pick script reports the elements picked. It loads its story only once its
// box is on screen, then stays loaded: a page of many embeds loads only those it shows.
import { useTheme } from "@astryxdesign/core/theme";
import {
  colorVars,
  radiusVars,
  shadowVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { bottomOf, keepPlace } from "./keepPlace.ts";
import type { Picked } from "./storyComment.ts";

const styles = stylex.create({
  // The desktop's frame, 1440 px wide, scaled from its top left corner to its box's width.
  desktop: {
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: "absolute",
    transformOrigin: "0 0",
    width: "var(--size-story-desktop)",
  },
  desktopBox: {
    overflow: "hidden",
    position: "relative",
    width: "100%",
  },
  // A frame's height, at most the theme's: a story sized to its window reports more at each resize.
  frame: {
    borderWidth: 0,
    display: "block",
    height: "var(--size-story-height)",
    maxHeight: "var(--size-story-max-height)",
  },
  // A height the human chose, or the screen's: no maximum.
  free: { maxHeight: "none" },
  full: {
    flexGrow: 1,
    minHeight: 0,
    overflow: "hidden",
  },
  height: (height: string) => ({ height }),
  hidden: { visibility: "hidden" },
  // On a wide screen, the phone's screen: centred, with a bezel and a shadow, on its own background.
  phone: {
    // The bezel goes around the phone's 402 px, not into them.
    borderColor: colorVars["--color-background-inverted"],
    borderRadius: radiusVars["--radius-page"],
    borderStyle: "solid",
    borderWidth: spacingVars["--spacing-2"],
    boxShadow: shadowVars["--shadow-med"],
    boxSizing: "content-box",
    maxWidth: "100%",
    width: "var(--size-story-phone)",
  },
  phoneNarrow: {
    width: "100%",
  },
  phoneStage: {
    backgroundColor: colorVars["--color-background-gray"],
    justifyContent: "center",
  },
  scale: (transform: string) => ({ transform }),
  stage: {
    backgroundColor: colorVars["--color-background-muted"],
    display: "flex",
    padding: spacingVars["--spacing-4"],
  },
  stageNarrow: {
    padding: 0,
  },
});

/** The widths a story is shown at: the phone's, 402 px, or the desktop's, 1440 px. */
export type Width = "phone" | "desktop";

/** A message from a frame, which the embed reads only from its own frame's window. */
type FrameMessage = {
  height?: unknown;
  name?: unknown;
  role?: unknown;
  text?: unknown;
  uraeda: unknown;
};

const SANDBOX = "allow-scripts allow-popups";

/** How much taller the phone's frame is than the theme's heights, which the desktop's keep. */
const PHONE_TALLER = 1.5;

/** A length in px from a style's value, 0 when it has none. */
const px = (value: string) => Number.parseFloat(value) || 0;

/** Whether a message is the pick script's: an object with a `uraeda` field. */
function isFrameMessage(data: unknown): data is FrameMessage {
  return typeof data === "object" && data !== null && "uraeda" in data;
}

/** A story's height, when its `size` message gives a finite number above 0. */
function heightOf(message: FrameMessage): number | undefined {
  const { height } = message;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : undefined;
}

/** The element a `picked` message names, when it gives its role and name as text, with its text. */
function pickedOf({ name, role, text }: FrameMessage): Picked | undefined {
  return typeof role === "string" && role !== "" && typeof name === "string"
    ? { name, role, ...(typeof text === "string" && text !== "" ? { text } : {}) }
    : undefined;
}

/**
 * Gives the frame a new height with `resize`. A frame wholly above the window's top would move the
 * text read below it by the change: that text is kept in place (US7 2 of the spec redesign).
 */
function resizeKeepingPlace(stage: HTMLElement | null, resize: () => void) {
  if (!stage || stage.getBoundingClientRect().bottom > 0) {
    resize();
    return;
  }
  // The stage's bottom, NaN once the page is left: nothing to keep then.
  void keepPlace(bottomOf(stage), resize);
}

/**
 * Pick mode, as the embed holds it: whether it is on, and what the frame says. The frame says it is
 * ready, which shows that its Storybook loads the pick script; that an element was picked in it;
 * or that Escape inside it stopped pick mode.
 */
export type PickMode = {
  onPicked: (picked: Picked) => void;
  onPickStopped: () => void;
  onReady: () => void;
  picking: boolean;
};

/**
 * The frame's window, and the height its story reports, kept until it reports another. A frame that
 * says `ready`, again after a reload, is sent the colour mode, which it is sent again when it
 * changes, and pick mode when on; it is sent pick mode as it turns on or off.
 */
function useFrame(pick: PickMode, stage: RefObject<HTMLElement | null>) {
  const frame = useRef<HTMLIFrameElement>(null);
  const [reported, setReported] = useState<number>();
  const { mode } = useTheme();
  const onMessage = useEffectEvent((event: MessageEvent) => {
    if (
      event.source === null ||
      frame.current?.contentWindow !== event.source ||
      !isFrameMessage(event.data)
    ) {
      return;
    }
    const source = event.source as Window;
    if (event.data.uraeda === "ready") {
      source.postMessage({ mode, uraeda: "mode" }, "*");
      if (pick.picking) {
        source.postMessage({ on: true, uraeda: "pick" }, "*");
      }
      pick.onReady();
    } else if (event.data.uraeda === "size") {
      const height = heightOf(event.data);
      if (height !== undefined) {
        resizeKeepingPlace(stage.current, () => setReported(height));
      }
    } else if (event.data.uraeda === "picked") {
      const picked = pickedOf(event.data);
      if (picked) {
        pick.onPicked(picked);
      }
    } else if (event.data.uraeda === "pick-stopped") {
      pick.onPickStopped();
    }
  });
  useEffect(() => {
    const listener = (event: MessageEvent) => onMessage(event);
    window.addEventListener("message", listener);
    return () => window.removeEventListener("message", listener);
  }, []);
  useEffect(() => frame.current?.contentWindow?.postMessage({ mode, uraeda: "mode" }, "*"), [mode]);
  useEffect(
    () => frame.current?.contentWindow?.postMessage({ on: pick.picking, uraeda: "pick" }, "*"),
    [pick.picking],
  );
  return { frame, reported };
}

/** How far below the window's top, in px, a box must reach to count as on screen. */
const EDGE = 32;

/**
 * Whether the box has been on screen since it was drawn: false until it first is, then true for
 * good. Without IntersectionObserver, true at once.
 */
function useSeen(box: RefObject<HTMLDivElement | null>) {
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
      // A sliver at the window's top is not on screen: a scroll to the embed below another leaves
      // the last pixel of the one above in view. At the bottom, a frame coming into view loads.
      { rootMargin: `-${EDGE}px 0px 0px` },
    );
    observer.observe(outer);
    return () => observer.disconnect();
  }, [box, seen]);
  return seen;
}

/**
 * The size of the stage's content box, kept as it changes, with the theme's sizes of a story's frame,
 * in px, read from its style: undefined until measured.
 */
function useStage(stage: RefObject<HTMLElement | null>) {
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

/**
 * The story's frame, at `width`: the phone's alone on narrow screens. Full screen, it fills the
 * space below the embed's bar. An element picked names its width on wide
 * screens, where both can show.
 */
export function StoryFrames({
  full = false,
  label,
  pick,
  src,
  wide,
  width,
}: {
  full?: boolean;
  label: string;
  pick: PickMode;
  src: string;
  wide: boolean;
  width: Width;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const seen = useSeen(stage);
  const shownWidth: Width = wide ? width : "phone";
  const { frame, reported } = useFrame(
    {
      ...pick,
      onPicked: (picked) => pick.onPicked(wide ? { ...picked, width: shownWidth } : picked),
    },
    stage,
  );
  const space = useStage(stage);
  const desktop = shownWidth === "desktop";
  const scale = desktop && space ? space.width / space.desktop : 1;
  // The height the story asks for, shown on the page: at most the theme's, scaled with the frame,
  // the phone's taller.
  const taller = desktop ? 1 : PHONE_TALLER;
  const asked = space && Math.min(reported ?? space.story * taller, space.max * taller) * scale;
  const shown = full ? space?.height : asked;
  // The frame's own height, before its scale: the story's, or what the page shows, unscaled.
  const frameHeight = shown === undefined ? undefined : shown / scale;
  return (
    <>
      <div
        ref={stage}
        {...stylex.props(
          styles.stage,
          !wide && styles.stageNarrow,
          wide && !desktop && styles.phoneStage,
          full && styles.full,
        )}
      >
        <div
          {...stylex.props(
            desktop && styles.desktopBox,
            desktop && styles.height(`${shown ?? asked ?? 0}px`),
            !desktop && wide && styles.phone,
            !desktop && !wide && styles.phoneNarrow,
          )}
        >
          <iframe
            ref={frame}
            sandbox={SANDBOX}
            src={seen ? src : undefined}
            title={`${label}, ${shownWidth}`}
            {...stylex.props(
              styles.frame,
              !desktop && styles.phoneNarrow,
              frameHeight === undefined
                ? reported !== undefined && styles.height(`${reported}px`)
                : [styles.free, styles.height(`${frameHeight}px`)],
              desktop && styles.desktop,
              desktop && (space ? styles.scale(`scale(${scale})`) : styles.hidden),
            )}
          />
        </div>
      </div>
    </>
  );
}
