// The shell around every page of a repository: on semi-wide and wide screens, the column beside the
// page (`shell/Column.tsx`); on the phone, the bar of tabs above it (`shell/Tabs.tsx`). The page
// keeps its place in the tree as the window crosses a width, so its text, focus, and scroll stay.
// The shell's frame is our own (plan, Complexity tracking): Astryx's `AppShell` draws its own
// navigation for the phone.
import { LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, useState } from "react";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { useUndoErrors } from "./layout/useUndoToast.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Notifier, NotifyBanner } from "./notify/Notifier.tsx";
import { RepositoryMenu } from "./RepositoryMenu.tsx";
import { Column } from "./shell/Column.tsx";
import { Tabs } from "./shell/Tabs.tsx";
import { FeatureSettingsHost } from "./sidebar/FeatureSettingsDialog.tsx";
import { RenameSessionHost } from "./sidebar/RenameSession.tsx";
import { SidebarAddForms } from "./SidebarAdd.tsx";
import { useWrites } from "./writes/store.ts";
import { WriteProgress } from "./writes/WriteFeedback.tsx";

const styles = stylex.create({
  bare: {
    // A page of no repository: the menu alone, above the page.
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: borderVars["--border-width"],
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
    // The phone's tabs, and a page's own controls under them, in view while the page scrolls.
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
  slot: {
    // A page's own controls, like a round's Next, at the top of the page until the status line:
    // under the tabs on the phone, a row as tall as theirs.
    alignItems: "center",
    boxSizing: "border-box",
    display: "flex",
    gap: spacingVars["--spacing-2"],
    justifyContent: "flex-end",
    minHeight: spacingVars["--spacing-12"],
    paddingInline: spacingVars["--spacing-4"],
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
  children,
  start,
  top,
}: {
  children: ReactNode;
  start?: ReactNode;
  top?: ReactNode;
}) {
  return (
    <div {...stylex.props(styles.frame)}>
      {top}
      <div {...stylex.props(styles.row)}>
        {start}
        <LayoutContent isScrollable={false} padding={0} role="main" xstyle={styles.main}>
          {children}
        </LayoutContent>
      </div>
    </div>
  );
}

export function Shell({ children }: { children: ReactNode }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  const width = useWidthClass();
  const narrow = isNarrow(width);
  const slotted = slot !== null && <div {...stylex.props(styles.slot)}>{slot}</div>;
  return (
    <SidebarAddForms>
      <FeatureSettingsHost>
        <RenameSessionHost>
          <Frame
            start={narrow ? null : <Column isWide={width === "wide"} />}
            top={
              narrow ? (
                // The page's banner, by its role as the pages look it up, as `AppShell` drew it.
                <header role="banner" {...stylex.props(styles.header)}>
                  <Tabs />
                  {slotted}
                </header>
              ) : null
            }
          >
            <Writing />
            <NotifyBanner />
            <Notifier />
            <UndoErrors />
            {!narrow && slotted}
            <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
          </Frame>
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
        <nav aria-label="Navigation" {...stylex.props(styles.bare)}>
          <RepositoryMenu current={current} hasLogo />
        </nav>
      }
    >
      {children}
    </Frame>
  );
}
