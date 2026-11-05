// The phone's bar of tabs, at the top of every page: Home with the count of what needs the human,
// Inbox with its notes' count, Priorities, Sessions with the running sessions' count, Git while
// something waits on it, a `…` that holds Decisions and Settings, and New, each an icon named by
// its page, the current page's marked. The Sessions tab opens the shell's panes as a page of
// their own. The phone's status line holds a page's own controls only: these counts are its counts.
import { Badge } from "@astryxdesign/core/Badge";
import { DropdownMenu, type DropdownMenuTriggerProps } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, Suspense } from "react";
import { useInbox } from "../data.ts";
import { useGitSummary } from "../git/data.ts";
import { navigate, useRepoPath } from "../routes.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { useNavigation } from "../sessionData.ts";
import { needsYouEntries, runningSessions } from "../sidebar/entries.ts";
import { selects } from "../sidebar/Row.tsx";
import { useShellPath } from "./ShellPanes.tsx";
import { plural } from "../labels.ts";
import { ruleStyles } from "../layout/rules.ts";
import { barVars } from "../layout/bar.stylex.ts";

const styles = stylex.create({
  badge: {
    // At the icon's top end corner, off its glyph: it overlaps the corner by a step at most.
    display: "flex",
    insetBlockEnd: `calc(100% - ${spacingVars["--spacing-1"]})`,
    insetInlineStart: `calc(100% - ${spacingVars["--spacing-1"]})`,
    pointerEvents: "none",
    position: "absolute",
  },
  bar: {
    // The phone's top bar, as tall as before: the pages' sticky parts stay below `--spacing-12`.
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    // None between their targets at the least: eight 44 px buttons and the line are what a 375 px
    // phone holds, so Decisions and Settings wait in the `…` (see `MoreTab`). Each tab draws its
    // own room inside its target instead (`tab`).
    gap: 0,
    height: spacingVars["--spacing-12"],
    justifyContent: "space-between",
    paddingInline: spacingVars["--spacing-2"],
  },
  divider: {
    // The line between the sidebar's toggle and the pages' tabs.
    backgroundColor: colorVars["--color-border"],
    height: spacingVars["--spacing-5"],
    width: borderVars["--border-width"],
  },
  icon: {
    display: "inline-flex",
    position: "relative",
  },
  // A tab's fill, the current page's or a filled one's like New, stops a thin strip short of the
  // target's sides, so two fills side by side show the bar's glass between them; the target keeps
  // its 44 px, the strip included, and a tap on it still reaches the tab.
  small: {
    // A small badge, its count in the type it had: less padding, and a step less tall.
    height: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-1"],
  },
  tab: {
    backgroundClip: "padding-box",
    borderColor: "transparent",
    // Over Astryx's button, which draws none: its longhands, which win over its shorthands.
    borderInlineEndWidth: barVars["--bar-tab-room"],
    borderInlineStartWidth: barVars["--bar-tab-room"],
    borderStyle: "solid",
  },
  toggle: {
    // The sidebar's toggle apart, further left than the tabs: its own group, then a line.
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-1"]})`,
  },
});

type IconName = ComponentProps<typeof Icon>["icon"];

/**
 * A tab: its page's icon, named by the page, with a count over it while there is one, which its
 * name says after the page's, in `counted`'s words.
 */
function Tab({
  badge = "info",
  count,
  counted = String,
  icon,
  isCurrent,
  label,
  to,
  variant = "ghost",
}: {
  /** The count's colour: the usual info, or a warning for what waits on the human. */
  badge?: "info" | "warning";
  count?: number | undefined;
  counted?: (n: number) => string;
  icon: IconName;
  isCurrent: boolean;
  label: string;
  to: string;
  variant?: "ghost" | "primary";
}) {
  const here = useRepoPath();
  const shown = count !== undefined && count > 0;
  return (
    <IconButton
      aria-current={isCurrent ? "page" : undefined}
      href={here(to)}
      icon={
        <span {...stylex.props(styles.icon)}>
          <Icon icon={icon} />
          {shown && (
            <span {...stylex.props(styles.badge)}>
              <Badge aria-hidden label={String(count)} variant={badge} xstyle={styles.small} />
            </span>
          )}
        </span>
      }
      label={shown ? `${label}, ${counted(count)}` : label}
      variant={isCurrent ? "secondary" : variant}
      xstyle={styles.tab}
    />
  );
}

/**
 * The Git tab, while something waits on the Git page: the changes to commit and the commits to
 * pull, counted together over its icon, and each named after the page.
 */
function GitTab({ isCurrent }: { isCurrent: boolean }) {
  const summary = useGitSummary();
  const changes = summary?.changes ?? 0;
  const behind = summary?.behind ?? 0;
  if (changes + behind === 0) {
    return null;
  }
  const counted = () =>
    [
      ...(changes > 0 ? [plural(changes, "change")] : []),
      ...(behind > 0 ? [`${behind} to pull`] : []),
    ].join(", ");
  return (
    <Tab
      badge="warning"
      count={changes + behind}
      counted={counted}
      icon={DESTINATIONS.git.icon}
      isCurrent={isCurrent}
      label={DESTINATIONS.git.label}
      to={DESTINATIONS.git.path}
      variant="primary"
    />
  );
}

/** The places the `…` holds: the least visited, with no count to show. */
const FOLDED = [DESTINATIONS.decisions, DESTINATIONS.settings] as const;

/**
 * The `…` of the places the bar has no room for, Decisions and Settings, a popover anchored to it:
 * marked as the current page's tab while one of them is open, and named by it then.
 */
function MoreTab({ at }: { at: (to: string) => boolean }) {
  const here = useRepoPath();
  const current = FOLDED.find((place) => at(place.path));
  return (
    <DropdownMenu
      alignment="end"
      items={FOLDED.map((place) => ({
        icon: place.icon,
        label: place.label,
        onClick: () => navigate(here(place.path)),
      }))}
      presentation="popover"
      renderTrigger={(props: DropdownMenuTriggerProps) => (
        <IconButton
          aria-current={current ? "page" : undefined}
          icon={<Icon icon="moreHorizontal" />}
          label={current ? `More, ${current.label}` : "More"}
          variant={current ? "secondary" : "ghost"}
          xstyle={styles.tab}
          {...props}
        />
      )}
    />
  );
}

/** The inbox's tab, with its notes' count once read. */
function InboxCounted({ isCurrent }: { isCurrent: boolean }) {
  const inbox = useInbox();
  return (
    <Tab
      count={inbox?.count}
      counted={(n) => plural(n, "note")}
      icon={DESTINATIONS.inbox.icon}
      isCurrent={isCurrent}
      label={DESTINATIONS.inbox.label}
      to={DESTINATIONS.inbox.path}
    />
  );
}

export function Tabs({
  isSidebarOpen,
  onToggleSidebar,
}: {
  isSidebarOpen: boolean;
  onToggleSidebar: () => void;
}) {
  const pathname = useShellPath();
  const data = useNavigation();
  const at = (to: string) => selects(pathname, to);
  const inbox = (
    <Tab
      icon={DESTINATIONS.inbox.icon}
      isCurrent={at(DESTINATIONS.inbox.path)}
      label={DESTINATIONS.inbox.label}
      to={DESTINATIONS.inbox.path}
    />
  );
  return (
    <nav aria-label="Tabs" {...stylex.props(ruleStyles.below, styles.bar)}>
      <div {...stylex.props(styles.toggle)}>
        <IconButton
          aria-expanded={isSidebarOpen}
          icon={<Icon icon="uraeda:panel-left" />}
          label="Sidebar"
          onClick={onToggleSidebar}
          variant={isSidebarOpen ? "secondary" : "ghost"}
          xstyle={styles.tab}
        />
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
      </div>
      <Tab
        badge="warning"
        count={needsYouEntries(data).length}
        counted={(n) => `${n} need you`}
        icon={DESTINATIONS.home.icon}
        isCurrent={at(DESTINATIONS.home.path)}
        label={DESTINATIONS.home.label}
        to={DESTINATIONS.home.path}
      />
      {data.workspace?.noSpecs ? (
        inbox
      ) : (
        <Suspense fallback={inbox}>
          <InboxCounted isCurrent={at("/inbox")} />
        </Suspense>
      )}
      <Tab
        icon={DESTINATIONS.priorities.icon}
        isCurrent={at(DESTINATIONS.priorities.path)}
        label={DESTINATIONS.priorities.label}
        to={DESTINATIONS.priorities.path}
      />
      <Tab
        count={runningSessions(data)}
        counted={(n) => `${n} running`}
        icon={DESTINATIONS.sessions.icon}
        isCurrent={at(DESTINATIONS.sessions.path)}
        label={DESTINATIONS.sessions.label}
        to={DESTINATIONS.sessions.path}
      />
      <Suspense fallback={null}>
        <GitTab isCurrent={at(DESTINATIONS.git.path)} />
      </Suspense>
      {/* Between Git and New, so their two filled blocks do not run into one. */}
      <MoreTab at={at} />
      <Tab
        icon={DESTINATIONS.new.icon}
        isCurrent={at(DESTINATIONS.new.path)}
        label={DESTINATIONS.new.label}
        to={DESTINATIONS.new.path}
        variant="primary"
      />
    </nav>
  );
}
