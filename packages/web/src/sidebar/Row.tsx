// The column's plain rows: a page's, like Home or Inbox, with its icon. In the closed rail, a row is
// its icon alone, in the rail's box: the column's stylesheet centres the icon and hides the label,
// the count, and the controls, which no prop of `SideNavItem` reaches (`Column.tsx`). They stay
// drawn, so a row keeps its element, and the focus, as the rail opens.
import { SideNavItem } from "@astryxdesign/core/SideNav";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";
import { useClosedRail } from "../layout/closedRail.ts";
import { useInPane } from "../layout/paneContext.tsx";
import { columnVars } from "../shell/column.stylex.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { brighten } from "./brighten.ts";
import type { Status } from "./cards.ts";

const styles = stylex.create({
  // In a pane, the closed rail's row starts with the cards' frames, left of the pane's inset.
  railInPane: { marginInlineStart: `calc(-1 * ${columnVars["--rail-frame-pull"]})` },
});

/** Whether a row leading to `to` is selected: its page or one of its own pages is open. */
export function selects(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

/** A row that opens a page, selected while the page or one of its own pages is open. */
export function Item({
  actions,
  endContent,
  icon,
  label,
  name,
  pathname,
  status,
  to,
}: {
  /** Its controls at the row's end, like ＋. */
  actions?: ReactNode;
  /** Passive content at its end, like a count. */
  endContent?: ReactNode;
  icon: ReactNode;
  label: string;
  /** What screen readers read, when the label is short for it. */
  name?: string;
  pathname: string;
  status?: Status;
  to: string;
}) {
  const here = useRepoPath();
  const named = name ?? [label, status?.label].filter(Boolean).join(", ");
  const open = () => navigate(here(to));
  const isRail = useClosedRail();
  const isInPane = useInPane();
  return (
    <SideNavItem
      actions={actions}
      endContent={endContent}
      href={here(to)}
      icon={status ? <StatusMark label={status.label} status={status.status} /> : icon}
      isSelected={selects(pathname, to)}
      label={label}
      // The pane's compact rows: their labels keep the room a pane's border and inset take.
      size="sm"
      xstyle={[brighten, isRail && isInPane && styles.railInPane]}
      {...(named === label ? {} : { "aria-label": named })}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        open();
      }}
    />
  );
}
