// The sidebar's rows: a page's, a feature's with its current task, and a session's sub-agents.
import { SideNavItem, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { SessionStatus } from "uraeda-server/fate";
import type { useNavigation } from "./data.ts";
import { ProgressRing } from "./ProgressRing.tsx";
import { navigate, useRepoPath } from "./routes.tsx";
import { sessionPath } from "./sessions.ts";
import { StatusMark } from "./StatusMark.tsx";

const styles = stylex.create({
  subagent: {
    // A sub-agent's row, under its session's.
    paddingInlineStart: spacingVars["--spacing-6"],
  },
});

type Data = ReturnType<typeof useNavigation>;
/** A session's row in the sessions' list. */
export type Row = NonNullable<Data["sessionList"]>["rows"][number];
/** A feature, as the navigation reads it. */
export type Feature = NonNullable<Data["workspace"]>["features"][number];

/** A status and its label. */
export type Status = { label: string; status: SessionStatus };

/** Whether a row leading to `to` is selected: its page or one of its own pages is open. */
function selects(pathname: string, to: string) {
  return pathname === to || (to !== "/" && pathname.startsWith(`${to}/`));
}

/**
 * A row that opens a page, selected while the page or one of its own pages is open, unless one of
 * those pages has a row of its own (`except`).
 */
export function Item({
  except,
  foldedIcon,
  label,
  pathname,
  status,
  title,
  to,
}: {
  /** A page under its own whose row is selected instead of it. */
  except?: string;
  /** Its icon in the folded navigation, which shows only rows with one. */
  foldedIcon?: ReactNode;
  label: string;
  pathname: string;
  status?: Status;
  /** What screen readers read after its label, when the label is short for it, like a slug. */
  title?: string;
  to: string;
}) {
  const here = useRepoPath();
  const { isCollapsed } = useSideNavCollapse();
  const name = [label, title, status?.label].filter(Boolean).join(", ");
  return (
    <SideNavItem
      href={here(to)}
      isSelected={selects(pathname, to) && !(except && selects(pathname, except))}
      label={label}
      // The title and the status are read with the label, also when the folded navigation shows
      // only the dot.
      {...(name === label ? {} : { "aria-label": name })}
      {...(foldedIcon && isCollapsed && !status ? { icon: foldedIcon } : {})}
      {...(status ? { icon: <StatusMark label={status.label} status={status.status} /> } : {})}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
    />
  );
}

/** The rows of a session's running sub-agents, under its own, each opening the session. */
export function Subagents({ row, to }: { row: Row | undefined; to: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const here = useRepoPath();
  if (!row || isCollapsed) {
    return null;
  }
  return row.subagents.map((subagent) => (
    <SideNavItem
      aria-label={`${subagent.description}, Working`}
      href={here(to)}
      icon={<StatusMark label="Working" small status="working" />}
      key={subagent.id}
      label={subagent.description}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
      xstyle={styles.subagent}
    />
  ));
}

/**
 * A feature's current task, under its row while it is at its implementation, with a ring filled to
 * it. It opens the feature's session, and is the row selected there.
 */
function ProgressRow({ feature, pathname }: { feature: Feature; pathname: string }) {
  const { isCollapsed } = useSideNavCollapse();
  const here = useRepoPath();
  // The core sets it during the implementation only.
  const { progress } = feature.step;
  if (!progress || isCollapsed) {
    return null;
  }
  const { position, title, total } = progress;
  const to = sessionPath(feature.folder);
  return (
    <SideNavItem
      // Its visible text first, as WCAG's label in name asks, then the task in full words.
      aria-label={`${position}/${total} · ${title}, Task ${position} of ${total}`}
      href={here(to)}
      icon={<ProgressRing position={position} total={total} />}
      isSelected={selects(pathname, to)}
      label={`${position}/${total} · ${title}`}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here(to));
      }}
      xstyle={styles.subagent}
    />
  );
}

/**
 * A feature's row, by its slug, with its session's status; under it, its current task, then its
 * running sub-agents.
 */
export function FeatureRow({
  feature,
  pathname,
  row,
  status,
}: {
  feature: Feature;
  pathname: string;
  row: Row | undefined;
  status: Status;
}) {
  // A finished feature with nothing to show draws no mark: an idle ring there reads as unfinished.
  const finished = feature.step.name === "done" && status.status === "idle";
  const { isCollapsed } = useSideNavCollapse();
  return (
    <>
      <Item
        // The progress row stands for the session's page, while it shows.
        {...(feature.step.progress && !isCollapsed ? { except: sessionPath(feature.folder) } : {})}
        label={feature.slug}
        pathname={pathname}
        status={finished ? undefined : status}
        title={feature.title}
        to={`/f/${feature.folder}`}
      />
      <ProgressRow feature={feature} pathname={pathname} />
      <Subagents row={row} to={sessionPath(feature.folder)} />
    </>
  );
}
