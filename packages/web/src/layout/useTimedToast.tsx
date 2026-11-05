// A toast that hides on its own after its time, unless the human is at it: its time stops while
// the pointer is over it, while the focus is inside it, or while the window is away, and goes on
// when all of these have left (WCAG 2.2.1, a time limit the human can extend). Every timed toast
// of the app goes through it: the undo toast's 5 seconds, and the short notices.
import { useToast } from "@astryxdesign/core/Toast";
import type { ToastDismissFn, ToastOptions } from "@astryxdesign/core/Toast";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useCallback, useEffect, useEffectEvent, useRef } from "react";

/** What a toast has left when its time goes on again, at least, in ms: enough to reach it. */
export const RESUME_MS = 2000;

const styles = stylex.create({
  // The body as the toast lays it out: this element only finds its toast and holds its time.
  timed: { display: "contents" },
});

/**
 * Holds a toast's time: `onEnd` after `duration` ms on screen, not counting the time the pointer
 * is over the toast, the focus is inside it, or the window is away. Astryx's own timer pauses on
 * each of these too, but one leaving resumes it while another still holds, as a pointer leaving a
 * toast whose Undo still has the focus.
 */
function Timed({
  children,
  duration,
  onEnd,
}: {
  children: ReactNode;
  duration: number;
  onEnd: () => void;
}) {
  const own = useRef<HTMLSpanElement>(null);
  const end = useEffectEvent(onEnd);
  useEffect(() => {
    const toast = own.current?.closest<HTMLElement>('[role="status"], [role="alert"]');
    if (!toast) {
      return;
    }
    let left = duration;
    let started = 0;
    let timer: ReturnType<typeof setTimeout> | undefined;
    let isHovered = toast.matches(":hover");
    let isFocused = toast.matches(":focus-within");
    let isAway = false;
    const run = () => {
      const isHeld = isHovered || isFocused || isAway;
      if (isHeld && timer !== undefined) {
        clearTimeout(timer);
        timer = undefined;
        left = Math.max(left - (Date.now() - started), RESUME_MS);
      } else if (!isHeld && timer === undefined) {
        started = Date.now();
        timer = setTimeout(() => end(), left);
      }
    };
    const hovered = (is: boolean) => () => {
      isHovered = is;
      run();
    };
    const focused = (event: FocusEvent) => {
      isFocused = event.type === "focusin" || toast.contains(event.relatedTarget as Node | null);
      run();
    };
    const away = (is: boolean) => () => {
      isAway = is;
      run();
    };
    const stop = new AbortController();
    const until = { signal: stop.signal };
    toast.addEventListener("pointerenter", hovered(true), until);
    toast.addEventListener("pointerleave", hovered(false), until);
    toast.addEventListener("focusin", focused, until);
    toast.addEventListener("focusout", focused, until);
    window.addEventListener("blur", away(true), until);
    window.addEventListener("focus", away(false), until);
    run();
    return () => {
      clearTimeout(timer);
      stop.abort();
    };
  }, [duration]);
  return (
    <span ref={own} {...stylex.props(styles.timed)}>
      {children}
    </span>
  );
}

/**
 * Shows a toast that hides after `autoHideDuration` ms of being left alone, as `useToast`'s does,
 * but held while the human is at it (`Timed`). Returns the function that closes it.
 */
export function useTimedToast(): (
  options: ToastOptions & { autoHideDuration: number },
) => ToastDismissFn {
  const showToast = useToast();
  return useCallback(
    ({ autoHideDuration, body, ...options }) => {
      let dismiss: ToastDismissFn = () => {};
      dismiss = showToast({
        ...options,
        body: (
          <Timed duration={autoHideDuration} onEnd={() => dismiss()}>
            {body}
          </Timed>
        ),
        isAutoHide: false,
      });
      return dismiss;
    },
    [showToast],
  );
}
