// The sidebar's plain rows: a page's, like Home or Inbox, and a "＋" row opening a new item's page.
import { SideNavItem, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import type { ReactNode } from "react";
import { navigate, useRepoPath } from "../routes.tsx";
import { StatusMark } from "../StatusMark.tsx";
import type { Status } from "./cards.ts";

/** Whether a row leading to `to` is selected: its page or one of its own pages is open. */
export function selects(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

/** A row that opens a page, selected while the page or one of its own pages is open. */
export function Item({
  actions,
  endContent,
  foldedIcon,
  label,
  name,
  pathname,
  status,
  to,
}: {
  /** Its controls at the row's end, like ＋, shown while the navigation is unfolded. */
  actions?: ReactNode;
  /** Passive content at its end, like a count. */
  endContent?: ReactNode;
  /** Its icon in the folded navigation, which shows only rows with one. */
  foldedIcon?: ReactNode;
  label: string;
  /** What screen readers read, when the label is short for it. */
  name?: string;
  pathname: string;
  status?: Status;
  to: string;
}) {
  const here = useRepoPath();
  const { isCollapsed } = useSideNavCollapse();
  const named = name ?? [label, status?.label].filter(Boolean).join(", ");
  return (
    <SideNavItem
      actions={actions}
      endContent={endContent}
      href={here(to)}
      isSelected={selects(pathname, to)}
      label={label}
      {...(named === label ? {} : { "aria-label": named })}
      {...(foldedIcon && isCollapsed && !status ? { icon: foldedIcon } : {})}
      {...(status ? { icon: <StatusMark label={status.label} status={status.status} /> } : {})}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
    />
  );
}

/**
 * A "＋" row opening a new item's page at `path`, like "＋ New", selected on that page whatever its
 * query; left out of the folded navigation, where it would be a ＋ with no label.
 */
export function NewRow({
  label,
  path,
  pathname,
}: {
  label: string;
  path: string;
  pathname: string;
}) {
  const here = useRepoPath();
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return null;
  }
  return (
    <SideNavItem
      href={here(path)}
      icon={<span aria-hidden="true">＋</span>}
      isSelected={pathname === path}
      label={label}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(path));
      }}
    />
  );
}
