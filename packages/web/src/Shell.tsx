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
  // The page's surface behind a short page too: Astryx paints it on the content only, which on the
  // phone ends with the page's text, leaving the shell's wash below it.
  shell: {
    backgroundColor: colorVars["--color-background-surface"],
  },
  // The errors of refused Undos, in the page's column, above it.
  errors: {
    boxSizing: "border-box",
    width: "100%",
    maxWidth: "var(--size-page-max)",
    marginInline: "auto",
    paddingBlockStart: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
  // The page's own inset on wide screens, so the banner lines up with its column.
  errorsWide: {
    paddingBlockStart: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
  // The navigation's heading: the link home, then the page's controls at its end.
  heading: {
    display: "flex",
    flexGrow: 1,
    alignItems: "center",
    gap: spacingVars["--spacing-2"],
    minWidth: 0,
    paddingInline: spacingVars["--spacing-2"],
  },
  // The menu's trigger takes the room the page's controls leave.
  menu: {
    flexGrow: 1,
    minWidth: 0,
  },
  controls: {
    display: "flex",
    flexShrink: 0,
    alignItems: "center",
    marginInlineStart: "auto",
  },
  // Folded: the link home, then the page's controls, one under the other.
  folded: {
    display: "flex",
    flexDirection: "column",
    alignItems: "center",
    gap: spacingVars["--spacing-1"],
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
      size="sm"
      value={mode}
      onChange={(value: string) => setMode(value as ThemeMode)}
    >
      <SegmentedControlItem value="system" label="System" />
      <SegmentedControlItem value="light" label="Light" />
      <SegmentedControlItem value="dark" label="Dark" />
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
  const { workspace, sessionList } = useNavigation();
  const current = useRepository();
  const path = useLocalPath();
  const { text, setText, query } = useSessionQuery();
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  const pathname = path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
  return (
    <SideNav
      header={<Heading current={current} slot={slot} />}
      topContent={<SearchField text={text} onChange={setText} />}
      footer={<ThemeSwitch />}
      collapsible
      resizable={{ defaultWidth: 240, minWidth: 200, maxWidth: 360, autoSaveId: "uraeda.nav" }}
    >
      <SessionNav
        workspace={workspace}
        sessionList={sessionList}
        pathname={pathname}
        query={query}
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
          key={error.id}
          status="error"
          title={error.text}
          collapsible={false}
          isDismissable
          dismissLabel="Dismiss"
          onDismiss={() => dismiss(error.id)}
        />
      ))}
    </VStack>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  return (
    <AppShell sideNav={<Nav slot={slot} />} height="auto" contentPadding={0} xstyle={styles.shell}>
      <UndoErrors />
      <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
    </AppShell>
  );
}

/**
 * The shell of a page that is not a repository's, like a name not in the list or a missing folder:
 * the heading's menu alone, which reads no repository.
 */
export function BareShell({ current, children }: { current: string | null; children: ReactNode }) {
  return (
    <AppShell
      sideNav={<SideNav header={<Heading current={current} slot={null} />} />}
      height="auto"
      contentPadding={0}
      xstyle={styles.shell}
    >
      {children}
    </AppShell>
  );
}
