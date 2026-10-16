// The sidebar's bottom: up to the five latest done features and changes, after a divider, as many
// as fit in the room the rows above leave, newest first; gone, heading included, when none fits.
// "…" opens Home's Done group, which lists them all.
import { Divider } from "@astryxdesign/core/Divider";
import { SideNavItem, SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { StepIcon } from "./StepIcon.tsx";

/** The most done rows the sidebar shows. */
export const DONE_ROWS = 5;

export type DoneRow = { folder: string; href: string; label: string; title: string };

const styles = stylex.create({
  area: {
    flexShrink: 0,
    paddingBlockEnd: spacingVars["--spacing-2"],
  },
});

/** A Done row's height, and the heading's, divider's, and "…" row's together, before measuring. */
const ROW = 40;
const CHROME = 96;

/**
 * How many done rows fit below the rows above: the room the sidebar's scrolling list leaves under
 * `content`, its other rows, counting the room the Done area takes now. Measured again as the window
 * or the rows above change size.
 */
function useRowsThatFit(
  content: RefObject<HTMLElement | null>,
  area: RefObject<HTMLElement | null>,
) {
  const [fit, setFit] = useState(0);
  useLayoutEffect(() => {
    const rows = content.current;
    const list = rows?.parentElement;
    if (!rows || !list) {
      return;
    }
    const measure = () => {
      const taken = area.current?.offsetHeight ?? 0;
      const row = area.current?.querySelector("a")?.offsetHeight ?? ROW;
      const chrome = taken > 0 ? taken - row * Math.min(fit, DONE_ROWS) : CHROME;
      const room = list.clientHeight + taken - rows.offsetHeight - chrome;
      setFit(Math.max(0, Math.min(DONE_ROWS, Math.floor(room / row))));
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(list);
    observer.observe(rows);
    return () => observer.disconnect();
  }, [content, area, fit]);
  return fit;
}

export function DoneArea({
  allHref,
  content,
  rows,
}: {
  /** Home's Done group. */
  allHref: string;
  /** The sidebar's rows above it, in its scrolling list. */
  content: RefObject<HTMLElement | null>;
  /** Every done item, newest first. */
  rows: Array<DoneRow>;
}) {
  const { isCollapsed } = useSideNavCollapse();
  const area = useRef<HTMLDivElement>(null);
  const measured = useRowsThatFit(content, area);
  const shown = rows.slice(0, Math.min(measured, DONE_ROWS));
  if (shown.length === 0 || isCollapsed) {
    return null;
  }
  return (
    <div ref={area} {...stylex.props(styles.area)}>
      <Divider />
      <SideNavSection title="Done">
        {shown.map((row) => (
          <SideNavItem
            aria-label={`${row.label}, ${row.title}, done`}
            href={row.href}
            icon={<StepIcon step="done" />}
            key={row.folder}
            label={row.label}
          />
        ))}
        <SideNavItem aria-label="All done features and changes" href={allHref} label="…" />
      </SideNavSection>
    </div>
  );
}
