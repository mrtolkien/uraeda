// The shell around every page of a repository: on semi-wide and wide screens, the column beside the
// page (`shell/Column.tsx`); on the phone, the bar of tabs above it (`shell/Tabs.tsx`); at every
// width, the status line at the bottom of the window (`shell/StatusLine.tsx`), and the toast of the
// git writes still landing over it (`writes/CommitToast.tsx`). The page keeps its place in the tree
// as the window crosses a width, so its text, focus, and scroll stay. The shell's frame is our own
// (plan, Complexity tracking): Astryx's `AppShell` draws its own navigation for the phone.
import { LayoutContent } from "@astryxdesign/core/Layout";
import { VStack } from "@astryxdesign/core/VStack";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { safeAreaVars } from "./layout/safeArea.stylex.ts";
import { type ReactNode, Suspense, useLayoutEffect, useState } from "react";
import { LeaderMenuHost } from "./keys/LeaderMenuHost.tsx";
import { KeyPickerHost } from "./keys/KeyPickerHost.tsx";
import { LeaderKeys } from "./keys/LeaderKeys.tsx";
import { KeysProvider } from "./keys/registry.tsx";
import { ScrollKeys } from "./keys/scroll.ts";
import { AnnouncedBanner } from "./layout/AnnouncedBanner.tsx";
import { targetVars } from "./layout/target.stylex.ts";
import { TopBarSlotProvider } from "./layout/TopBarSlot.tsx";
import { UndoKey, useUndoErrors } from "./layout/useUndoToast.ts";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { Notifier, NotifyBanner } from "./notify/Notifier.tsx";
import { RepositoryMenu } from "./RepositoryMenu.tsx";
import { Column, PhoneColumn } from "./shell/Column.tsx";
import { useShellPath } from "./shell/ShellPanes.tsx";
import { StatusLine } from "./shell/StatusLine.tsx";
import { Tabs } from "./shell/Tabs.tsx";
import { FeatureSettingsHost } from "./sidebar/FeatureSettingsDialog.tsx";
import { RenameSessionHost } from "./sidebar/RenameSession.tsx";
import { VimSetting } from "./fields/editor/vim/VimSetting.tsx";
import { SingleKeysSetting } from "./settings/SingleKeysSetting.tsx";
import { SidebarAddForms } from "./SidebarAdd.tsx";
import { StatusLineCoverProvider } from "./statusHints.tsx";
import { CommitToast } from "./writes/CommitToast.tsx";
import { ruleStyles } from "./layout/rules.ts";

const styles = stylex.create({
  bare: {
    // A page of no repository: the menu alone, above the page.
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
  errors: {
    // The errors of refused Undos, above the page.
    boxSizing: "border-box",
    marginInline: "auto",
    paddingBlockStart: spacingVars["--spacing-4"],
    // The phone page's inset (`Page.tsx`), a property of its own, as the token lint takes a `var()`
    // only whole, not in a calc.
    "--errors-inset": `calc(var(--size-rail-inset) + ${borderVars["--border-width"]})`,
    paddingInline: "var(--errors-inset)",
    width: "100%",
  },
  errorsWide: {
    // The page's own inset on wide screens, and a page of rows' text column: the banner lines up
    // with its column.
    maxWidth: `calc(var(--size-reading-pane) + 2 * ${spacingVars["--spacing-8"]})`,
    paddingBlockStart: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-8"],
  },
  frame: {
    // The page's surface behind a short page too.
    backgroundColor: colorVars["--color-background-surface"],
    // The room a page has under the bars, which a page as tall as the window takes (`Page`).
    "--size-page-height": "var(--size-viewport-height)",
    minHeight: "var(--size-viewport-height)",
  },
  header: {
    // The phone's tabs, in view while the page scrolls, below the status bar of a home-screen app
    // that draws under it. Over a question's sticky header too, which slides up under the tabs as
    // its card leaves (`QuestionCard.tsx`), never over them.
    backgroundColor: colorVars["--color-background-body"],
    paddingBlockStart: safeAreaVars["--safe-area-top"],
    position: "sticky",
    top: 0,
    zIndex: 3,
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
    // and the page's end scrolls past it. One row of its text and little more, as a terminal's:
    // a row as tall as a pointer's target, which its hints fill, under its hairline.
    "--size-status-line": `calc(${targetVars["--target-least"]} + ${borderVars["--border-width"]})`,
    "--size-viewport-height": "calc(100dvh - var(--size-status-line))",
    // The surface goes on under the status line, which the phone's lets show between its corner
    // buttons, under a short page too.
    "--size-frame-height": "100dvh",
    boxSizing: "border-box",
    minHeight: "var(--size-frame-height)",
    paddingBlockEnd: "var(--size-status-line)",
  },
  // The phone's bar out of the way: what sits on it, as the commit toast, follows it down
  // (`writes/CommitToast.tsx`).
  statusAway: { "--status-line-offset": "0px" },
  // On the phone, the tabs' bar on top too (`shell/Tabs.tsx`).
  narrow: {
    "--size-page-height": `calc(var(--size-viewport-height) - ${spacingVars["--spacing-12"]})`,
    // The page's end scrolls clear of the home indicator, as an iPhone's own lists do.
    paddingBlockEnd: safeAreaVars["--safe-area-bottom"],
  },
  statusNarrow: {
    // On the phone, a row as tall as the tabs', which holds the page's controls, as a round's Next,
    // above the home indicator and clear of the screen's rounded corners: the safe area under it.
    "--size-status-line": `calc(${spacingVars["--spacing-12"]} + ${safeAreaVars["--safe-area-bottom"]})`,
  },
});

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
  isAway = false,
  isNarrow = false,
  start,
  top,
}: {
  bottom?: ReactNode;
  children: ReactNode;
  /** Whether the phone's bar is out of the way. */
  isAway?: boolean;
  isNarrow?: boolean;
  start?: ReactNode;
  top?: ReactNode;
}) {
  const status = bottom !== undefined;
  useStatusLineScrollPadding(status && !isNarrow);
  return (
    <div
      {...stylex.props(
        styles.frame,
        isNarrow && styles.narrow,
        status && styles.status,
        status && isNarrow && styles.statusNarrow,
        isAway && styles.statusAway,
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

/**
 * While the status line takes the window's bottom row, what the keys bring into view, a list's
 * selected row or a focused button, scrolls clear of it: the document's scroll padding is its
 * height (WCAG 2.4.11, focus not obscured). The phone's bar slides away, and keeps its own.
 */
function useStatusLineScrollPadding(isOn: boolean) {
  useLayoutEffect(() => {
    if (!isOn) {
      return undefined;
    }
    const root = document.documentElement;
    root.style.scrollPaddingBlockEnd = spacingVars["--spacing-5"];
    return () => {
      root.style.scrollPaddingBlockEnd = "";
    };
  }, [isOn]);
}

/** The single-key switch's state and its setter, as `useState` gives them. */
export type KeysSwitch = readonly [boolean, (on: boolean) => void];

/**
 * The frame of a repository's pages. `keysSwitch` holds the single-key switch above the
 * repository-keyed client, which draws the shell anew for each repository: the switch then keeps
 * its value across the change, and the letter hints do not show for the moment before it is read
 * again. Without it (a story), the shell keeps its own.
 */
export function Shell({ children, keysSwitch }: { children: ReactNode; keysSwitch?: KeysSwitch }) {
  const [slot, setSlot] = useState<ReactNode>(null);
  const own = useState(true);
  const [singleKeys, setSingleKeys] = keysSwitch ?? own;
  const width = useWidthClass();
  const narrow = isNarrow(width);
  // The phone's column, which the tabs' toggle opens over the page: it folds as a page opens.
  const [isSidebarOpen, setSidebarOpen] = useState(false);
  // Whether the phone's bar slid out of the way, which the composer follows.
  const [isBarAway, setBarAway] = useState(false);
  const pathname = useShellPath();
  const [sidebarPath, setSidebarPath] = useState(pathname);
  if (sidebarPath !== pathname) {
    setSidebarPath(pathname);
    setSidebarOpen(false);
  }
  return (
    <SidebarAddForms>
      <FeatureSettingsHost>
        <RenameSessionHost>
          <StatusLineCoverProvider>
            <KeysProvider singleKeys={singleKeys}>
              <SingleKeysSetting onRead={setSingleKeys} />
              <VimSetting />
              <Frame
                // The phone has no bar but for a page's own controls: none takes no room there.
                bottom={
                  narrow && slot === null ? undefined : (
                    <StatusLine isNarrow={narrow} onAway={setBarAway} slot={slot} />
                  )
                }
                isAway={isBarAway}
                isNarrow={narrow}
                start={
                  narrow ? (
                    <PhoneColumn isOpen={isSidebarOpen} />
                  ) : (
                    <Column isWide={width === "wide"} />
                  )
                }
                top={
                  narrow ? (
                    // The page's banner, by its role as the pages look it up, as `AppShell` drew it.
                    <header role="banner" {...stylex.props(styles.header)}>
                      <Tabs
                        isSidebarOpen={isSidebarOpen}
                        onToggleSidebar={() => setSidebarOpen((open) => !open)}
                      />
                    </header>
                  ) : null
                }
              >
                <LeaderMenuHost />
                {/* The queue's first read never holds the page back. */}
                <Suspense fallback={null}>
                  <CommitToast />
                </Suspense>
                <ScrollKeys />
                <UndoKey />
                <LeaderKeys />
                <NotifyBanner />
                <Notifier />
                <UndoErrors />
                <KeyPickerHost />
                <TopBarSlotProvider onChange={setSlot}>{children}</TopBarSlotProvider>
              </Frame>
            </KeysProvider>
          </StatusLineCoverProvider>
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
