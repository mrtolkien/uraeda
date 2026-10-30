import { useEffect, useState } from "react";

/**
 * How much of the screen's bottom the phone's keyboard covers, in pixels: what the visual viewport
 * leaves out under it. None where the browser does not say.
 */
export function useKeyboardInset() {
  const [inset, setInset] = useState(0);
  useEffect(() => {
    const viewport = window.visualViewport;
    if (!viewport) {
      return undefined;
    }
    const measure = () =>
      setInset(Math.max(0, window.innerHeight - viewport.height - viewport.offsetTop));
    measure();
    viewport.addEventListener("resize", measure);
    viewport.addEventListener("scroll", measure);
    return () => {
      viewport.removeEventListener("resize", measure);
      viewport.removeEventListener("scroll", measure);
    };
  }, []);
  return inset;
}
