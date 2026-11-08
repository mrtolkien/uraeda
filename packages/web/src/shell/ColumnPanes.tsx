// The column's own parts, around the shell's panes of work: its heading with the logo and the
// repository menu, the actions, Git's and New, the Navigate pane with Home and the extensions'
// places, the inbox's and the priorities' with their ＋ and counts, and at its foot the 5 h window
// and Settings. The closed rail clips each row to its icon.
import { Badge } from "@astryxdesign/core/Badge";
import { Button } from "@astryxdesign/core/Button";
import { Icon } from "@astryxdesign/core/Icon";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentType, type ReactNode, Suspense } from "react";
import { useInbox } from "../data.ts";
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
import { BUILT_IN_PLACES } from "../extensions/builtins/places.ts";
import { CountIn } from "../extensions/CountIn.tsx";
import type { Place } from "../extensions/registry.ts";
import { useContributions } from "../extensions/useContributions.ts";
import { AddNoteButton, AddProposalButton } from "../SidebarAdd.tsx";
import { columnVars } from "./column.stylex.ts";
import { ShellPane } from "./ShellPanes.tsx";
import { useGitSummary } from "../git/data.ts";

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

/** The sidebar's Git entry's words: "Git", then the changes to commit and "↓" the commits to pull. */
export function gitLabel(changes: number, behind: number): string {
  return [
    BUILT_IN_PLACES.git.label,
    ...(changes > 0 ? [String(changes)] : []),
    ...(behind > 0 ? [`↓${behind}`] : []),
  ].join(" · ");
}

/**
 * Git, while its built-in is on, with the count of what waits on the Git page: the main checkout's
 * changes to commit, then the commits to pull. First, as the thing to do before the rest; an icon
 * alone in the closed rail.
 */
export function GitColumnAction({ isColumn }: { isColumn: boolean }) {
  const look = useActionLook(isColumn);
  return (
    <Suspense fallback={<GitButton label={BUILT_IN_PLACES.git.label} look={look} />}>
      <GitAction look={look} />
    </Suspense>
  );
}

function GitAction({ look }: { look: ActionLook }) {
  const summary = useGitSummary();
  return <GitButton label={gitLabel(summary?.changes ?? 0, summary?.behind ?? 0)} look={look} />;
}

function GitButton({ label, look }: { label: string; look: ActionLook }) {
  const here = useRepoPath();
  return (
    <Button
      href={here(BUILT_IN_PLACES.git.path)}
      icon={<Icon icon={BUILT_IN_PLACES.git.icon} size={look.icon} />}
      label={label}
      variant="secondary"
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
 * `lead` first, as the folded column's Unfold; then the extensions' actions, Git's with what waits;
 * then New, which opens the New page. On the desktop's column, `isColumn`, their icons are the rail's 20 px,
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
  const actions = useContributions("place").flatMap((place) =>
    place.column === "actions" && place.action ? [{ Action: place.action, id: place.id }] : [],
  );
  return (
    <div {...stylex.props(styles.actions)}>
      {lead}
      {actions.map(({ Action, id }) => (
        <Action isColumn={isColumn} key={id} />
      ))}
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

/** The inbox's row in Navigate, its count once read: none in a repository without `specs/`. */
export function InboxNavRow({ pathname }: { pathname: string }) {
  const data = useNavigation();
  return data.workspace?.noSpecs ? (
    <InboxRow pathname={pathname} />
  ) : (
    <Suspense fallback={<InboxRow pathname={pathname} />}>
      <InboxCounted pathname={pathname} />
    </Suspense>
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
      icon={<Icon icon={BUILT_IN_PLACES.inbox.icon} />}
      label={BUILT_IN_PLACES.inbox.label}
      pathname={pathname}
      to={BUILT_IN_PLACES.inbox.path}
    />
  );
}

/** The priorities' row in Navigate, with its ＋ and Now's count. */
export function PrioritiesNavRow({ pathname }: { pathname: string }) {
  const now = nowCount(useNavigation());
  return (
    <Item
      actions={<AddProposalButton />}
      // Now's own lines, not every priority: none shows nothing, rather than a "0" that reads as
      // an empty file; its tooltip says what it counts.
      endContent={now > 0 && <span title={`${now} in Now`}>{count(now)}</span>}
      icon={<Icon icon={BUILT_IN_PLACES.priorities.icon} />}
      label={BUILT_IN_PLACES.priorities.label}
      pathname={pathname}
      to={BUILT_IN_PLACES.priorities.path}
    />
  );
}

/** A count drawn by a hook of its place: called as a hook, once per render of its row. */
function PlaceCount({ useCount }: { useCount: () => number | undefined }) {
  const n = useCount();
  return n === undefined ? null : count(n);
}

/** An extension's place in Navigate: its own row, or its icon, title, actions, and count. */
function PlaceRow({ pathname, place }: { pathname: string; place: Place }) {
  if (place.navRow) {
    const Row = place.navRow;
    return <Row pathname={pathname} />;
  }
  const Actions: ComponentType | undefined = place.actions;
  return (
    <Item
      actions={Actions && <Actions />}
      endContent={
        place.count && (
          <CountIn count={place.count} fallback={null}>
            <PlaceCount useCount={place.count} />
          </CountIn>
        )
      }
      icon={<Icon icon={place.icon} />}
      label={place.title}
      pathname={pathname}
      to={place.path ?? "/"}
    />
  );
}

/** Navigate: Home, then the extensions' places, the inbox's and the priorities' with their ＋. */
export function Navigate({ pathname }: { pathname: string }) {
  const places = useContributions("place").filter(
    (place) => (place.column ?? "navigate") === "navigate",
  );
  return (
    <ShellPane title="Navigate">
      <Item
        icon={<Icon icon={DESTINATIONS.home.icon} />}
        label={DESTINATIONS.home.label}
        pathname={pathname}
        to={DESTINATIONS.home.path}
      />
      {places.map((place) => (
        <PlaceRow key={place.id} pathname={pathname} place={place} />
      ))}
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
