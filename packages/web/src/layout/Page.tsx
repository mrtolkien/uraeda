import * as stylex from "@stylexjs/stylex";
import { borderVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import { createContext, type ReactNode, type RefObject, useCallback, useRef } from "react";
import { useScreenCentre } from "./useScreenCentre.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  page: {
    // One inset on the phone, from the screen's edges, the phone sidebar's own (the rail's, and its
    // edge's width), so the panes at the page's edge sit as the sidebar's do; on wider screens, the
    // page's kind gives it its column, from the theme's scale of widths, in the middle of the room
    // right of the sidebar. Text wraps anywhere rather than scroll the page sideways.
    // `--page-inset` is the inset at the sides, and `--page-bleed` takes it back, for what reaches
    // the screen's edges.
    "--page-bleed": `calc(-1 * (var(--size-rail-inset) + ${borderVars["--border-width"]}))`,
    "--page-inset": `calc(var(--size-rail-inset) + ${borderVars["--border-width"]})`,
    boxSizing: "border-box",
    marginInline: "auto",
    // Its kind's column, its inset included: none on the phone.
    maxWidth: "var(--page-column)",
    overflowWrap: "anywhere",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: "var(--page-inset)",
    width: "100%",
  },
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

/** Each kind's column on semi-wide and wide screens, its inset at each side included. */
const kinds = stylex.create({
  // A document's page, a round's or a spec's: two reading panes wide, so a split question card, a
  // decision card, or a live window has room to grow past a pane; each of its panes a reading pane
  // at most, its prose about 80 characters a line and ending at its border, centred in the page
  // (see `Pane`). Its title and crumbs start at its panes' edge (`PageTitle`, `Crumbs`).
  reading: {
    "--page-column": "calc(var(--size-two-panes) + 2 * var(--page-inset))",
    "--page-text-centre": "auto",
    "--page-text-max": "var(--size-reading-pane)",
    "--pane-centre": "auto",
    "--pane-max": "var(--size-reading-pane)",
    "--pane-width": "100%",
  },
  // A page of rows, as the inbox or a feature: its text column a reading pane, and what sits beside
  // its text, as settings' controls (`beside`).
  rows: {
    "--page-column":
      "calc(var(--size-reading-pane) + var(--page-beside, 0px) + 2 * var(--page-inset))",
  },
  // Two reading panes side by side and the gap between them, as the home and New.
  panes: {
    "--page-column": "calc(var(--size-two-panes) + 2 * var(--page-inset))",
  },
  // The whole width of the window, for a page of columns.
  window: { "--page-column": "none" },
  // A draft's editor: its panes hold the file's text in the UI's monospace font, not prose, up to
  // the formatter's 100 columns of it, centred as a reading page's, and the page as wide as that
  // pane and its Start beside it, 22rem, where the screen has the room.
  code: {
    "--pane-centre": "auto",
    "--pane-max": "var(--size-code)",
    "--pane-width": "100%",
    maxWidth: `calc(var(--size-code) + 22rem + ${spacingVars["--spacing-4"]} + 2 * var(--page-inset))`,
  },
  // A session's column: 95 characters of the UI's font, not the window's width.
  session: { "--page-column": "var(--size-session-max)" },
});

const besides = stylex.create({
  // What sits beside a page of rows' text column: a theme token's width.
  of: (width: string) => ({ "--page-beside": width }),
});

const text = stylex.create({
  // What a page draws outside its panes, as its title, crumbs, and opening lines: from its panes'
  // left edge, as wide as they are, on a reading page (`kinds.reading`); the page's width
  // elsewhere.
  column: {
    marginInline: "var(--page-text-centre, 0)",
    maxWidth: "var(--page-text-max, none)",
    width: "100%",
  },
});

/** The style of what a page draws outside its panes, from its panes' left edge (`text`). */
export const pageText = text.column;

/** What a page holds, which picks its width from the theme's scale (see `kinds`). */
export type PageKind = keyof typeof kinds;

/**
 * The page's column, for what may grow past it into the space beside it, as a story's embed does:
 * null outside a page.
 */
export const PageColumn = createContext<RefObject<HTMLDivElement | null> | null>(null);

/**
 * A page's content: its inset, and on semi-wide and wide screens its column, by its `kind`, in the
 * middle of the room right of the sidebar. On the phone, `isTight` gives it `--spacing-3`, the
 * sessions' page's inset, and `isSnug` `--spacing-2`, a session's.
 */
export function Page({
  beside,
  children,
  isSnug = false,
  isTight = false,
  kind,
}: {
  /** A page of rows': the theme's width of what sits beside its text, as settings' controls. */
  beside?: `--size-${string}`;
  children: ReactNode;
  isSnug?: boolean;
  isTight?: boolean;
  /**
   * What it holds: `reading`, a document's panes of prose; `rows`, a page of rows; `panes`, two
   * panes side by side; `window`, columns across the window; `code`, a draft's file; `session`, a
   * session's transcript.
   */
  kind: PageKind;
}) {
  const wide = !isNarrow(useWidthClass());
  const column = useRef<HTMLDivElement>(null);
  // On a wide screen, the column sits in the room's middle where its margins leave room.
  const centred = useScreenCentre(wide && kind !== "window");
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
          wide && kinds[kind],
          wide && beside !== undefined && besides.of(`var(${beside})`),
        )}
      >
        {children}
      </div>
    </PageColumn>
  );
}
