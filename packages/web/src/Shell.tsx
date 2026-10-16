import { AppShell } from "@astryxdesign/core/AppShell";
import { Banner } from "@astryxdesign/core/Banner";
import { Icon } from "@astryxdesign/core/Icon";
import { SideNav, SideNavItem, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, easeVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useRef, useState } from "react";
import { useNavigation } from "./data.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { useWidthClass } from "./layout/useWidthClass.ts";
import { RepositoryMenu } from "./RepositoryMenu.tsx";
import { currentEntry, navigate, useLocalPath, useRepoPath, useRepository } from "./routes.tsx";
import { DoneArea, type DoneRow } from "./sidebar/DoneArea.tsx";
import { selects } from "./sidebar/Row.tsx";
import { SidebarHeading } from "./sidebar/SidebarHeading.tsx";
import { FeatureSettingsHost } from "./sidebar/FeatureSettingsDialog.tsx";
import { SearchField, useSessionQuery } from "./sidebar/Search.tsx";
import { Sidebar } from "./sidebar/Sidebar.tsx";
import { SidebarAddForms } from "./SidebarAdd.tsx";
import { useWrites } from "./writes/store.ts";
import { WriteProgress } from "./writes/WriteFeedback.tsx";

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
  folding: {
    // The width eases as the sidebar folds or unfolds, never while its edge is dragged.
    transitionDuration: { "@media (prefers-reduced-motion: reduce)": "0s", default: "200ms" },
    transitionProperty: "width",
    transitionTimingFunction: easeVars["--ease-standard"],
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

/** The milliseconds the sidebar's width eases over as it folds or unfolds. */
const FOLD_MS = 200;

/** The repository menu, its trigger an icon while the navigation is folded. */
function Menu({ current }: { current: string | null }) {
  const { isCollapsed } = useSideNavCollapse();
  return <RepositoryMenu current={current} isFolded={isCollapsed} />;
}

/**
 * The navigation's footer: Settings, selected on its pages. Folded, its icon alone, named
 * "Settings".
 */
function SettingsItem({ path }: { path: string }) {
  const here = useRepoPath();
  return (
    <SideNavItem
      href={here("/settings")}
      icon={<Icon icon="uraeda:settings" />}
      isSelected={path === "/settings" || path.startsWith("/settings/")}
      label="Settings"
      onClick={(event: React.MouseEvent) => {
        event.preventDefault();
        navigate(here("/settings"));
      }}
    />
  );
}

/** The done items, newest first, as the Done area lists them. */
function doneRows(
  features: Array<{
    folder: string;
    label?: string | null;
    slug: string;
    step: { name: string };
    title: string;
  }>,
  pathname: string,
  here: (path: string) => string,
): Array<DoneRow> {
  return features
    .filter((feature) => feature.step.name === "done")
    .sort((a, b) => b.folder.localeCompare(a.folder))
    .map((feature) => ({
      folder: feature.folder,
      href: here(`/f/${feature.folder}`),
      isSelected: selects(pathname, `/f/${feature.folder}`),
      label: feature.label ?? feature.slug,
      title: feature.title,
    }));
}

/**
 * The navigation: a search over the sessions, Home, what needs the human, the inbox and the
 * priorities with their ＋, the changes and the features in flight, the chats, and at the bottom the
 * latest done items that fit, then Settings. Its heading folds it, goes home on the phone, and ends with the page's
 * own controls; on wide screens it folds to its rail and resizes, its width and state kept in the
 * browser, its width easing as it folds.
 */
function Nav({ slot }: { slot: ReactNode }) {
  const { sessionList, workspace } = useNavigation();
  const current = useRepository();
  const path = useLocalPath();
  const here = useRepoPath();
  const { query, setText, text } = useSessionQuery();
  const [pointer, setPointer] = useState(false);
  const [folding, setFolding] = useState(false);
  const rows = useRef<HTMLDivElement>(null);
  // A task view opened from home shows beside home on wide screens: home stays the page selected.
  const pathname = path.startsWith("/priorities/") && currentEntry().from === "/" ? "/" : path;
  const fold = () => {
    setFolding(true);
    setTimeout(() => setFolding(false), FOLD_MS);
  };
  return (
    <SideNav
      collapsible={{ hasButton: false }}
      footer={
        <>
          <DoneArea
            allHref={here("/#done")}
            content={rows}
            onOpen={(href) => navigate(href)}
            rows={doneRows(workspace?.features ?? [], pathname, here)}
          />
          <SettingsItem path={path} />
        </>
      }
      header={
        <SidebarHeading
          homeHref={here("/")}
          isHome={pathname === "/"}
          isRevealed={pointer}
          menu={<Menu current={current} />}
          onFold={fold}
          slot={slot}
        />
      }
      onPointerEnter={() => setPointer(true)}
      onPointerLeave={() => setPointer(false)}
      resizable={{ autoSaveId: "uraeda.nav", defaultWidth: 280, maxWidth: 480, minWidth: 200 }}
      topContent={<SearchField onChange={setText} text={text} />}
      xstyle={folding && styles.folding}
    >
      <div ref={rows}>
        <Sidebar
          pathname={pathname}
          query={query}
          sessionList={sessionList}
          workspace={workspace}
        />
      </div>
    </SideNav>
  );
}

/** The thin bar at the top of the page, while a git write runs. */
function Writing() {
  return <WriteProgress isRunning={useWrites().running !== undefined} />;
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
    <SidebarAddForms>
      <FeatureSettingsHost>
        <AppShell
          contentPadding={0}
          height="auto"
          sideNav={<Nav slot={slot} />}
          xstyle={styles.shell}
        >
          <Writing />
          <UndoErrors />
          <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
        </AppShell>
      </FeatureSettingsHost>
    </SidebarAddForms>
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
      sideNav={
        <SideNav
          header={
            <div {...stylex.props(styles.heading)}>
              <RepositoryMenu current={current} />
            </div>
          }
        />
      }
      xstyle={styles.shell}
    >
      {children}
    </AppShell>
  );
}
