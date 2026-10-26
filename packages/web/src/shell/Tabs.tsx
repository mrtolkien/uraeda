// The phone's bar of tabs, at the top of every page: Home, Inbox with its notes' count, Priorities,
// Sessions with the running sessions' count, Decisions, Settings, and New, each an icon named by its
// page, the current page's marked. The Sessions tab opens the shell's panes as a page of their own.
import { Badge } from "@astryxdesign/core/Badge";
import { Icon } from "@astryxdesign/core/Icon";
import { IconButton } from "@astryxdesign/core/IconButton";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ComponentProps, Suspense } from "react";
import { useInbox } from "../data.ts";
import { useRepoPath } from "../routes.tsx";
import { useNavigation } from "../sessionData.ts";
import { runningSessions } from "../sidebar/entries.ts";
import { selects } from "../sidebar/Row.tsx";
import { useShellPath } from "./ShellPanes.tsx";
import { plural } from "../labels.ts";

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
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    display: "flex",
    gap: spacingVars["--spacing-1"],
    height: spacingVars["--spacing-12"],
    justifyContent: "space-between",
    paddingInline: spacingVars["--spacing-2"],
  },
  icon: {
    display: "inline-flex",
    position: "relative",
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
  count,
  counted = String,
  icon,
  isCurrent,
  label,
  to,
  variant = "ghost",
}: {
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
              <Badge aria-hidden label={String(count)} variant="info" xstyle={styles.small} />
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
      icon="uraeda:inbox"
      isCurrent={isCurrent}
      label="Inbox"
      to="/inbox"
    />
  );
}

export function Tabs() {
  const pathname = useShellPath();
  const data = useNavigation();
  const at = (to: string) => selects(pathname, to);
  const inbox = <Tab icon="uraeda:inbox" isCurrent={at("/inbox")} label="Inbox" to="/inbox" />;
  return (
    <nav aria-label="Tabs" {...stylex.props(styles.bar)}>
      <Tab icon="uraeda:home" isCurrent={at("/")} label="Home" to="/" />
      {data.workspace?.noSpecs ? (
        inbox
      ) : (
        <Suspense fallback={inbox}>
          <InboxCounted isCurrent={at("/inbox")} />
        </Suspense>
      )}
      <Tab icon="uraeda:list" isCurrent={at("/priorities")} label="Priorities" to="/priorities" />
      <Tab
        count={runningSessions(data)}
        counted={(n) => `${n} running`}
        icon="uraeda:activity"
        isCurrent={at("/sessions")}
        label="Sessions"
        to="/sessions"
      />
      <Tab
        icon="uraeda:decision-ruler"
        isCurrent={at("/decisions")}
        label="Decisions"
        to="/decisions"
      />
      <Tab icon="uraeda:settings" isCurrent={at("/settings")} label="Settings" to="/settings" />
      <Tab icon="uraeda:plus" isCurrent={at("/new")} label="New" to="/new" variant="primary" />
    </nav>
  );
}
