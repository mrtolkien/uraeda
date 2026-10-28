// The detail of a priority or a note, in the shared overlay over the page the line was opened
// from: a dialog of 108 characters wide and 60% of the window tall on wide screens, a bottom sheet
// on the phone, with Close, and on the line's own address. The page stays drawn under it, so its
// selection and its scroll are kept.
//
// The history: opening is one entry, the overlay's, which Back goes over; `openDetail` pushes it
// for a click, and an address opened any other way, by a link, a reload, or Forward, is given one
// by `DetailHost`. Previous and Next replace the entry, so they add none.
import { useToast } from "@astryxdesign/core/Toast";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense, useEffect, useLayoutEffect, useRef, useState } from "react";
import { Overlay } from "../layout/Overlay.tsx";
import { openOverlayAt, overlayOf } from "../layout/useBackCloses.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { currentEntry, parseLocation, redirect, useRepoPath } from "../routes.tsx";

/** The overlay's size on wide screens: the theme's, 108 characters wide and 60% of the window tall. */
const SIZE = { height: "var(--size-detail-height)", width: "var(--size-detail)" };

const styles = stylex.create({
  // On wide screens the dialog is as tall as its largest, whatever its content: the header and the
  // dialog's padding take the rest.
  // The dialog clips what is taller, so the body scrolls on its own.
  tall: {
    height: `calc(var(--size-detail-height) - ${spacingVars["--spacing-12"]})`,
    overflowY: "auto",
  },
});

/** What an overlay's history entry is named by, and what its dialog is titled. */
export type DetailKind = { label: "Priority"; page: "task" };

export const PRIORITY: DetailKind = { label: "Priority", page: "task" };

/**
 * Opens the line at `href` in its overlay, from a click or Enter on its card: one history entry,
 * the overlay's, so Back closes it, without what the page's own entry says of where it came from.
 */
export function openDetail(href: string, kind: DetailKind) {
  openOverlayAt(href, kind.label, { from: undefined });
}

/**
 * Closes the overlay of the line shown now, from the line's own action, like its delete: going
 * back over its history entry, which closes it; without one, the page `list` in its place.
 */
export function closeDetail(list: string) {
  if (overlayOf(window.history.state) === undefined) {
    redirect(list);
  } else {
    window.history.back();
  }
}

/** The element that scrolls an element's content: itself or its nearest ancestor that does. */
function scroller(element: Element | null) {
  for (let node = element; node; node = node.parentElement) {
    if (
      /auto|scroll/.test(getComputedStyle(node).overflowY) &&
      node.scrollHeight > node.clientHeight
    ) {
      return node;
    }
  }
  return null;
}

/**
 * The detail overlay, open: `onClose` is called once Back has gone over its entry. Another
 * `line`, as Previous and Next show it, is read from its top, not where the last was read.
 */
export function DetailOverlay({
  children,
  label,
  line,
  onClose,
}: {
  children: ReactNode;
  label: string;
  line?: string;
  onClose: () => void;
}) {
  const wide = !isNarrow(useWidthClass());
  const body = useRef<HTMLDivElement>(null);
  const shown = useRef(line);
  useLayoutEffect(() => {
    if (shown.current !== line) {
      const scrolling = scroller(body.current);
      if (scrolling) {
        scrolling.scrollTop = 0;
      }
      // The button that stepped is gone with the line it was in: the focus stays in the overlay,
      // so Escape still closes it.
      if (!document.activeElement || document.activeElement === document.body) {
        // The overlay's first control, its Close, as Astryx puts the focus when it opens.
        body.current?.closest('dialog, [role="dialog"]')?.querySelector("button")?.focus();
      }
    }
    shown.current = line;
  }, [line]);
  return (
    <Overlay isOpen label={label} onClose={onClose} size={SIZE}>
      <div ref={body} {...stylex.props(wide && styles.tall)}>
        <Suspense fallback={null}>{children}</Suspense>
      </div>
    </Overlay>
  );
}

/**
 * The detail overlay of the line `entryKey` of the page `list`, a path within the repository, once
 * `exists` says whether the line is there (`undefined` while it is read). A line the address names
 * that is not there shows the page and says `gone`, at the list's address. The overlay stays open
 * on the lines of one address after another, as Previous and Next, or a rename, change it.
 */
export function DetailHost({
  children,
  entryKey,
  exists,
  gone,
  kind,
  list,
}: {
  children: ReactNode;
  entryKey: string;
  exists: boolean | undefined;
  gone: string;
  kind: DetailKind;
  list: string;
}) {
  const here = useRepoPath();
  const showToast = useToast();
  // Whether the line was there when its address came up: a line deleted from its own overlay is
  // gone for a moment before Back closes it, and that is no news.
  const [arrived, setArrived] = useState<{ key: string; there: boolean }>();
  if (exists !== undefined && arrived?.key !== entryKey) {
    setArrived({ key: entryKey, there: exists });
  }
  const there = arrived?.key === entryKey && arrived.there;
  const missing = arrived?.key === entryKey && !arrived.there;

  // An address opened by a link or a reload has no overlay entry yet: it is given one, before the
  // overlay would push its own, so it has the page's state, and Back goes over it once.
  useLayoutEffect(() => {
    if (there && overlayOf(window.history.state) !== kind.label) {
      openOverlayAt(`${window.location.pathname}${window.location.search}`, kind.label);
    }
  }, [there, kind.label]);

  useEffect(() => {
    if (missing) {
      showToast({ autoHideDuration: 5000, body: gone });
      redirect(here(list));
    }
  }, [missing, showToast, gone, here, list]);

  // Back landed on the line's own entry, which holds no overlay: the page is its list, or the page
  // it was opened from, home, one entry further back. Landing on the list itself is no news.
  const close = () => {
    if (parseLocation(window.location.pathname).route.page !== kind.page) {
      return;
    }
    if (currentEntry().from === "/") {
      window.history.back();
    } else {
      redirect(here(list));
    }
  };
  return there ? (
    <DetailOverlay label={kind.label} line={entryKey} onClose={close}>
      {children}
    </DetailOverlay>
  ) : null;
}
