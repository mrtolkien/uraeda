// The column's plain rows: a page's, like Home or Inbox, with its icon. Folded to the rail, a row is
// its icon alone, named by its label, with a dot over it while it counts anything.
import { IconButton } from "@astryxdesign/core/IconButton";
import { SideNavItem } from "@astryxdesign/core/SideNav";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { MouseEvent, ReactNode } from "react";
import { navigate, useRepoPath } from "../routes.tsx";
import { useColumnFold } from "../shell/fold.ts";
import { StatusMark } from "../StatusMark.tsx";
import { brighten } from "./brighten.ts";
import type { Status } from "./cards.ts";

const styles = stylex.create({
  dot: {
    // Over the icon's top end corner: the rail has no room for the count itself.
    backgroundColor: colorVars["--color-accent"],
    borderRadius: radiusVars["--radius-full"],
    height: spacingVars["--spacing-1-5"],
    insetBlockStart: `calc(-1 * ${spacingVars["--spacing-0-5"]})`,
    insetInlineEnd: `calc(-1 * ${spacingVars["--spacing-0-5"]})`,
    pointerEvents: "none",
    position: "absolute",
    width: spacingVars["--spacing-1-5"],
  },
  icon: {
    display: "inline-flex",
    position: "relative",
  },
});

/** Whether a row leading to `to` is selected: its page or one of its own pages is open. */
export function selects(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

/** An icon with a dot over its corner while its count is not zero: the rail's form of a count. */
export function CountedIcon({ count, icon }: { count?: number | undefined; icon: ReactNode }) {
  return (
    <span {...stylex.props(styles.icon)}>
      {icon}
      {count !== undefined && count > 0 && <span {...stylex.props(styles.dot)} />}
    </span>
  );
}

/**
 * A link of the rail: an icon alone, named, selected while its page shows. `onOpen` opens its page
 * inside the app, instead of loading `href`.
 */
export function RailLink({
  href,
  icon,
  isSelected,
  label,
  onOpen,
}: {
  href: string;
  icon: ReactNode;
  isSelected: boolean;
  label: string;
  onOpen?: () => void;
}) {
  return (
    <IconButton
      aria-current={isSelected ? "page" : undefined}
      href={href}
      icon={icon}
      label={label}
      {...(onOpen
        ? {
            onClick: (event: MouseEvent) => {
              event.preventDefault();
              onOpen();
            },
          }
        : {})}
      variant={isSelected ? "secondary" : "ghost"}
    />
  );
}

/** A row that opens a page, selected while the page or one of its own pages is open. */
export function Item({
  actions,
  count,
  endContent,
  icon,
  label,
  name,
  pathname,
  status,
  to,
}: {
  /** Its controls at the row's end, like ＋, shown while the column is unfolded. */
  actions?: ReactNode;
  /** A count the folded rail shows over its icon, which `endContent` shows unfolded. */
  count?: number | undefined;
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
  const { isFolded } = useColumnFold();
  const named = name ?? [label, status?.label].filter(Boolean).join(", ");
  const open = () => navigate(here(to));
  if (isFolded) {
    return (
      <RailLink
        href={here(to)}
        icon={<CountedIcon count={count} icon={icon} />}
        isSelected={selects(pathname, to)}
        label={named}
        onOpen={open}
      />
    );
  }
  return (
    <SideNavItem
      actions={actions}
      endContent={endContent}
      href={here(to)}
      icon={status ? <StatusMark label={status.label} status={status.status} /> : icon}
      isSelected={selects(pathname, to)}
      label={label}
      xstyle={brighten}
      // The pane's compact rows: their labels keep the room a pane's border and inset take.
      size="sm"
      {...(named === label ? {} : { "aria-label": named })}
      onClick={(event: MouseEvent) => {
        event.preventDefault();
        open();
      }}
    />
  );
}
