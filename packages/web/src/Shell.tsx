import { AppShell } from "@astryxdesign/core/AppShell";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { SideNav, SideNavHeading, SideNavItem, SideNavSection } from "@astryxdesign/core/SideNav";
import { type ReactNode, useState } from "react";
import { useWorkspace } from "./data.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { navigate, RouterAnchor, usePathname } from "./routes.tsx";
import { type ThemeMode, useThemeMode } from "./theme.tsx";

function ThemeSwitch() {
  const [mode, setMode] = useThemeMode();
  return (
    <SegmentedControl
      label="Theme"
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
  const pathname = usePathname();
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
      header={
        <SideNavHeading
          heading="Uraeda"
          headingHref="/"
          as={RouterAnchor}
          subheading={repository}
          headerEndContent={slot}
        />
      }
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

export function Shell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  return (
    <AppShell sideNav={<Nav slot={slot} />} height="auto" contentPadding={0}>
      <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
    </AppShell>
  );
}
