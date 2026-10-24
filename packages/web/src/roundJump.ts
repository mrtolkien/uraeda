// How the round's navigation brings a part of the page to the top, and finds the one there.
import { useEffect, useState } from "react";

/** An applicable question of a round, in the page's order: follow-ups at level 2. */
export type NavQuestion = { answered: boolean; id: string; level: 1 | 2; title: string };

function reducedMotion() {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;
}

/** A jump under way: the question it brings to the top, and what ends it. */
type Jump = { end: () => void; id: string };

/**
 * The jump under way in each document, until its page stops scrolling: a key pressed while the
 * page still scrolls goes on from it, not from the question passing by. It is the document's, as
 * the scroll it follows, and ends with the round's navigation.
 */
const jumps = new WeakMap<Document, Jump>();

/** Ends the document's jump, if one is under way. */
export function endJump() {
  jumps.get(document)?.end();
}

/**
 * Brings a question to the top of the screen, below the bar (its `scroll-margin-top`), and gives
 * its title the focus. Instant under reduced motion, or when `instant`.
 *
 * The jump ends when the browser says the scroll ended (`scrollend`), or, where it does not say,
 * 150 ms after the scroll's last move. A jump that does not scroll, or a browser that never says,
 * ends a second after its last move: a busy machine may start the scroll late.
 */
export function jumpTo(id: string, instant = false) {
  const section = document.getElementById(id);
  if (!section) {
    return;
  }
  endJump();
  const quiet = "onscrollend" in window ? 1000 : 150;
  let timer: ReturnType<typeof setTimeout> | undefined;
  const end = () => {
    clearTimeout(timer);
    window.removeEventListener("scroll", onScroll);
    window.removeEventListener("scrollend", end);
    if (jumps.get(document)?.end === end) {
      jumps.delete(document);
    }
  };
  const onScroll = () => {
    clearTimeout(timer);
    timer = setTimeout(end, quiet);
  };
  timer = setTimeout(end, 1000);
  jumps.set(document, { end, id });
  window.addEventListener("scroll", onScroll, { passive: true });
  window.addEventListener("scrollend", end);
  section.scrollIntoView?.({
    behavior: instant || reducedMotion() ? "auto" : "smooth",
    block: "start",
  });
  document.getElementById(`${id}-title`)?.focus({ preventScroll: true });
}

/** The question at the top, or the one a jump is bringing there. */
export function questionJumpedTo(ids: ReadonlyArray<string>) {
  const heading = jumps.get(document)?.id;
  return heading && ids.includes(heading) ? heading : questionAtTop(ids);
}

/**
 * The question at the top of the screen: the last one whose top has reached the line a jump puts
 * it on. None before the first question.
 */
export function questionAtTop(ids: ReadonlyArray<string>): string | undefined {
  let at: string | undefined;
  for (const id of ids) {
    const section = document.getElementById(id);
    if (!section) {
      continue;
    }
    const line = Number.parseFloat(getComputedStyle(section).scrollMarginTop) || 0;
    if (section.getBoundingClientRect().top <= line + 2) {
      at = id;
    }
  }
  return at;
}

/**
 * Runs once a sheet's scroll lock is gone: while a modal sheet is open the page cannot scroll, and
 * closing it puts the page back where it was, then returns the focus to the sheet's trigger.
 */
export function afterSheetCloses(run: () => void) {
  const start = performance.now();
  const tick = () => {
    if (document.body.style.position === "fixed" && performance.now() - start < 2000) {
      requestAnimationFrame(tick);
      return;
    }
    run();
  };
  requestAnimationFrame(tick);
}

/** The question, or part, at the top, followed while the page scrolls. */
export function useQuestionAtTop(ids: ReadonlyArray<string>, isActive: boolean) {
  const [at, setAt] = useState<string>();
  const key = ids.join(" ");
  useEffect(() => {
    if (!isActive) {
      return;
    }
    const list = key.split(" ");
    let frame: number | undefined;
    const update = () => {
      frame = undefined;
      setAt(questionAtTop(list));
    };
    const onScroll = () => {
      frame ??= requestAnimationFrame(update);
    };
    update();
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => {
      if (frame !== undefined) {
        cancelAnimationFrame(frame);
      }
      window.removeEventListener("scroll", onScroll);
    };
  }, [key, isActive]);
  return at;
}
