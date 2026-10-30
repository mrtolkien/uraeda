// The column's own parts, around the shell's panes of work: its heading with the logo and the
// repository menu, New and Note, the Navigate pane with the inbox's and the priorities' ＋ and
// counts, and at its foot the 5 h window and Settings. The closed rail clips each row to its icon.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense } from "react";
import { useInbox, usePriorities } from "../data.ts";
import { useClosedRail } from "../layout/closedRail.ts";
import { Room } from "../layout/Room.tsx";
import { Logo } from "../Logo.tsx";
import { RepositoryMenu } from "../RepositoryMenu.tsx";
import { useRepoPath, useRepository } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { Allowance } from "../sidebar/Allowance.tsx";
import { nowCount } from "../sidebar/entries.ts";
import { Item } from "../sidebar/Row.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { AddNoteButton, AddProposalButton } from "../SidebarAdd.tsx";
import { columnVars } from "./column.stylex.ts";
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
  // In the closed rail: the rail's box, its icon under the rows' and its label clipped.
  actionRail: {
    justifyContent: "start",
    minWidth: 0,
    overflow: "hidden",
    paddingInlineEnd: 0,
    paddingInlineStart: columnVars["--rail-fit-inset"],
    width: columnVars["--rail-row-box"],
  },
  heading: {
    // The logo, or the rail's logo button, first, then the menu.
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
 * The column's heading: the logo, or on a semi-wide screen `logo`, the rail's logo button, then the
 * repository menu. The status line's "[ fold" folds the wide column.
 */
export function ColumnHeading({
  logo,
}: {
  /** The rail's logo button, on a semi-wide screen. */
  logo?: ReactNode;
}) {
  const current = useRepository();
  return (
    <div {...stylex.props(styles.heading)}>
      {logo ?? (
        <span {...stylex.props(styles.logo)}>
          <Logo />
        </span>
      )}
      <div {...stylex.props(styles.menu)}>
        <RepositoryMenu current={current} hasLogo={false} />
      </div>
    </div>
  );
}

/**
 * Commit, while something waits for one: the one place the inbox's, the priorities', and the
 * proposal and note files' edits are committed, with what a commit would hold. First, as the thing
 * to do before the rest; an icon alone in the closed rail.
 */
function CommitAction({ look }: { look: ActionLook }) {
  const here = useRepoPath();
  const count = usePriorities()?.changes ?? 0;
  if (count === 0) {
    return null;
  }
  return (
    <Button
      href={here("/commit")}
      icon={<Icon icon="check" size={look.icon} />}
      label={`Commit · ${count}`}
      variant="primary"
      xstyle={look.xstyle}
    />
  );
}

/** The actions' look: their icon's size, and their style, the closed rail's box in it. */
type ActionLook = { icon: "md" | undefined; xstyle: stylex.StyleXStyles };

/** The actions' look: on the desktop's column, `isColumn`, with the rail's 20 px icons. */
function useActionLook(isColumn: boolean): ActionLook {
  const isRail = useClosedRail();
  return {
    icon: isColumn ? "md" : undefined,
    xstyle: [styles.action, isRail && styles.actionRail],
  };
}

/**
 * `lead` first, as the folded column's Unfold; then Commit, while something waits; then New, which
 * opens the New page. On the desktop's column, `isColumn`, their icons are the rail's 20 px,
 * which the closed rail shows alone.
 */
export function ColumnActions({
  isColumn = false,
  lead,
}: {
  isColumn?: boolean;
  lead?: ReactNode;
}) {
  const look = useActionLook(isColumn);
  const noSpecs = useNavigation().workspace?.noSpecs;
  return (
    <div {...stylex.props(styles.actions)}>
      {lead}
      {/* Without specs/, nothing waits for a commit, and the priorities cannot be read. */}
      {!noSpecs && (
        <Suspense fallback={null}>
          <CommitAction look={look} />
        </Suspense>
      )}
      <NewButton look={look} />
    </div>
  );
}

/**
 * Unfold, the folded wide column's button, first in its rail, which unfolds it, for a pointer or a
 * finger as `[` does for the keys. Its room opens and closes as the column's width eases, so the
 * rows under it glide rather than jump; closed, it is out of the tab order.
 */
export function Unfold({ isShown, onUnfold }: { isShown: boolean; onUnfold: () => void }) {
  const look = useActionLook(true);
  return (
    <Room gap={1} isOpen={isShown} takesGapBack>
      <Button
        icon={<Icon icon="uraeda:panel-left" size={look.icon} />}
        label="Unfold navigation"
        onClick={onUnfold}
        variant="secondary"
        xstyle={look.xstyle}
      />
    </Room>
  );
}

/** New, the button that starts something: the New page, whose cards and entries say what. */
function NewButton({ look }: { look: ActionLook }) {
  const here = useRepoPath();
  return (
    <Button
      href={here(DESTINATIONS.new.path)}
      icon={<Icon icon={DESTINATIONS.new.icon} size={look.icon} />}
      label={DESTINATIONS.new.label}
      variant="primary"
      xstyle={look.xstyle}
    />
  );
}

/** The inbox's row, its count once read. */
function InboxCounted({ pathname }: { pathname: string }) {
  const inbox = useInbox();
  return <InboxRow notes={inbox?.count ?? 0} pathname={pathname} />;
}

/** The inbox's row, with its ＋ and its notes' count; a repository without `specs/` counts none. */
function InboxRow({ notes, pathname }: { notes?: number; pathname: string }) {
  return (
    <Item
      actions={<AddNoteButton />}
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
        actions={<AddProposalButton />}
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
    <div>
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
