import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Link } from "@astryxdesign/core/Link";
import {
  SideNav,
  SideNavItem,
  SideNavSection,
  useSideNavCollapse,
} from "@astryxdesign/core/SideNav";
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
import { useWorkspace } from "./data.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { currentEntry, navigate, usePathname } from "./routes.tsx";
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
  if (isCollapsed) {
    return (
      <div {...stylex.props(styles.folded)}>
        <SideNavItem
          label="Uraeda"
          icon={<span aria-hidden="true">⌂</span>}
          href="/"
          onClick={(event: React.MouseEvent) => {
            event.preventDefault();
            navigate("/");
          }}
        />
        {slot}
      </div>
    );
  }
  return (
    <div {...stylex.props(styles.heading)}>
      <Link href="/" color="primary" xstyle={styles.home}>
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

function Item({ label, to, pathname }: { label: string; to: string; pathname: string }) {
  return (
    <SideNavItem
      label={label}
      href={to}
      isSelected={pathname === to || (to !== "/" && pathname.startsWith(`${to}/`))}
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(to);
      }}
    />
  );
}

/**
 * The navigation: home, priorities, and every feature by what it waits for, then the theme. Its
 * heading goes home and ends with the page's own controls; on wide screens it folds away and
 * resizes, its width and state kept in the browser.
 */
function Nav({ slot }: { slot: ReactNode }) {
  const workspace = useWorkspace();
  const path = usePathname();
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  const pathname = path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
  const features = workspace?.features ?? [];
  const groups: Array<[string, typeof features]> = [
    ["Waiting on you", features.filter((f) => f.step.waitsOn === "human")],
    [
      "Agents at work",
      features.filter((f) => f.step.waitsOn === "agent" && f.step.name !== "none"),
    ],
    ["Done", features.filter((f) => f.step.name === "done")],
  ];
  const repository = workspace?.root.split("/").pop() ?? "uraeda";
  return (
    <SideNav
      header={<Heading repository={repository} slot={slot} />}
      footer={<ThemeSwitch />}
      collapsible
      resizable={{ defaultWidth: 240, minWidth: 200, maxWidth: 360, autoSaveId: "uraeda.nav" }}
    >
      <Item label="Home" to="/" pathname={pathname} />
      <Item label="Priorities" to="/priorities" pathname={pathname} />
      {groups.map(
        ([title, list]) =>
          list.length > 0 && (
            <SideNavSection key={title} title={title}>
              {list.map((feature) => (
                <Item
                  key={feature.folder}
                  label={feature.title}
                  to={`/f/${feature.folder}`}
                  pathname={pathname}
                />
              ))}
            </SideNavSection>
          ),
      )}
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
