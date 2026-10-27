// The phone's bar of tabs, at the top of every page: Home with the count of what needs the human,
// Inbox with its notes' count, Priorities, Sessions with the running sessions' count, Decisions,
// Settings, and New, each an icon named by its page, the current page's marked. The Sessions tab
// opens the shell's panes as a page of their own. The phone has no status line: these counts are
// its, and a page's own controls take its bar.
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, Suspense } from "react";
import { useInbox } from "../data.ts";
import { useRepoPath } from "../routes.tsx";
import { DESTINATIONS } from "../destinations.ts";
import { useNavigation } from "../sessionData.ts";
import { needsYouEntries, runningSessions } from "../sidebar/entries.ts";
import { selects } from "../sidebar/Row.tsx";
import { useShellPath } from "./ShellPanes.tsx";
import { plural } from "../labels.ts";
import { ruleStyles } from "../layout/rules.ts";

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
    // None between them at the least: eight 44 px buttons and the line are what a 375 px phone holds.
    gap: 0,
    height: spacingVars["--spacing-12"],
    justifyContent: "space-between",
    paddingInline: spacingVars["--spacing-2"],
  },
  icon: {
    display: "inline-flex",
    position: "relative",
  },
  divider: {
    // The line between the sidebar's toggle and the pages' tabs.
    backgroundColor: colorVars["--color-border"],
    height: spacingVars["--spacing-5"],
    width: "1px",
  },
  toggle: {
    // The sidebar's toggle apart, further left than the tabs: its own group, then a line.
    alignItems: "center",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-1"]})`,
  },
  small: {
    // A small badge, its count in the type it had: less padding, and a step less tall.
    height: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-1"],
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
      <Tab
        icon={DESTINATIONS.decisions.icon}
        isCurrent={at(DESTINATIONS.decisions.path)}
        label={DESTINATIONS.decisions.label}
        to={DESTINATIONS.decisions.path}
      />
      <Tab
        icon={DESTINATIONS.settings.icon}
        isCurrent={at(DESTINATIONS.settings.path)}
        label={DESTINATIONS.settings.label}
        to={DESTINATIONS.settings.path}
      />
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
