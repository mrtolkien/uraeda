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
    "--pane-inset": spacingVars["--spacing-1"],
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
  scroll: {
    flexGrow: 1,
    minHeight: 0,
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
});

/** The milliseconds the width eases over as the column folds or unfolds. */
const FOLD_MS = 200;

export function Column({ isWide }: { isWide: boolean }) {
  const column = useColumnWidth();
  const nav = useRef<HTMLElement>(null);
  const logo = useRef<HTMLButtonElement>(null);
  const rail = useRail(!isWide, nav, logo);
  const pathname = useShellPath();
  const { query, setText, text } = useSessionQuery();
  const [easing, setEasing] = useState(false);
  const { toggle: toggleStored } = column;
  const isFolded = isWide ? column.isFolded : !rail.isOpen;
  // In the page's flow, the column takes the rail's room, folded or semi-wide.
  const isRail = !isWide || column.isFolded;
  const fold = useMemo(
    () => ({
      isFolded,
      toggle: () => {
        setEasing(true);
        setTimeout(() => setEasing(false), FOLD_MS);
        toggleStored();
      },
    }),
    [isFolded, toggleStored],
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
          ref={nav}
          {...rail.handlers}
          {...stylex.props(
            styles.nav,
            rail.isOpen && [styles.over, widths.of(column.width)],
            easing && styles.easing,
          )}
        >
          <ColumnHeading
            isRevealed={rail.isHovered}
            {...(isWide
              ? {}
              : { logo: <LogoButton isOpen={rail.isOpen} onTap={rail.tap} ref={logo} /> })}
          />
          <ColumnActions />
          <SearchField onChange={setText} text={text} />
          <div {...stylex.props(styles.scroll, isFolded && styles.scrollFolded)}>
            <ShellPanes before={<Navigate pathname={pathname} />} isFitted query={query} />
          </div>
          <ColumnFoot pathname={pathname} />
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
