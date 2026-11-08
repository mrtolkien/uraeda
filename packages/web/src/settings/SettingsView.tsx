// The settings page: one form of bordered sections, Server, Appearance, Fonts, Keyboard, Sign-in,
// Runs, and Extensions, which draws its own two, yours and the built-in ones; each setting a row. The search sits at the end of the heading row on wide screens, and
// under the heading on narrow ones; while it holds text, it filters the rows, and a section left
// without one is hidden. The title and the search stay in view as the page scrolls. A section named
// in the address is scrolled into view, below them.
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type RefObject, useLayoutEffect, useRef, useState } from "react";
import { Page } from "../layout/Page.tsx";
import { Pane } from "../layout/Pane.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { currentEntry } from "../routeHistory.ts";
import {
  type Category,
  CATEGORIES,
  type CategoryId,
  sectionId,
  shownLabels,
} from "./categories.ts";
import { KeyboardSettings } from "./KeyboardSettings.tsx";
import { AppearanceSettings, type AppearanceThemes } from "./AppearanceSettings.tsx";
import { FontSettings, SignInSettings } from "./OtherSettings.tsx";
import { RunSettings } from "./RunSettings.tsx";
import {
  type ExtensionActions,
  ExtensionSettings,
  type ExtensionsValues,
} from "./ExtensionSettings.tsx";
import { extensionsCategory } from "./extensions.ts";
import { RefusalsProvider } from "./SettingRow.tsx";
import { type ServerActions, ServerSettings, type ServerValues } from "./ServerSettings.tsx";
import { Empty } from "../layout/Empty.tsx";
import { TextLine } from "../fields/TextLine.tsx";
import { PageTitle } from "../layout/PageTitle.tsx";

const styles = stylex.create({
  // The title and the search, which stay in view as the sections scroll under them: on a phone,
  // under the tabs, which stay too. Over the page's own surface, a step taller than its content each
  // side so that nothing shows around it, with the page's layout unchanged.
  bar: {
    backgroundColor: colorVars["--color-background-surface"],
    marginBlock: `calc(-1 * ${spacingVars["--spacing-2"]})`,
    paddingBlock: spacingVars["--spacing-2"],
    position: "sticky",
    top: 0,
    zIndex: 1,
  },
  barPhone: { top: spacingVars["--spacing-12"] },
});

const jumpStyles = stylex.create({
  // The section jumped to stops below the bar, `margin` from the top.
  margin: (margin: number) => ({ scrollMarginTop: margin }),
});

/** One section's rows, those `shows` keeps. */
function Rows({
  category,
  server,
  serverActions,
  shows,
  themes,
}: {
  category: Category;
  server: ServerValues;
  serverActions: ServerActions;
  shows: (label: string) => boolean;
  themes: AppearanceThemes;
}) {
  const props = { actions: serverActions, category, shows, values: server };
  switch (category.id) {
    case "server":
      return <ServerSettings {...props} />;
    case "appearance":
      return <AppearanceSettings category={category} shows={shows} themes={themes} />;
    case "fonts":
      return <FontSettings category={category} shows={shows} />;
    case "keyboard":
      return <KeyboardSettings {...props} />;
    case "sign-in":
      return <SignInSettings category={category} shows={shows} />;
    case "runs":
      return <RunSettings {...props} />;
    case "extensions":
      // Drawn by `ExtensionSettings` itself, in its own panes.
      return null;
  }
}

/** The sections the page has: the Extensions one with a row per extension, or none without them. */
function categoriesOf(extensions: ExtensionsValues | undefined): ReadonlyArray<Category> {
  return CATEGORIES.flatMap((category) => {
    if (category.id !== "extensions") {
      return [category];
    }
    return extensions ? [extensionsCategory(category, extensions.extensions)] : [];
  });
}

/** The search field: its text is the page's own, never saved, like the repository menu's filter. */
function SearchField({
  onChange,
  text,
  wide,
}: {
  onChange: (text: string) => void;
  text: string;
  wide: boolean;
}) {
  return (
    <TextLine
      isLabelHidden
      label="Search settings"
      onChange={onChange}
      placeholder="Search settings"
      value={text}
      // A field's width at the end of the heading row on a desktop; the whole line on a phone.
      width={wide ? "var(--size-settings-search)" : undefined}
    />
  );
}

/**
 * Scrolls the section `id` names into view, unless the page has a place of its own to return to,
 * below the sticky `bar`, with room for the pane's title, which stands half over its border. The
 * room is measured once drawn, set on the section's scroll margin, and the scroll follows once it
 * is: the jump, which the section's pane takes (`jumpStyles`).
 */
function useScrollToSection(id: CategoryId | undefined, bar: RefObject<HTMLElement | null>) {
  const [jump, setJump] = useState<{ margin: number | undefined; to: CategoryId }>();
  useLayoutEffect(() => {
    if (id === undefined || typeof currentEntry().scroll === "number") {
      return;
    }
    const stuckAt = bar.current ? Number.parseFloat(getComputedStyle(bar.current).top) || 0 : 0;
    // oxlint-disable-next-line react/set-state-in-effect -- the room is the bar's height, read only once drawn; the jump waits for it, and both happen before the page shows
    setJump({
      margin: bar.current ? stuckAt + bar.current.offsetHeight + 16 : undefined,
      to: id,
    });
  }, [bar, id]);
  useLayoutEffect(() => {
    if (jump) {
      document.getElementById(sectionId(jump.to))?.scrollIntoView?.({ block: "start" });
    }
  }, [jump]);
  return jump;
}

/**
 * The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`, which scrolls to
 * that category's section. An unknown category reads as none.
 */
export function SettingsView({
  category: id,
  extensionActions,
  extensions,
  initialSearch = "",
  server,
  serverActions,
  themes,
}: {
  category: CategoryId | undefined;
  /** What the Extensions section changes. */
  extensionActions?: ExtensionActions;
  /** What the Extensions section reads: without it, as in most stories, the section is left out. */
  extensions?: ExtensionsValues;
  /** The search's text when the page opens, for the stories; empty by default. */
  initialSearch?: string;
  server: ServerValues;
  serverActions: ServerActions;
  /** The colour themes, as the server serves them. */
  themes: AppearanceThemes;
}) {
  const wide = !isNarrow(useWidthClass());
  const [text, setText] = useState(initialSearch);
  const bar = useRef<HTMLDivElement>(null);
  const jump = useScrollToSection(id, bar);
  const search = <SearchField onChange={setText} text={text} wide={wide} />;
  const sections = categoriesOf(extensions)
    .map((category) => ({ category, shown: shownLabels(category, text) }))
    .filter(({ shown }) => shown.size > 0)
    .map(({ category, shown }) => {
      const jumped = [
        jump?.to === category.id && jump.margin !== undefined && jumpStyles.margin(jump.margin),
      ];
      if (category.id === "extensions" && extensions && extensionActions) {
        return (
          <div id={sectionId(category.id)} key={category.id} {...stylex.props(jumped)}>
            <ExtensionSettings
              actions={extensionActions}
              isSearching={text.trim() !== ""}
              shows={(label) => shown.has(label)}
              values={extensions}
            />
          </div>
        );
      }
      return (
        <Pane
          icon={category.icon}
          id={sectionId(category.id)}
          key={category.id}
          title={category.label}
          xstyle={jumped}
        >
          <Rows
            category={category}
            server={server}
            serverActions={serverActions}
            shows={(label) => shown.has(label)}
            themes={themes}
          />
        </Pane>
      );
    });
  return (
    <Page beside="--size-setting-control" kind="rows">
      <RefusalsProvider>
        <VStack gap={6}>
          <div ref={bar} {...stylex.props(styles.bar, !wide && styles.barPhone)}>
            <PageTitle aside={search}>Settings</PageTitle>
          </div>
          {sections.length > 0 ? (
            <VStack gap={6}>{sections}</VStack>
          ) : (
            <Empty>No setting matches “{text.trim()}”.</Empty>
          )}
        </VStack>
      </RefusalsProvider>
    </Page>
  );
}
