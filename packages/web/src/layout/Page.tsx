import * as stylex from "@stylexjs/stylex";
import { borderVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { createContext, type ReactNode, type RefObject, useCallback, useRef } from "react";
import { paneVars } from "./pane.stylex.ts";
import { useScreenCentre } from "./useScreenCentre.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  page: {
    // One inset on the phone, from the screen's edges, the phone sidebar's own (the rail's, and its
    // edge's width), so the panes at the page's edge sit as the sidebar's do; the reading column in the
    // middle of a wide screen. Text wraps anywhere rather than scroll the page sideways.
    // `--page-inset` is the inset at the sides, and `--page-bleed` takes it back, for what reaches
    // the screen's edges.
    "--page-bleed": `calc(-1 * (var(--size-rail-inset) + ${borderVars["--border-width"]}))`,
    "--page-inset": `calc(var(--size-rail-inset) + ${borderVars["--border-width"]})`,
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: "var(--page-inset)",
    width: "100%",
  },
  session: {
    // A session's column on wide screens: about 115 characters a line, not the page's full width.
    maxWidth: "var(--size-session-max)",
  },
  // A document's page on wide screens, a round's or a spec's: each of its panes a pane of prose
  // wide at most, its prose about 80 characters a line and ending at its border, while two side by
  // side share the page's width, each up to that (see `Pane`). A wide table scrolls in its pane,
  // and a mockup's window grows past it (`PageColumn`).
  reading: {
    // Each pane as wide as its room up to that, centred in it: the page's middle.
    "--pane-centre": "auto",
    "--pane-max": paneVars["--pane-prose"],
    "--pane-width": "100%",
  },
  // A draft's editor on wide screens: its panes hold the file's text in the UI's monospace font,
  // not prose, up to 95 of its characters.
  writing: { "--pane-max": paneVars["--pane-code"] },
  // A round's page on wide screens: as wide as two of its panes side by side, as its Scope and
  // Sources are, so that a question's card, its question beside its answers, takes both.
  paired: {
    maxWidth: `calc(2 * ${paneVars["--pane-prose"]} + ${spacingVars["--spacing-4"]} + 2 * var(--page-inset))`,
  },
  // The whole width of the window, for a page of columns.
  full: { maxWidth: "none" },
  snug: {
    // On the phone, `--spacing-2` (9.6 px), for a page that is read as text from edge to edge: a
    // session.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-2"]})`,
    "--page-inset": spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-3"],
  },
  tight: {
    // On the phone, `--spacing-3` (14.4 px) at the sides, past the sidebar's own: the sessions'
    // page of cards.
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-3"]})`,
    "--page-inset": spacingVars["--spacing-3"],
    paddingBlock: spacingVars["--spacing-3"],
  },
  wide: {
    "--page-bleed": `calc(-1 * ${spacingVars["--spacing-8"]})`,
    "--page-inset": spacingVars["--spacing-8"],
    paddingBlock: spacingVars["--spacing-6"],
  },
});

/**
 * The page's column, for what may grow past it into the space beside it, as a story's embed does:
 * null outside a page.
 */
export const PageColumn = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * A page's content: its inset, and its column on wide screens, or with `isFull` the window's whole
 * width. On the phone, `isTight` gives it `--spacing-3`, the sessions' page's inset, and `isSnug`
 * `--spacing-2`, a session's.
 */
export function Page({
  children,
  isFull = false,
  isPaired = false,
  isReading = false,
  isSession = false,
  isSnug = false,
  isTight = false,
  isWriting = false,
}: {
  children: ReactNode;
  /** The window's whole width, not the page's column: a page of columns, the priorities'. */
  isFull?: boolean;
  /** A round's page on wide screens: as wide as two context panes side by side. */
  isPaired?: boolean;
  /** A document's page on wide screens, a round's or a spec's: each pane a pane of prose at most. */
  isReading?: boolean;
  /** A session's column on wide screens: a line of text, not the page's full width. */
  isSession?: boolean;
  isSnug?: boolean;
  isTight?: boolean;
  /** A draft's editor on wide screens: a reading page whose panes are 95 characters wide at most. */
  isWriting?: boolean;
}) {
  const wide = !isNarrow(useWidthClass());
  const column = useRef<HTMLDivElement>(null);
  // On a wide screen, the column sits in the screen's middle where its margins leave room.
  const centred = useScreenCentre(wide && !isFull);
  const placed = useCallback(
    (element: HTMLDivElement | null) => {
      column.current = element;
      return centred(element);
    },
    [centred],
  );
  return (
    <PageColumn value={column}>
      <div
        ref={placed}
        {...stylex.props(
          styles.page,
          isTight && styles.tight,
          isSnug && styles.snug,
          wide && styles.wide,
          isFull && styles.full,
          wide && isSession && styles.session,
          wide && (isReading || isWriting) && styles.reading,
          wide && isWriting && styles.writing,
          wide && isPaired && styles.paired,
        )}
      >
        {children}
      </div>
    </PageColumn>
  );
}
