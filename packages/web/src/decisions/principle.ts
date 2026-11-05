// The principle picked on the decisions page: the principles share the constitution's one address,
// so the list marks the one the keys or a click picked, and the reader beside it scrolls to it.
import { useState } from "react";
import type { LedgerConstitution, LedgerPrinciple } from "./ConstitutionRegion.tsx";

/**
 * The principle the keys or a click picked, `index` among the list's first rows: the principles
 * share the constitution's one address, so the list marks it, and with the reader beside the list,
 * `pick` scrolls the reader to it. A row past them, a decision's, leaves it.
 */
export function usePrinciple(constitution: LedgerConstitution | null) {
  const [index, setIndex] = useState(0);
  const pick = (row: number, hasReader: boolean) => {
    const picked = constitution?.principles[row];
    if (constitution && picked) {
      setIndex(row);
      if (hasReader) {
        toPrinciple(constitution, picked);
      }
    }
  };
  return { index, pick };
}

/** How many frames the reader is waited for, as it turns to the constitution: about a second. */
const READER_FRAMES = 60;

/**
 * Scrolls the reader beside the list to `principle`'s heading, its top at the reader's top, once
 * the reader shows the constitution: it may be turning to it from a decision.
 */
function toPrinciple(constitution: LedgerConstitution, principle: LedgerPrinciple) {
  const heading = principle.blocks
    .map((id) => constitution.document.blocks[id])
    .find((block) => block?.kind === "heading");
  const anchor = heading?.anchor;
  if (!anchor) {
    return;
  }
  let frames = READER_FRAMES;
  const scroll = () => {
    const target = document
      .querySelector('article[aria-label="Constitution"]')
      ?.querySelector<HTMLElement>(`[id="${CSS.escape(anchor)}"]`);
    if (!target) {
      if (frames-- > 0) {
        requestAnimationFrame(scroll);
      }
      return;
    }
    const reader = scrollerOf(target);
    if (reader) {
      const top =
        target.getBoundingClientRect().top - reader.getBoundingClientRect().top + reader.scrollTop;
      reader.scrollTo({
        behavior: smooth(),
        top: top - Number.parseFloat(getComputedStyle(target).scrollMarginTop || "0"),
      });
    }
  };
  requestAnimationFrame(scroll);
}

/** The box that scrolls `element`, below the document: the reader's own. */
function scrollerOf(element: HTMLElement): HTMLElement | null {
  for (let at = element.parentElement; at && at !== document.body; at = at.parentElement) {
    if (/(auto|scroll)/.test(getComputedStyle(at).overflowY) && at.scrollHeight > at.clientHeight) {
      return at;
    }
  }
  return null;
}

/** Smooth, unless the human asks for less motion. */
function smooth(): ScrollBehavior {
  return window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ? "auto" : "smooth";
}
