// The column's own parts, around the shell's panes of work: its heading with the logo and the
// repository menu, New and Note, the Navigate pane with the inbox's and the priorities' ＋ and
// counts, and at its foot the 5 h window and Settings. Folded to the rail, each row is its icon.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense } from "react";
import { useInbox, usePriorities } from "../data.ts";
import { plural } from "../labels.ts";
import { Logo } from "../Logo.tsx";
import { RepositoryMenu } from "../RepositoryMenu.tsx";
import { useRepoPath, useRepository } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { Allowance } from "../sidebar/Allowance.tsx";
import { nowCount } from "../sidebar/entries.ts";
import { Item } from "../sidebar/Row.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { AddNoteButton, AddPriorityButton, useOpenAddForm } from "../SidebarAdd.tsx";
import { columnVars } from "./column.stylex.ts";
import { useColumnFold } from "./fold.ts";
import { ShellPane } from "./ShellPanes.tsx";

const styles = stylex.create({
  actions: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
  // Left-aligned, its icon under the heading's: the closed rail shows the icon alone.
  action: {
    justifyContent: "start",
    // Their icons, 20 px, stand under the rows' below (`--column-action-nudge`).
    paddingInlineStart: `calc(${spacingVars["--spacing-2"]} + ${columnVars["--column-action-nudge"]})`,
    width: "100%",
  },
  heading: {
    // The fold button or the logo first, at the same spot folded and unfolded (C3), then the menu.
    alignItems: "flex-start",
    display: "flex",
    gap: 0,
    minWidth: 0,
  },
  logo: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    height: "var(--size-element-md)",
    paddingInline: spacingVars["--spacing-2"],
  },
  menu: {
    flexGrow: 1,
    minWidth: 0,
  },
});

/** A count at a row's end: seen, and left out of the row's name, which its visible label starts. */
const count = (n: number) => <Badge aria-hidden label={String(n)} variant="neutral" />;

/**
 * The wide column's fold button, which folds it to its rail and unfolds it: shown under the
 * pointer while unfolded, and always to the keyboard, on touch, and folded.
 */
function FoldButton() {
  const { isFolded, toggle } = useColumnFold();
  if (!isFolded) {
    // Unfolded, the logo stays and the status line's "[ fold" folds.
    return (
      <span {...stylex.props(styles.logo)}>
        <Logo />
      </span>
    );
  }
  return (
    <IconButton
      icon={<Icon icon="uraeda:panel-left" />}
      label="Expand navigation"
      onClick={toggle}
      variant="ghost"
    />
  );
}

/**
 * The column's heading: on a wide screen its fold button, then the repository menu with the logo;
 * on a semi-wide one, `logo`, the rail's logo button, then the menu. Folded, its first button alone.
 */
export function ColumnHeading({
  logo,
}: {
  /** Whether the pointer is over the column, which shows the fold button. */
  isRevealed: boolean;
  /** The rail's logo button, on a semi-wide screen. */
  logo?: ReactNode;
}) {
  const { isFolded } = useColumnFold();
  const current = useRepository();
  return (
    <div {...stylex.props(styles.heading)}>
      {logo ?? <FoldButton />}
      {!isFolded && (
        <div {...stylex.props(styles.menu)}>
          <RepositoryMenu current={current} hasLogo={false} />
        </div>
      )}
    </div>
  );
}

/**
 * Commit, while something waits for one: the one place the inbox's, the priorities', and the drafts'
 * edits are committed, with what a commit would hold. First, as the thing to do before the rest; an
 * icon alone in the rail.
 */
function CommitAction({ isFolded }: { isFolded: boolean }) {
  const here = useRepoPath();
  const count = usePriorities()?.changes ?? 0;
  if (count === 0) {
    return null;
  }
  const label = `Commit · ${count}`;
  return isFolded ? (
    <IconButton
      data-rail-fit
      href={here("/commit")}
      icon={<Icon icon="check" />}
      label={`Commit, ${plural(count, "change")}`}
      variant="primary"
    />
  ) : (
    <Button
      data-rail-fit
      href={here("/commit")}
      icon={<Icon icon="check" />}
      label={label}
      variant="primary"
      xstyle={styles.action}
    />
  );
}

/**
 * Commit, while something waits; New, which opens the New page; and Note, which opens the inbox's
 * form. In the rail, Commit alone.
 */
export function ColumnActions() {
  const here = useRepoPath();
  const open = useOpenAddForm();
  const { isFolded } = useColumnFold();
  return (
    <div {...stylex.props(styles.actions)}>
      <Suspense fallback={null}>
        <CommitAction isFolded={isFolded} />
      </Suspense>
      {!isFolded && <NewAndNote here={here} open={open} />}
    </div>
  );
}

/** New and Note, the two buttons that start something. */
function NewAndNote({
  here,
  open,
}: {
  here: ReturnType<typeof useRepoPath>;
  open: ReturnType<typeof useOpenAddForm>;
}) {
  return (
    <>
      <Button
        data-rail-fit
        href={here("/new")}
        icon={<Icon icon="uraeda:plus" />}
        label="New"
        variant="primary"
        xstyle={styles.action}
      />
      <Button
        data-rail-fit
        icon={<Icon icon="uraeda:pencil" />}
        label="Note"
        onClick={() => open("note")}
        variant="secondary"
        xstyle={styles.action}
      />
    </>
  );
}

/** The inbox's row, its count once read, over its icon in the rail. */
function InboxCounted({ pathname }: { pathname: string }) {
  const inbox = useInbox();
  return <InboxRow notes={inbox?.count ?? 0} pathname={pathname} />;
}

/** The inbox's row, with its ＋ and its notes' count; a repository without `specs/` counts none. */
function InboxRow({ notes, pathname }: { notes?: number; pathname: string }) {
  return (
    <Item
      actions={<AddNoteButton />}
      count={notes}
      endContent={notes === undefined ? undefined : count(notes)}
      icon={<Icon icon={DESTINATIONS.inbox.icon} />}
      label={DESTINATIONS.inbox.label}
      pathname={pathname}
      to={DESTINATIONS.inbox.path}
    />
  );
}

/** Navigate: Home, the inbox and the priorities with their ＋ and counts, and the decisions. */
export function Navigate({ pathname }: { pathname: string }) {
  const data = useNavigation();
  const now = nowCount(data);
  return (
    <ShellPane title="Navigate">
      <Item
        icon={<Icon icon={DESTINATIONS.home.icon} />}
        label={DESTINATIONS.home.label}
        pathname={pathname}
        to={DESTINATIONS.home.path}
      />
      {data.workspace?.noSpecs ? (
        <InboxRow pathname={pathname} />
      ) : (
        <Suspense fallback={<InboxRow pathname={pathname} />}>
          <InboxCounted pathname={pathname} />
        </Suspense>
      )}
      <Item
        actions={<AddPriorityButton />}
        count={now}
        endContent={count(now)}
        icon={<Icon icon={DESTINATIONS.priorities.icon} />}
        label={DESTINATIONS.priorities.label}
        pathname={pathname}
        to={DESTINATIONS.priorities.path}
      />
      <Item
        icon={<Icon icon={DESTINATIONS.decisions.icon} />}
        label={DESTINATIONS.decisions.label}
        pathname={pathname}
        to={DESTINATIONS.decisions.path}
      />
    </ShellPane>
  );
}

/** The column's foot: the 5 h window, once a run reports it, and Settings. */
export function ColumnFoot({ pathname }: { pathname: string }) {
  return (
    <div data-rail-foot>
      <Allowance />
      <Item
        icon={<Icon icon={DESTINATIONS.settings.icon} />}
        label={DESTINATIONS.settings.label}
        pathname={pathname}
        to={DESTINATIONS.settings.path}
      />
    </div>
  );
}
