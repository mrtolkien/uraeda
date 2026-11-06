import { type RefObject, useEffect } from "react";

/** The room kept between the box's end and the keyboard. */
const ROOM_PX = 8;

/**
 * How far the page scrolls so a box whose end is at `bottom` shows above the keyboard, in a
 * visual viewport `height` tall from `offsetTop`, of a window `screen` tall: none while no keyboard
 * shows, or while the box's end is already above it.
 */
export function scrollAboveKeyboard(
  bottom: number,
  { height, offsetTop }: { height: number; offsetTop: number },
  screen: number,
) {
  if (height >= screen) {
    return 0;
  }
  return Math.max(0, bottom - (offsetTop + height - ROOM_PX));
}

/**
 * While the focus is in `box` and the phone's keyboard is up, scrolls the page so the box's end,
 * where its buttons are, as a composer's Send, shows above the keyboard: as the keyboard opens, as
 * the box grows, and as it takes the focus. iOS scrolls the caret into view, never what is under
 * it. Off when `isOn` is false.
 */
export function useAboveKeyboard(box: RefObject<HTMLElement | null>, isOn: boolean) {
  useEffect(() => {
    const element = box.current;
    const viewport = window.visualViewport;
    if (!isOn || !element || !viewport || typeof ResizeObserver === "undefined") {
      return undefined;
    }
    let frame = 0;
    const keep = () => {
      cancelAnimationFrame(frame);
      // After the box has laid out what the focus opened, as a folded composer's buttons.
      frame = requestAnimationFrame(() => {
        if (!element.contains(document.activeElement)) {
          return;
        }
        const by = scrollAboveKeyboard(
          element.getBoundingClientRect().bottom,
          viewport,
          window.innerHeight,
        );
        if (by > 0) {
          window.scrollBy({ top: by });
        }
      });
    };
    const observer = new ResizeObserver(keep);
    observer.observe(element);
    element.addEventListener("focusin", keep);
    viewport.addEventListener("resize", keep);
    return () => {
      cancelAnimationFrame(frame);
      observer.disconnect();
      element.removeEventListener("focusin", keep);
      viewport.removeEventListener("resize", keep);
    };
  }, [box, isOn]);
}
