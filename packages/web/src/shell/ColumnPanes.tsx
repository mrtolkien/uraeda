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
import { useInbox } from "../data.ts";
import { RepositoryMenu } from "../RepositoryMenu.tsx";
import { useRepoPath, useRepository } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { Allowance } from "../sidebar/Allowance.tsx";
import { nowCount } from "../sidebar/entries.ts";
import { Item } from "../sidebar/Row.tsx";
import { AddNoteButton, AddPriorityButton, useOpenAddForm } from "../SidebarAdd.tsx";
import { useColumnFold } from "./fold.ts";
import { ShellPane } from "./ShellPanes.tsx";

const styles = stylex.create({
  actions: {
    display: "flex",
    gap: spacingVars["--spacing-2"],
  },
  heading: {
    // The fold button or the logo first, at the same spot folded and unfolded (C3), then the menu.
    alignItems: "flex-start",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    minWidth: 0,
  },
  hidden: {
    // Still focusable, and shown once focused: only its look waits for the pointer.
    opacity: { ":focus-visible": 1, "@media (hover: none)": 1, default: 0 },
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
function FoldButton({ isRevealed }: { isRevealed: boolean }) {
  const { isFolded, toggle } = useColumnFold();
  return (
    <IconButton
      icon={<Icon icon="uraeda:panel-left" />}
      label={isFolded ? "Expand navigation" : "Collapse navigation"}
      onClick={toggle}
      variant="ghost"
      xstyle={isFolded || isRevealed ? undefined : styles.hidden}
    />
  );
}

/**
 * The column's heading: on a wide screen its fold button, then the repository menu with the logo;
 * on a semi-wide one, `logo`, the rail's logo button, then the menu. Folded, its first button alone.
 */
export function ColumnHeading({
  isRevealed,
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
      {logo ?? <FoldButton isRevealed={isRevealed} />}
      {!isFolded && (
        <div {...stylex.props(styles.menu)}>
          <RepositoryMenu current={current} hasLogo={logo === undefined} />
        </div>
      )}
    </div>
  );
}

/** New, which opens the New page, and Note, which opens the inbox's form; none in the rail. */
export function ColumnActions() {
  const here = useRepoPath();
  const open = useOpenAddForm();
  const { isFolded } = useColumnFold();
  if (isFolded) {
    return null;
  }
  return (
    <div {...stylex.props(styles.actions)}>
      <Button
        href={here("/new")}
        icon={<Icon icon="uraeda:plus" />}
        label="New"
        variant="primary"
      />
      <Button
        icon={<Icon icon="uraeda:pencil" />}
        label="Note"
        onClick={() => open("note")}
        variant="secondary"
      />
    </div>
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
      icon={<Icon icon="uraeda:inbox" />}
      label="Inbox"
      pathname={pathname}
      to="/inbox"
    />
  );
}

/** Navigate: Home, the inbox and the priorities with their ＋ and counts, and the decisions. */
export function Navigate({ pathname }: { pathname: string }) {
  const data = useNavigation();
  const now = nowCount(data);
  return (
    <ShellPane title="Navigate">
      <Item icon={<Icon icon="uraeda:home" />} label="Home" pathname={pathname} to="/" />
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
        icon={<Icon icon="uraeda:list" />}
        label="Priorities"
        pathname={pathname}
        to="/priorities"
      />
      <Item
        icon={<Icon icon="uraeda:decision-ruler" />}
        label="Decisions"
        pathname={pathname}
        to="/decisions"
      />
    </ShellPane>
  );
}

/** The column's foot: the 5 h window, once a run reports it, and Settings. */
export function ColumnFoot({ pathname }: { pathname: string }) {
  return (
    <div>
      <Allowance />
      <Item
        icon={<Icon icon="uraeda:settings" />}
        label="Settings"
        pathname={pathname}
        to="/settings"
      />
    </div>
  );
}
