import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNav, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useNavigation } from "./data.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { RepositoryMenu } from "./RepositoryMenu.tsx";
import { currentEntry, useLocalPath, useRepository } from "./routes.tsx";
import { SearchField, SessionNav, useSessionQuery } from "./SessionNav.tsx";
import { type ThemeMode, useThemeMode } from "./theme.tsx";

const styles = stylex.create({
  controls: {
    alignItems: "center",
    display: "flex",
    flexShrink: 0,
    marginInlineStart: "auto",
  },
  errors: {
    // The errors of refused Undos, in the page's column, above it.
    boxSizing: "border-box",
    marginInline: "auto",
    maxWidth: "var(--size-page-max)",
    paddingBlockStart: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
    width: "100%",
  },
  errorsWide: {
    // The page's own inset on wide screens, so the banner lines up with its column.
    paddingBlockStart: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
  folded: {
    // Folded: the link home, then the page's controls, one under the other.
    alignItems: "center",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
  },
  heading: {
    // The navigation's heading: the link home, then the page's controls at its end.
    alignItems: "center",
    display: "flex",
    flexGrow: 1,
    gap: spacingVars["--spacing-2"],
    minWidth: 0,
    paddingInline: spacingVars["--spacing-2"],
  },
  menu: {
    // The menu's trigger takes the room the page's controls leave.
    flexGrow: 1,
    minWidth: 0,
  },
  shell: {
    // The page's surface behind a short page too: Astryx paints it on the content only, which on the
    // phone ends with the page's text, leaving the shell's wash below it.
    backgroundColor: colorVars["--color-background-surface"],
  },
});

/**
 * The navigation's heading: the repository menu, "Uraeda" over the repository's name, and beside
 * it, not inside it, the page's own controls. Folded, the menu's trigger is an icon, the controls
 * under it.
 */
function Heading({ current, slot }: { current: string | null; slot: ReactNode }) {
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return (
      <div {...stylex.props(styles.folded)}>
        <RepositoryMenu current={current} isFolded />
        {slot}
      </div>
    );
  }
  return (
    <div {...stylex.props(styles.heading)}>
      <div {...stylex.props(styles.menu)}>
        <RepositoryMenu current={current} />
      </div>
      {slot && <div {...stylex.props(styles.controls)}>{slot}</div>}
    </div>
  );
}

/** The theme's three choices, small enough to fit the navigation's default width. */
function ThemeSwitch() {
  const [mode, setMode] = useThemeMode();
  // The folded navigation is too narrow for it.
  const { isCollapsed } = useSideNavCollapse();
  if (isCollapsed) {
    return null;
  }
  return (
    <SegmentedControl
      label="Theme"
      onChange={(value: string) => setMode(value as ThemeMode)}
      size="sm"
      value={mode}
    >
      <SegmentedControlItem label="System" value="system" />
      <SegmentedControlItem label="Light" value="light" />
      <SegmentedControlItem label="Dark" value="dark" />
    </SegmentedControl>
  );
}

/**
 * The navigation: a search over the sessions, home, priorities, every feature by what it waits for
 * with its session's status, the chats, then the theme. Its heading goes home and ends with the
 * page's own controls; on wide screens it folds away and resizes, its width and state kept in the
 * browser.
 */
function Nav({ slot }: { slot: ReactNode }) {
  const { sessionList, workspace } = useNavigation();
  const current = useRepository();
  const path = useLocalPath();
  const { query, setText, text } = useSessionQuery();
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  const pathname = path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
  return (
    <SideNav
      collapsible
      footer={<ThemeSwitch />}
      header={<Heading current={current} slot={slot} />}
      resizable={{ autoSaveId: "uraeda.nav", defaultWidth: 240, maxWidth: 360, minWidth: 200 }}
      topContent={<SearchField onChange={setText} text={text} />}
    >
      <SessionNav
        pathname={pathname}
        query={query}
        sessionList={sessionList}
        workspace={workspace}
      />
    </SideNav>
  );
}

/** The errors of refused Undos, each until dismissed. */
function UndoErrors() {
  const [errors, dismiss] = useUndoErrors();
  const wide = useWidthClass() === "wide";
  if (errors.length === 0) {
    return null;
  }
  return (
    <VStack gap={2} xstyle={[styles.errors, wide && styles.errorsWide]}>
      {errors.map((error) => (
        <Banner
          collapsible={false}
          dismissLabel="Dismiss"
          isDismissable
          key={error.id}
          onDismiss={() => dismiss(error.id)}
          status="error"
          title={error.text}
        />
      ))}
    </VStack>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  return (
    <AppShell contentPadding={0} height="auto" sideNav={<Nav slot={slot} />} xstyle={styles.shell}>
      <UndoErrors />
      <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
    </AppShell>
  );
}

/**
 * The shell of a page that is not a repository's, like a name not in the list or a missing folder:
 * the heading's menu alone, which reads no repository.
 */
export function BareShell({ children, current }: { children: ReactNode; current: string | null }) {
  return (
    <AppShell
      contentPadding={0}
      height="auto"
      sideNav={<SideNav header={<Heading current={current} slot={null} />} />}
      xstyle={styles.shell}
    >
      {children}
    </AppShell>
  );
}
