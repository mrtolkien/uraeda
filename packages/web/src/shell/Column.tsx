// The shell's column, on semi-wide and wide screens: its heading, New and Note, the search, then
// the panes, Navigate and the work, and at its foot the 5 h window and Settings. Wide, it is 14% of
// the window until its edge is dragged, folds to its 52 px rail from its button or `[`, its width
// easing over 200 ms; semi-wide, it is the rail, which opens over the page (`Rail.tsx`). An Astryx
// gap (plan, Complexity tracking): `SideNav` folds to icons, but cannot open over the page.
import { ResizeHandle } from "@astryxdesign/core/Resizable";
import {
  borderVars,
  colorVars,
  easeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useMemo, useRef, useState } from "react";
import { useKeys } from "../keys/registry.tsx";
import { SearchField, useSessionQuery } from "../sidebar/Search.tsx";
import { ColumnActions, ColumnFoot, ColumnHeading, Navigate } from "./ColumnPanes.tsx";
import { useColumnWidth } from "./columnWidth.ts";
import { ColumnFoldContext } from "./fold.ts";
import { LogoButton, useRail } from "./Rail.tsx";
import { ShellPanes, useShellPath } from "./ShellPanes.tsx";

const styles = stylex.create({
  easing: {
    // The width eases as the column folds or unfolds, never while its edge is dragged.
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "width",
    transitionTimingFunction: easeVars["--ease-standard"],
  },
  nav: {
    // Its panes' narrow inset: their rows carry their own, and a row's label, such as Priorities
    // beside its count and its ＋, keeps its room in the 256 px column.
    "--pane-inset": "var(--size-rail-inset)",
    // As tall as the window: its heading and foot stay, and the panes between them scroll.
    backgroundColor: colorVars["--color-background-body"],
    borderInlineEndColor: colorVars["--color-border"],
    borderInlineEndStyle: "solid",
    borderInlineEndWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-2"],
    insetBlock: 0,
    insetInlineStart: 0,
    overflow: "hidden",
    // The rail's icons centred in its 52 px, and the column's rows on the same edge.
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: "var(--size-rail-inset)",
    position: "absolute",
    width: "100%",
  },
  over: {
    // Open over the page, above it.
    zIndex: 3,
  },
  phone: {
    // The phone's column, between its tabs and its status line, which both stay in view. It opens
    // and closes as the desktop's does, a reveal from its start edge over 200 ms, its content laid
    // out at the open width throughout.
    insetBlockEnd: "var(--size-status-line)",
    insetBlockStart: spacingVars["--spacing-12"],
    position: "fixed",
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "clip-path, visibility",
    transitionTimingFunction: easeVars["--ease-standard"],
    width: "min(400px, 100vw)",
    zIndex: 3,
  },
  phoneOpen: {
    clipPath: "inset(0)",
    transitionDelay: "0s, 0s",
    visibility: "visible",
  },
  phoneClosed: {
    // Out of the tab order and the screen readers' reach once it has closed.
    clipPath: "inset(0 100% 0 0)",
    transitionDelay: { "@media (prefers-reduced-motion: reduce)": "0s, 0s", default: "0s, 200ms" },
    visibility: "hidden",
  },
  place: {
    // The column's place beside the page, in view while the window scrolls.
    alignSelf: "flex-start",
    flexShrink: 0,
    height: "var(--size-viewport-height)",
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  rail: {
    width: "var(--size-rail)",
  },
  // The column's content: laid out at the open column's width, always, so that a rail only clips it
  // and nothing moves as it opens; the nav's padding and edge take the rest of its width.
  inner: {
    display: "flex",
    flexDirection: "column",
    flexGrow: 1,
    gap: spacingVars["--spacing-2"],
    minHeight: 0,
  },

  // In the rail, the panes' own border and inset are left of the icons' column: the rows move back
  // over it, so that their icons stand under the heading's.
  scrollRail: {
    // The cards' icons stand under the nav rows': 16 px from the rail's edge.
    // Out to the nav's edge, so the separators run the rail's whole width.
    marginInlineStart: "calc(-1 * var(--size-rail-inset))",
    paddingInlineStart: "var(--size-rail-inset)",
    transform: "translateX(-3px)",
  },
  scroll: {
    flexGrow: 1,
    minHeight: 0,
    overscrollBehavior: "contain",
    // A thin bar that shows only while the pointer is over the column, its room kept, so that the
    // content never shifts.
    scrollbarColor: {
      ":hover": `${colorVars["--color-border"]} transparent`,
      default: "transparent transparent",
    },
    scrollbarWidth: "thin",
    overflowX: "hidden",
    overflowY: "auto",
  },
  scrollFolded: {
    // The rail's icons fade out at its foot, where the list scrolls on, instead of showing an
    // icon's sliver there: the last icon scrolls up clear of the fade.
    maskImage: `linear-gradient(to bottom, black calc(100% - ${spacingVars["--spacing-6"]}), transparent)`,
    paddingBlockEnd: spacingVars["--spacing-6"],
  },
});

const widths = stylex.create({
  of: (width: number) => ({ width }),
  // The open column's content width: its width less the nav's padding and edge.
  content: (width: number) => ({
    width: `calc(${width}px - 2 * var(--size-rail-inset) - 1px)`,
  }),
});

/** In the closed rail: the panes keep their top line as a separator, each card a bar, and its status shows. */
const RAIL_CSS = `nav[data-rail="closed"] section {
  border-inline-color: transparent !important;
  border-block-end-color: transparent !important;
  border-block-start-color: transparent !important;
}
nav[data-rail="closed"] section::before {
  border-block-start: 1px solid var(--color-border);
  content: "";
  inset-block-start: calc(-1 * var(--pane-border, 1px));
  inset-inline: -40px -40px;
  pointer-events: none;
  position: absolute;
}
nav[data-rail="closed"] [data-card] { overflow: visible !important; }
nav[data-rail="closed"] [data-card]::after {
  border: 1px solid var(--color-border);
  content: "";
  inset-block: 0;
  inset-inline-start: -4px;
  pointer-events: none;
  position: absolute;
  width: 38px;
}
nav[data-rail="closed"] section[data-tone="attention"] [data-card]::after { border-color: var(--color-border-orange); }
nav[data-rail="closed"] [data-card][data-rail-mark-only] [data-rail-only] { bottom: 0; height: fit-content; margin-block: auto; top: 0 !important; }
nav[data-rail="closed"] [data-card][data-rail-mark-only] a > span:first-child { visibility: hidden; }
nav[data-rail="closed"] h2, nav[data-rail="closed"] h3 { visibility: hidden; }
nav[data-rail="closed"] .astryx-side-nav-item { width: 38px !important; min-width: 0; overflow: hidden; justify-content: center; padding-inline: 0; }
nav[data-rail="closed"] section .astryx-side-nav-item { margin-inline-start: -4px; }
nav[data-rail="closed"] div.astryx-side-nav-item { padding-inline: 0 !important; }
nav[data-rail="closed"] div.astryx-side-nav-item > a { flex: 1; gap: 0; justify-content: center; }
nav[data-rail="closed"] [data-rail-fit] { justify-content: start !important; padding-inline: 11.5px 0 !important; }
nav [data-rail-fit] .astryx-icon, nav [data-rail-fit] svg { font-size: 20px; height: 20px; width: 20px; }
nav[data-rail="closed"] [data-rail-only] { display: flex !important; }
nav[data-rail="closed"] [data-rail-fit] { width: 38px !important; min-width: 0; overflow: hidden; }
nav[data-rail="closed"] .astryx-side-nav-item > :not(:first-child), nav[data-rail="closed"] div.astryx-side-nav-item > a > :not(:first-child),
nav[data-rail="closed"] [data-rail-foot] section { display: none !important; }
nav[data-rail="closed"] [data-card] a > :not(:first-child) { visibility: hidden; }`;

/** The width a rail opens to over the page, in px: it shows on hover only, so it is roomy. */
const OPEN_RAIL_PX = 400;

/** The milliseconds the width eases over as the column folds or unfolds. */
const FOLD_MS = 200;

/**
 * The phone's column, which the tabs' toggle opens over the page, up to 400 px wide, under the tabs
 * and above the status line: the whole column, as the open rail draws it, never folded.
 */
export function PhoneColumn({ isOpen }: { isOpen: boolean }) {
  const pathname = useShellPath();
  const { query } = useSessionQuery();
  const fold = useMemo(() => ({ isFolded: false, toggle: () => {} }), []);
  return (
    <ColumnFoldContext value={fold}>
      <nav
        aria-label="Navigation"
        {...stylex.props(styles.nav, styles.phone, isOpen ? styles.phoneOpen : styles.phoneClosed)}
      >
        <div {...stylex.props(styles.inner)}>
          <ColumnHeading isRevealed />
          <ColumnActions />
          <div {...stylex.props(styles.scroll)}>
            <ShellPanes before={<Navigate pathname={pathname} />} isFitted query={query} />
          </div>
          <ColumnFoot pathname={pathname} />
        </div>
      </nav>
    </ColumnFoldContext>
  );
}

export function Column({ isWide }: { isWide: boolean }) {
  const column = useColumnWidth();
  const nav = useRef<HTMLElement>(null);
  const logo = useRef<HTMLButtonElement>(null);
  // In the page's flow, the column takes the rail's room, folded or semi-wide.
  const isRail = !isWide || column.isFolded;
  const rail = useRail(isRail, nav, logo);
  const pathname = useShellPath();
  const { query } = useSessionQuery();
  const [easing, setEasing] = useState(false);
  const { toggle: toggleStored } = column;
  // A rail shows its icons until the mouse rests on it, which opens it over the page, wide or not.
  const isClosed = isRail && !rail.isOpen;
  const openWidth = isRail ? Math.max(column.width, OPEN_RAIL_PX) : column.width;
  const fold = useMemo(
    () => ({
      // Always drawn open: a closed rail clips the open column, so the rows never move.
      isFolded: false,
      toggle: () => {
        setEasing(true);
        setTimeout(() => setEasing(false), FOLD_MS);
        toggleStored();
      },
    }),
    [toggleStored],
  );
  // The fold is the column's own key, wide only: the leader's `u [` is the same, named in full.
  useKeys(
    isWide
      ? [
          { hint: "[", keys: "[", label: "fold", run: fold.toggle },
          {
            icon: "uraeda:panel-left",
            keys: "space u [",
            label: "Fold navigation",
            run: fold.toggle,
          },
        ]
      : [],
    "shell",
  );
  return (
    <ColumnFoldContext value={fold}>
      <div
        {...stylex.props(
          styles.place,
          isRail ? styles.rail : widths.of(column.width),
          easing && styles.easing,
        )}
      >
        <nav
          aria-label="Navigation"
          data-rail={isClosed ? "closed" : undefined}
          ref={nav}
          {...rail.handlers}
          {...stylex.props(
            styles.nav,
            rail.isOpen && [styles.over, widths.of(openWidth)],
            // The rail opens and closes by easing its width, over the page.
            (isRail || easing) && styles.easing,
          )}
        >
          <style>{RAIL_CSS}</style>
          <div
            {...stylex.props(
              styles.inner,
              isRail && widths.content(openWidth),
            )}
          >
            <ColumnHeading
              isRevealed={rail.isHovered}
              {...(isWide
                ? {}
                : { logo: <LogoButton isOpen={rail.isOpen} onTap={rail.tap} ref={logo} /> })}
            />
            <ColumnActions />
            <div {...stylex.props(styles.scroll, isClosed && styles.scrollRail)}>
              <ShellPanes before={<Navigate pathname={pathname} />} isFitted query={query} />
            </div>
            <ColumnFoot pathname={pathname} />
          </div>
        </nav>
        {isWide && !column.isFolded && (
          <ResizeHandle
            isAlwaysVisible={false}
            label="Resize navigation"
            // Its grab zone over the column's edge, where the pointer looks for it.
            pillPlacement="center"
            position="overlay"
            resizable={column.resizable.props}
          />
        )}
      </div>
    </ColumnFoldContext>
  );
}
