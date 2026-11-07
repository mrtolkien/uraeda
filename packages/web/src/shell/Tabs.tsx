// The phone's bar of tabs, at the top of every page, a terminal's tab line: Home with the count of
// what needs the human, Inbox with its notes' count, Priorities, Sessions with the running
// sessions' count, Git with what waits on it, a `…` that holds Decisions and Settings, and New, each
// an icon named by its page. Nothing is filled: the current page's tab is in the accent, a line in
// the accent under it at the bar's edge; a count is a small number after its icon; New is framed.
// The Sessions tab opens the shell's panes as a page of their own. The phone's status line holds a
// page's own controls only: these counts are its counts.
import { DropdownMenu, type DropdownMenuTriggerProps } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  sizeVars,
  spacingVars,
} from "@astryxdesign/core/theme/tokens.stylex";
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

const styles = stylex.create({
  bar: {
    // The phone's top bar, as tall as before: the pages' sticky parts stay below `--spacing-12`.
    // Its tabs take its whole height, so the current one's line sits on its bottom edge.
    alignItems: "stretch",
    boxSizing: "border-box",
    display: "flex",
    // None between their targets at the least: eight 44 px buttons and the line are what a 375 px
    // phone holds, so Decisions and Settings wait in the `…` (see `MoreTab`).
    gap: 0,
    height: spacingVars["--spacing-12"],
    justifyContent: "space-between",
    paddingInline: spacingVars["--spacing-2"],
  },
  // A tab's count, after its icon: small, its figures as wide as each other, in the muted text.
  count: {
    color: colorVars["--color-text-secondary"],
    fontSize: "var(--font-size-sm)",
    fontVariantNumeric: "tabular-nums",
    lineHeight: "100%",
    // Its figures' middle on the icon's: centred by its box, they sat 0.7 px high, as a figure's
    // ink is not its box's middle.
    transform: "translateY(0.05em)",
  },
  // What needs the human, Home's count: in the Needs you pane's colour, bold.
  countNeeds: {
    color: "var(--role-needs-you)",
    fontWeight: fontWeightVars["--font-weight-bold"],
  },
  // The current tab's count, in the accent with its icon.
  countCurrent: { color: colorVars["--color-accent"] },
  // The current page's tab, and the sidebar's toggle while the sidebar is open: in the accent.
  current: { color: colorVars["--color-accent"] },
  divider: {
    // The line between the sidebar's toggle and the pages' tabs.
    alignSelf: "center",
    backgroundColor: colorVars["--color-border"],
    height: spacingVars["--spacing-5"],
    width: borderVars["--border-width"],
  },
  icon: {
    alignItems: "center",
    display: "inline-flex",
    gap: spacingVars["--spacing-0-5"],
  },
  // The current page's line, under its tab on the bar's bottom edge, over the bar's own rule.
  line: {
    "::after": {
      backgroundColor: colorVars["--color-accent"],
      content: '""',
      height: spacingVars["--spacing-0-5"],
      insetBlockEnd: `calc(-1 * ${borderVars["--border-width"]})`,
      insetInlineEnd: spacingVars["--spacing-1-5"],
      insetInlineStart: spacingVars["--spacing-1-5"],
      pointerEvents: "none",
      position: "absolute",
    },
  },
  // New's frame, inside its target: a line in the accent, no fill.
  frame: {
    alignItems: "center",
    borderColor: colorVars["--color-accent"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    color: colorVars["--color-accent"],
    display: "flex",
    flexShrink: 0,
    height: spacingVars["--spacing-7"],
    justifyContent: "center",
    // Square, over the icon's slot, which is the icon's width.
    minWidth: spacingVars["--spacing-7"],
    width: spacingVars["--spacing-7"],
  },
  tab: {
    // The bar's height, a control's width at least, wider with its count: no fill, ever, under
    // the pointer only Astryx's own overlay.
    // Not square, as an icon's button is in Astryx: as wide as its icon and count.
    "--button-icon-only-aspect": "auto",
    backgroundColor: "transparent",
    height: "auto",
    minWidth: sizeVars["--size-element-md"],
    overflow: "visible",
    paddingInline: spacingVars["--spacing-0-5"],
    position: "relative",
    width: "auto",
  },
  toggle: {
    // The sidebar's toggle apart, further left than the tabs: its own group, then a line.
    alignItems: "stretch",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    marginInlineStart: `calc(-1 * ${spacingVars["--spacing-1"]})`,
  },
});

type IconName = ComponentProps<typeof Icon>["icon"];

/**
 * A tab: its page's icon, named by the page, with a small count after it while there is one, which
 * its name says after the page's, in `counted`'s words.
 */
function Tab({
  count,
  counted = String,
  icon,
  isCurrent,
  isNeeds = false,
  label,
  to,
}: {
  count?: number | undefined;
  counted?: (n: number) => string;
  icon: IconName;
  isCurrent: boolean;
  /** Its count is what needs the human, in the Needs you pane's colour. */
  isNeeds?: boolean;
  label: string;
  to: string;
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
            <span
              aria-hidden
              data-tab-count
              {...stylex.props(
                styles.count,
                isNeeds && styles.countNeeds,
                isCurrent && styles.countCurrent,
              )}
            >
              {count}
            </span>
          )}
        </span>
      }
      label={shown ? `${label}, ${counted(count)}` : label}
      variant="ghost"
      xstyle={[styles.tab, isCurrent && [styles.current, styles.line]]}
    />
  );
}

/**
 * The Git tab, always there, the phone's way to the Git page: the main checkout's changes to commit
 * and the commits to pull, counted together after its icon while any wait, and each named after the page.
 */
function GitTab({ isCurrent }: { isCurrent: boolean }) {
  const summary = useGitSummary();
  const changes = summary?.changes ?? 0;
  const behind = summary?.behind ?? 0;
  const counted = () =>
    [
      ...(changes > 0 ? [plural(changes, "change")] : []),
      ...(behind > 0 ? [`${behind} to pull`] : []),
    ].join(", ");
  return (
    <Tab
      count={changes + behind}
      counted={counted}
      icon={DESTINATIONS.git.icon}
      isCurrent={isCurrent}
      label={DESTINATIONS.git.label}
      to={DESTINATIONS.git.path}
    />
  );
}

/** New, framed in the accent rather than filled, its target the bar's height as every tab's. */
function NewTab({ isCurrent }: { isCurrent: boolean }) {
  const here = useRepoPath();
  return (
    <IconButton
      aria-current={isCurrent ? "page" : undefined}
      href={here(DESTINATIONS.new.path)}
      icon={
        <span {...stylex.props(styles.frame)}>
          <Icon icon={DESTINATIONS.new.icon} />
        </span>
      }
      label={DESTINATIONS.new.label}
      variant="ghost"
      xstyle={[styles.tab, isCurrent && styles.line]}
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
          variant="ghost"
          xstyle={[styles.tab, current !== undefined && [styles.current, styles.line]]}
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
          variant="ghost"
          xstyle={[styles.tab, isSidebarOpen && styles.current]}
        />
        <span aria-hidden="true" {...stylex.props(styles.divider)} />
      </div>
      <Tab
        count={needsYouEntries(data).length}
        counted={(n) => `${n} need you`}
        icon={DESTINATIONS.home.icon}
        isCurrent={at(DESTINATIONS.home.path)}
        isNeeds
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
      <Suspense
        fallback={
          <Tab
            icon={DESTINATIONS.git.icon}
            isCurrent={at(DESTINATIONS.git.path)}
            label={DESTINATIONS.git.label}
            to={DESTINATIONS.git.path}
          />
        }
      >
        <GitTab isCurrent={at(DESTINATIONS.git.path)} />
      </Suspense>
      <MoreTab at={at} />
      <NewTab isCurrent={at(DESTINATIONS.new.path)} />
    </nav>
  );
}
