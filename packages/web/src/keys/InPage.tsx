// The key picker's page mode (`KeyPicker`'s `inPage`), the theme picker's: its list alone, floating
// at the top of the page at every width (R6), on frosted glass, with no scrim, so the page itself
// is the preview. Left alone a second, it fades to 10%, and comes back on a key or a pointer move.
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
 * pointer move it fades; a pointer move anywhere, or a key in the list, brings it back (C1).
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

/**
 * The in-page list's layer, drawn while it is open: a raw dialog, for Astryx's `Dialog` is always
 * modal, which would block the page that is the preview, and draw a scrim over it (an Astryx gap,
 * plan, Complexity tracking). A press outside it calls `onOutside`, as a dialog's tap outside does;
 * Escape is the palette's, Back the picker's history entry. As it closes, the focus goes back to
 * where it was, unless a press outside put it elsewhere.
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
  const [isFaded, wake] = useFade();
  const outside = useEffectEvent((event: PointerEvent) => {
    if (!layer.current?.contains(event.target as Node)) {
      onOutside();
    }
  });
  useEffect(() => {
    const onDown = (event: PointerEvent) => outside(event);
    document.addEventListener("pointerdown", onDown, true);
    return () => document.removeEventListener("pointerdown", onDown, true);
  }, []);
  useLayoutEffect(() => {
    const before = document.activeElement as HTMLElement | null;
    const box = layer.current;
    return () => {
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
      // Any key wakes the faded list, and acts at once: the palette's field still gets it.
      onKeyDownCapture={wake}
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
