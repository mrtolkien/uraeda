// The shell around every page of a repository: on semi-wide and wide screens, the column beside the
// page (`shell/Column.tsx`); on the phone, the bar of tabs above it (`shell/Tabs.tsx`); at every
// width, the status line at the bottom of the window (`shell/StatusLine.tsx`). The page
// keeps its place in the tree as the window crosses a width, so its text, focus, and scroll stay.
// The shell's frame is our own (plan, Complexity tracking): Astryx's `AppShell` draws its own
// navigation for the phone.
import { LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { LeaderMenuHost } from "./keys/LeaderMenuHost.tsx";
import { KeysProvider } from "./keys/registry.tsx";
import { ScrollKeys } from "./keys/scroll.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Notifier, NotifyBanner } from "./notify/Notifier.tsx";
import { RepositoryMenu } from "./RepositoryMenu.tsx";
import { Column } from "./shell/Column.tsx";
import { StatusLine } from "./shell/StatusLine.tsx";
import { Tabs } from "./shell/Tabs.tsx";
import { FeatureSettingsHost } from "./sidebar/FeatureSettingsDialog.tsx";
import { RenameSessionHost } from "./sidebar/RenameSession.tsx";
import { SidebarAddForms } from "./SidebarAdd.tsx";
import { StatusHintsProvider } from "./statusHints.tsx";
import { useWrites } from "./writes/store.ts";
import { WriteProgress } from "./writes/WriteFeedback.tsx";
import { ruleStyles } from "./layout/rules.ts";

const styles = stylex.create({
  bare: {
    // A page of no repository: the menu alone, above the page.
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
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
  frame: {
    // The page's surface behind a short page too.
    backgroundColor: colorVars["--color-background-surface"],
    minHeight: "var(--size-viewport-height)",
  },
  header: {
    // The phone's tabs, in view while the page scrolls.
    backgroundColor: colorVars["--color-background-body"],
    position: "sticky",
    top: 0,
    zIndex: 2,
  },
  main: {
    flexGrow: 1,
    minWidth: 0,
  },
  row: {
    display: "flex",
  },
  status: {
    // The status line takes the window's bottom row: what is as tall as the window ends above it,
    // and the page's end scrolls past it.
    "--size-status-line": spacingVars["--spacing-8"],
    "--size-viewport-height": "calc(100dvh - var(--size-status-line))",
    paddingBlockEnd: "var(--size-status-line)",
  },
  statusNarrow: {
    // On the phone, a row as tall as the tabs', which holds the page's controls, as a round's Next.
    "--size-status-line": spacingVars["--spacing-12"],
  },
});

/** The thin bar at the top of the page, while a git write runs. */
function Writing() {
  return <WriteProgress isRunning={useWrites().running !== undefined} />;
}

/** The errors of refused Undos, each until dismissed. */
function UndoErrors() {
  const [errors, dismiss] = useUndoErrors();
  const wide = !isNarrow(useWidthClass());
  if (errors.length === 0) {
    return null;
  }
  return (
    <VStack gap={2} xstyle={[styles.errors, wide && styles.errorsWide]}>
      {errors.map((error) => (
        <AnnouncedBanner
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

/**
 * The frame: `top` above the page and `start` beside it, each where its width puts it, and the page
 * always at the same place in the tree.
 */
function Frame({
  bottom,
  children,
  isNarrow = false,
  start,
  top,
}: {
  bottom?: ReactNode;
  children: ReactNode;
  isNarrow?: boolean;
  start?: ReactNode;
  top?: ReactNode;
}) {
  const status = bottom !== undefined;
  return (
    <div
      {...stylex.props(
        styles.frame,
        status && styles.status,
        status && isNarrow && styles.statusNarrow,
      )}
    >
      {top}
      <div {...stylex.props(styles.row)}>
        {start}
        <LayoutContent isScrollable={false} padding={0} role="main" xstyle={styles.main}>
          {children}
        </LayoutContent>
      </div>
      {bottom}
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  const width = useWidthClass();
  const narrow = isNarrow(width);
  return (
    <SidebarAddForms>
      <FeatureSettingsHost>
        <RenameSessionHost>
          <StatusHintsProvider>
            <KeysProvider>
              <Frame
                bottom={<StatusLine isNarrow={narrow} slot={slot} />}
                isNarrow={narrow}
                start={narrow ? null : <Column isWide={width === "wide"} />}
                top={
                  narrow ? (
                    // The page's banner, by its role as the pages look it up, as `AppShell` drew it.
                    <header role="banner" {...stylex.props(styles.header)}>
                      <Tabs />
                    </header>
                  ) : null
                }
              >
                <LeaderMenuHost />
                <Writing />
                <ScrollKeys />
                <NotifyBanner />
                <Notifier />
                <UndoErrors />
                <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
              </Frame>
            </KeysProvider>
          </StatusHintsProvider>
        </RenameSessionHost>
      </FeatureSettingsHost>
    </SidebarAddForms>
  );
}

/**
 * The shell of a page that is not a repository's, like a name not in the list or a missing folder:
 * the repository menu alone, which reads no repository.
 */
export function BareShell({ children, current }: { children: ReactNode; current: string | null }) {
  return (
    <Frame
      top={
        <nav aria-label="Navigation" {...stylex.props(ruleStyles.below, styles.bare)}>
          <RepositoryMenu current={current} hasLogo />
        </nav>
      }
    >
      {children}
    </Frame>
  );
}
