import { type RefObject, useLayoutEffect, useState } from "react";

/**
 * Whether a sticky element is stuck, held at its edge while what follows it scrolls under it.
 * `marker` is an empty box just before it in its parent's flow, where it would be unstuck: the
 * element is stuck once it is below that place. Measured on every scroll, of any scroller, and
 * resize, once a frame.
 */
export function useStuck(
  marker: RefObject<HTMLElement | null>,
  sticky: RefObject<HTMLElement | null>,
) {
  const [isStuck, setStuck] = useState(false);
  useLayoutEffect(() => {
    let frame = 0;
    const measure = () => {
      frame = 0;
      const place = marker.current?.getBoundingClientRect().top;
      const top = sticky.current?.getBoundingClientRect().top;
      setStuck(place !== undefined && top !== undefined && top - place > 0.5);
    };
    const later = () => {
      frame ||= requestAnimationFrame(measure);
    };
    measure();
    document.addEventListener("scroll", later, { capture: true, passive: true });
    window.addEventListener("resize", later, { passive: true });
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener("scroll", later, { capture: true });
      window.removeEventListener("resize", later);
    };
  }, [marker, sticky]);
  return isStuck;
}
