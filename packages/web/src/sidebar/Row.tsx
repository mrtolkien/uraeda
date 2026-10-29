// The column's plain rows: a page's, like Home or Inbox, with its icon.
import { SideNavItem } from "@astryxdesign/core/SideNav";
import type { MouseEvent, ReactNode } from "react";
import { navigate, useRepoPath } from "../routes.tsx";
import { StatusMark } from "../StatusMark.tsx";
import { brighten } from "./brighten.ts";
import type { Status } from "./cards.ts";

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
      xstyle={brighten}
      {...(named === label ? {} : { "aria-label": named })}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        open();
      }}
    />
  );
}
