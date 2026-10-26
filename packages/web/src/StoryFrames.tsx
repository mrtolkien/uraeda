// A story's frame, sandboxed without `allow-same-origin`, and the messages of its window. One frame,
// at the phone's width or the desktop's: a change of width resizes and rescales it, and never
// reloads it. It is drawn by the live window's frame (`LiveFrame`): at its real width, scaled to
// fit, at 100% in full screen. The frame is as tall as its story says, up to the theme's maximum,
// the phone's frame 50% taller. Its colour mode is sent when it says it is ready and when it
// changes, with pick mode, and its pick script reports the elements picked. It loads its story only
// once its box is on screen, then stays loaded.
import { useTheme } from "@astryxdesign/core/theme";
import { type RefObject, useEffect, useEffectEvent, useRef, useState } from "react";
import { bottomOf, keepPlace } from "./keepPlace.ts";
import { type Fit, LiveFrame } from "./LiveFrame.tsx";
import { frameMessage, heightOf, pickedOf } from "./frameMessages.ts";
import type { Picked } from "./storyComment.ts";

/** The widths a story is shown at: the phone's, 402 px, or the desktop's, 1440 px. */
export type Width = "phone" | "desktop";

const SANDBOX = "allow-scripts allow-popups";

/**
 * Gives the frame a new height with `resize`. A frame wholly above the window's top would move the
 * text read below it by the change: that text is kept in place (US7 2 of the spec redesign). Within
 * a pixel: a scaled frame's height is a fraction of one, and the place kept puts its bottom a
 * fraction below the top.
 */
function resizeKeepingPlace(stage: HTMLElement | null, resize: () => void) {
  if (!stage || stage.getBoundingClientRect().bottom >= 1) {
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
    const message = frameMessage(event.source, frame.current?.contentWindow, event.data);
    if (message === undefined) {
      return;
    }
    const source = event.source as Window;
    if (message.uraeda === "ready") {
      source.postMessage({ mode, uraeda: "mode" }, "*");
      if (pick.picking) {
        source.postMessage({ on: true, uraeda: "pick" }, "*");
      }
      pick.onReady();
    } else if (message.uraeda === "size") {
      const height = heightOf(message);
      if (height !== undefined) {
        resizeKeepingPlace(stage.current, () => setReported(height));
      }
    } else if (message.uraeda === "picked") {
      const picked = pickedOf(message);
      if (picked) {
        pick.onPicked(picked);
      }
    } else if (message.uraeda === "pick-stopped") {
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

/**
 * The story's frame, at `width`, scaled to fit, at 100% when `full`. An element picked names the
 * width it was picked at. `onFit` hears the frame's width and scale.
 */
export function StoryFrames({
  full = false,
  label,
  onFit,
  pick,
  src,
  width,
}: {
  full?: boolean;
  label: string;
  onFit?: (fit: Fit) => void;
  pick: PickMode;
  src: string;
  width: Width;
}) {
  const stage = useRef<HTMLDivElement>(null);
  const { frame, reported } = useFrame(
    { ...pick, onPicked: (picked) => pick.onPicked({ ...picked, width }) },
    stage,
  );
  return (
    <LiveFrame
      asked={reported}
      frame={frame}
      full={full}
      onFit={onFit}
      sandbox={SANDBOX}
      src={src}
      stage={stage}
      title={`${label}, ${width}`}
      width={width}
    />
  );
}
