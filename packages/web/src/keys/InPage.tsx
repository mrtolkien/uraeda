// The key picker's page mode (`KeyPicker`'s `inPage`), the theme picker's: its list alone, floating
// at the top of the page at every width (R6), on frosted glass, with no scrim, so the page itself
// is the preview. Left alone a second, it fades to 10%, and comes back on a key, a pointer move, or
// a press in it.
import { easeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import {
  type ReactNode,
  useCallback,
  useEffect,
  useEffectEvent,
  useLayoutEffect,
  useRef,
  useState,
} from "react";
import { glassStyles } from "../layout/glass.ts";

/** How long the in-page list waits, with no key and no pointer move, before it fades. */
const FADE_AFTER_MS = 1000;

const styles = stylex.create({
  // The in-page list, left alone a second: nearly gone, the page whole behind it.
  faded: { opacity: 0.1 },
  // The in-page list: narrow, at the top of the page, centred, the window's width less its margins
  // on a phone (R6). Over the page's own layers, the status line, the shell's bars, and the leader
  // menu; it fades out and back in over 200 ms, at once under reduced motion (C1).
  inPage: {
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    insetInlineStart: "50%",
    maxHeight: "var(--size-palette-height)",
    position: "fixed",
    top: spacingVars["--spacing-10"],
    transform: "translateX(-50%)",
    transitionDuration: {
      "@media (prefers-reduced-motion: reduce)": "0s",
      default: "200ms",
    },
    transitionProperty: "opacity",
    transitionTimingFunction: easeVars["--ease-standard"],
    width: `min(var(--size-palette-list), calc(100vw - 2 * ${spacingVars["--spacing-2"]}))`,
    zIndex: 10,
  },
});

/**
 * Whether the in-page list is faded, and what wakes it: after `FADE_AFTER_MS` with no key and no
 * pointer move it fades; a pointer move anywhere, or a key or a press in the list, brings it back
 * (C1): a phone's tap may send no move before it.
 */
function useFade(): [boolean, () => void] {
  const [isFaded, setFaded] = useState(false);
  const timer = useRef<number>(undefined);
  const arm = useCallback(() => {
    window.clearTimeout(timer.current);
    timer.current = window.setTimeout(() => setFaded(true), FADE_AFTER_MS);
  }, []);
  const wake = useCallback(() => {
    setFaded(false);
    arm();
  }, [arm]);
  useEffect(() => {
    arm();
    window.addEventListener("pointermove", wake);
    return () => {
      window.removeEventListener("pointermove", wake);
      window.clearTimeout(timer.current);
    };
  }, [arm, wake]);
  return [isFaded, wake];
}

/** Whether `event` happened outside the layer `box`. */
function isOutside(box: HTMLElement | null, event: Event) {
  return !box?.contains(event.target as Node);
}

/**
 * The in-page list's layer, drawn while it is open: a raw dialog, for Astryx's `Dialog` is always
 * modal, which would block the page that is the preview, and draw a scrim over it (an Astryx gap,
 * plan, Complexity tracking). A click outside it calls `onOutside`, as a dialog's tap outside does,
 * and the page does not act on that click; a press that sends none, as a phone's scroll starts,
 * leaves it open. The focus leaving it for the page, as Tab does, calls `onOutside` too: a layer left open without the focus
 * would hold every page key, its own Escape out of reach. Escape is the palette's, Back the
 * picker's history entry. As it closes, the focus goes back to where it was, unless a press or Tab
 * put it elsewhere.
 */
export function InPage({
  children,
  label,
  onOutside,
}: {
  children: ReactNode;
  label: string;
  onOutside: () => void;
}) {
  const layer = useRef<HTMLDivElement>(null);
  // Set as it closes, when its own focus return is no focus leaving it.
  const isClosing = useRef(false);
  const [isFaded, wake] = useFade();
  const clicked = useEffectEvent((event: MouseEvent) => {
    if (isOutside(layer.current, event)) {
      // The click closes the list alone: the page under it does not act on it.
      event.preventDefault();
      event.stopPropagation();
      onOutside();
    }
  });
  useEffect(() => {
    // A press outside keeps the focus in the list, so that only its click closes it: a phone's
    // scroll starts with a press and sends no mouse press nor click, and keeps the list open.
    const pressed = (event: MouseEvent) => {
      if (isOutside(layer.current, event)) {
        event.preventDefault();
      }
    };
    const onClick = (event: MouseEvent) => clicked(event);
    document.addEventListener("mousedown", pressed, true);
    document.addEventListener("click", onClick, true);
    return () => {
      document.removeEventListener("mousedown", pressed, true);
      document.removeEventListener("click", onClick, true);
    };
  }, []);
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const box = layer.current;
    return () => {
      isClosing.current = true;
      const now = document.activeElement;
      const lost = now === null || now === document.body || box?.contains(now);
      if (lost && before?.isConnected) {
        before.focus({ preventScroll: true });
      }
    };
  }, []);
  return (
    <div
      aria-label={label}
      onBlur={(event) => {
        // Where the focus went: none for a click on no control, which `onClick` hears.
        const to = event.relatedTarget as Node | null;
        if (!isClosing.current && to !== null && !layer.current?.contains(to)) {
          onOutside();
        }
      }}
      // Any key wakes the faded list, a letter as an arrow, and acts at once: the palette's field
      // still gets it.
      onKeyDownCapture={wake}
      onPointerDownCapture={wake}
      ref={layer}
      role="dialog"
      {...stylex.props(
        glassStyles.surface,
        glassStyles.floating,
        styles.inPage,
        isFaded && styles.faded,
      )}
    >
      {children}
    </div>
  );
}
