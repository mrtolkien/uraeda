import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Link } from "@astryxdesign/core/Link";
import { SideNav, SideNavItem, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  colorVars,
  fontWeightVars,
  sizeVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { useNavigation } from "./data.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { currentEntry, navigate, useLocalPath, useRepoPath } from "./routes.tsx";
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
  // As tall as a control, so a finger reaches it.
  home: {
    display: "flex",
    flexDirection: "column",
    justifyContent: "center",
    minWidth: 0,
    minHeight: sizeVars["--size-element-md"],
    textDecoration: "none",
  },
  name: {
    display: "block",
    fontSize: typeScaleVars["--text-large-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-large-leading"],
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
 * The navigation's heading: "Uraeda" and the repository's name, one link home, and beside it, not
 * inside it, the page's own controls. Folded, the link home is an icon, the controls under it.
 */
function Heading({ repository, slot }: { repository: string; slot: ReactNode }) {
  const { isCollapsed } = useSideNavCollapse();
  const home = useRepoPath()("/");
  if (isCollapsed) {
    return (
      <div {...stylex.props(styles.folded)}>
        <SideNavItem
          label="Uraeda"
          icon={<span aria-hidden="true">⌂</span>}
          href={home}
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            navigate(home);
          }}
        />
        {slot}
      </div>
    );
  }
  return (
    <div {...stylex.props(styles.heading)}>
      <Link href={home} color="primary" xstyle={styles.home}>
        <span {...stylex.props(styles.name)}>Uraeda</span>
        <Text type="supporting" color="secondary" display="block">
          {repository}
        </Text>
      </Link>
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
  const path = useLocalPath();
  const { text, setText, query } = useSessionQuery();
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  const pathname = path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
  const repository = workspace?.root.split("/").pop() ?? "uraeda";
  return (
    <SideNav
      header={<Heading repository={repository} slot={slot} />}
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
