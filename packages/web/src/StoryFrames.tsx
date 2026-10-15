// A story's frames, sandboxed without `allow-same-origin`, and the messages of their windows: the
// widths a wide screen shows, the phone's alone on narrow ones, each frame as tall as its story says,
// and in Uraeda's colour mode, which a frame is sent when it says it is ready and when it changes;
// and pick mode, sent to every frame, and the elements their pick scripts report.
import { useTheme } from "@astryxdesign/core/theme";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type RefObject,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import type { Picked } from "./storyComment.ts";

const styles = stylex.create({
  desktop: {
    insetBlockStart: 0,
    insetInlineStart: 0,
    position: "absolute",
    transformOrigin: "0 0",
    width: "var(--size-story-desktop)",
  },
  frame: {
    borderWidth: 0,
    display: "block",
    height: "var(--size-story-height)",
  },
  frames: {
    alignItems: "flex-start",
    backgroundColor: colorVars["--color-background-muted"],
    display: "flex",
    gap: spacingVars["--spacing-4"],
    padding: spacingVars["--spacing-4"],
  },
  framesNarrow: {
    padding: 0,
  },
  // A frame's height, as its story reported it.
  height: (height: string) => ({ height }),
  hidden: { visibility: "hidden" },
  phone: {
    flexShrink: 0,
    maxWidth: "100%",
    width: "var(--size-story-phone)",
  },
  phoneNarrow: {
    width: "100%",
  },
  scale: (transform: string) => ({ transform }),
  // The desktop frame's box: the space left, as tall as the scaled frame.
  scaledBox: {
    flexGrow: 1,
    minWidth: 0,
    overflow: "hidden",
    position: "relative",
  },
});

/** The widths a wide screen shows a story at. */
export type Widths = "both" | "phone" | "desktop";

/** The frames of a story, by width. */
type Width = "phone" | "desktop";

/** A message from a frame, which the embed reads only from its own frames' windows. */
type FrameMessage = { height?: unknown; name?: unknown; role?: unknown; uraeda: unknown };

const SANDBOX = "allow-scripts allow-popups";

/** Whether a message is the pick script's: an object with a `uraeda` field. */
function isFrameMessage(data: unknown): data is FrameMessage {
  return typeof data === "object" && data !== null && "uraeda" in data;
}

/** A story's height, when its `size` message gives a finite number above 0. */
function heightOf(message: FrameMessage): number | undefined {
  const { height } = message;
  return typeof height === "number" && Number.isFinite(height) && height > 0 ? height : undefined;
}

/** The element a `picked` message names, when it gives its role and name as text. */
function pickedOf({ name, role }: FrameMessage): Picked | undefined {
  return typeof role === "string" && role !== "" && typeof name === "string"
    ? { name, role }
    : undefined;
}

/**
 * Pick mode, as the embed holds it: whether it is on, and what the frames say. A frame says it is
 * ready, which shows that its Storybook loads the pick script; that an element was picked in it,
 * with its width; or that Escape inside it stopped pick mode.
 */
export type PickMode = {
  onPicked: (picked: Picked & { width: Width }) => void;
  onPickStopped: () => void;
  onReady: () => void;
  picking: boolean;
};

/** Sends a message to each frame shown. */
function sendAll(frames: ReadonlyArray<RefObject<HTMLIFrameElement | null>>, message: object) {
  for (const frame of frames) {
    frame.current?.contentWindow?.postMessage(message, "*");
  }
}

/**
 * The frames' windows, and the heights their stories report. A frame that says `ready`, again after
 * a reload, is sent the colour mode, which every frame is sent again when it changes, and pick mode
 * when on; every frame is sent pick mode as it turns on or off.
 */
function useFrames(pick: PickMode) {
  const phone = useRef<HTMLIFrameElement>(null);
  const desktop = useRef<HTMLIFrameElement>(null);
  const [heights, setHeights] = useState<Partial<Record<Width, number>>>({});
  const { mode } = useTheme();
  const onMessage = useEffectEvent((event: MessageEvent) => {
    const frames: Record<Width, RefObject<HTMLIFrameElement | null>> = { desktop, phone };
    const width = (["phone", "desktop"] as const).find(
      (name) => event.source !== null && frames[name].current?.contentWindow === event.source,
    );
    if (width === undefined || !isFrameMessage(event.data)) {
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
        setHeights((known) => ({ ...known, [width]: height }));
      }
    } else if (event.data.uraeda === "picked") {
      const picked = pickedOf(event.data);
      if (picked) {
        pick.onPicked({ ...picked, width });
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
  useEffect(() => sendAll([phone, desktop], { mode, uraeda: "mode" }), [mode]);
  useEffect(() => sendAll([phone, desktop], { on: pick.picking, uraeda: "pick" }), [pick.picking]);
  return { desktop, heights, phone };
}

/** The desktop frame, 1440 px wide, scaled to the space left, its box as tall as it shows. */
function DesktopFrame({
  frameRef,
  height,
  src,
  title,
}: {
  frameRef: RefObject<HTMLIFrameElement | null>;
  height: number | undefined;
  src: string;
  title: string;
}) {
  const box = useRef<HTMLDivElement>(null);
  const [fit, setFit] = useState<{ height: number; scale: number }>();
  useLayoutEffect(() => {
    const outer = box.current;
    const frame = frameRef.current;
    if (!outer || !frame) {
      return;
    }
    const measure = () => {
      const scale = outer.clientWidth / frame.offsetWidth;
      const shown = frame.offsetHeight * scale;
      setFit((known) =>
        known?.scale === scale && known.height === shown ? known : { height: shown, scale },
      );
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    observer.observe(frame);
    return () => observer.disconnect();
  }, [frameRef]);
  return (
    <div ref={box} {...stylex.props(styles.scaledBox, fit && styles.height(`${fit.height}px`))}>
      <iframe
        ref={frameRef}
        sandbox={SANDBOX}
        src={src}
        title={title}
        {...stylex.props(
          styles.frame,
          styles.desktop,
          height !== undefined && styles.height(`${height}px`),
          fit ? styles.scale(`scale(${fit.scale})`) : styles.hidden,
        )}
      />
    </div>
  );
}

/**
 * Whether the frames' box holds the phone's frame, its padding, and the gap before the desktop's:
 * a box narrower than the screen, as a pane's, may not.
 */
function useRoomForBoth(box: RefObject<HTMLDivElement | null>) {
  const [room, setRoom] = useState(true);
  useLayoutEffect(() => {
    const outer = box.current;
    if (!outer) {
      return;
    }
    const measure = () => {
      const style = getComputedStyle(outer);
      const need = [
        style.getPropertyValue("--size-story-phone"),
        style.paddingLeft,
        style.paddingRight,
        style.columnGap,
      ].reduce((sum, value) => sum + (Number.parseFloat(value) || 0), 0);
      setRoom(outer.clientWidth >= need);
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(outer);
    return () => observer.disconnect();
  }, [box]);
  return room;
}

/**
 * The story's frames: the widths chosen on wide screens, the phone's alone on narrow ones, and in
 * place of both in a box too narrow for them. An element picked names its frame's width only while
 * both show.
 */
export function StoryFrames({
  label,
  pick,
  src,
  wide,
  widths,
}: {
  label: string;
  pick: Omit<PickMode, "onPicked"> & { onPicked: (picked: Picked) => void };
  src: string;
  wide: boolean;
  widths: Widths;
}) {
  const box = useRef<HTMLDivElement>(null);
  const room = useRoomForBoth(box);
  const shown = widths === "both" && !room ? "phone" : widths;
  const both = wide && shown === "both";
  const { desktop, heights, phone } = useFrames({
    ...pick,
    onPicked: ({ width, ...picked }) => pick.onPicked(both ? { ...picked, width } : picked),
  });
  return (
    <div ref={box} {...stylex.props(styles.frames, !wide && styles.framesNarrow)}>
      {(!wide || shown !== "desktop") && (
        <iframe
          ref={phone}
          sandbox={SANDBOX}
          src={src}
          title={`${label}, phone`}
          {...stylex.props(
            styles.frame,
            wide ? styles.phone : styles.phoneNarrow,
            heights.phone !== undefined && styles.height(`${heights.phone}px`),
          )}
        />
      )}
      {wide && shown !== "phone" && (
        <DesktopFrame
          frameRef={desktop}
          height={heights.desktop}
          src={src}
          title={`${label}, desktop`}
        />
      )}
    </div>
  );
}
