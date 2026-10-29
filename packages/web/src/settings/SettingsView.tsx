// The settings page: one form of bordered sections, Server, Appearance, Keyboard, Sign-in, Agents,
// Runs, and Reviews, each setting a row. The search sits at the end of the heading row on wide screens, and
// under the heading on narrow ones; while it holds text, it filters the rows, and a section left
// without one is hidden. The title and the search stay in view as the page scrolls. A section named
// in the address is scrolled into view, below them.
import { TextInput } from "@astryxdesign/core/TextInput";
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
import {
  AppearanceSettings,
  FontSettings,
  PlannedSettings,
  SignInSettings,
} from "./OtherSettings.tsx";
import { RunSettings } from "./RunSettings.tsx";
import { RefusalsProvider } from "./SettingRow.tsx";
import { type ServerActions, ServerSettings, type ServerValues } from "./ServerSettings.tsx";
import { Empty } from "../layout/Empty.tsx";
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

/** One section's rows, those `shows` keeps. */
function Rows({
  category,
  server,
  serverActions,
  shows,
}: {
  category: Category;
  server: ServerValues;
  serverActions: ServerActions;
  shows: (label: string) => boolean;
}) {
  const props = { actions: serverActions, category, shows, values: server };
  switch (category.id) {
    case "server":
      return <ServerSettings {...props} />;
    case "appearance":
      return <AppearanceSettings category={category} />;
    case "fonts":
      return <FontSettings category={category} shows={shows} />;
    case "keyboard":
      return <KeyboardSettings {...props} />;
    case "sign-in":
      return <SignInSettings category={category} shows={shows} />;
    case "runs":
      return <RunSettings {...props} />;
    default:
      return <PlannedSettings category={category} shows={shows} />;
  }
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
    <TextInput
      isLabelHidden
      label="Search settings"
      onChange={onChange}
      placeholder="Search settings"
      startIcon="search"
      value={text}
      // A field's width at the end of the heading row on a desktop; the whole line on a phone.
      width={wide ? "var(--size-settings-search)" : undefined}
    />
  );
}

/**
 * Scrolls the section `id` names into view, unless the page has a place of its own to return to,
 * below the sticky `bar`, with room for the pane's title, which stands half over its border.
 */
function useScrollToSection(id: CategoryId | undefined, bar: RefObject<HTMLElement | null>) {
  useLayoutEffect(() => {
    if (id === undefined || typeof currentEntry().scroll === "number") {
      return;
    }
    const target = document.getElementById(sectionId(id));
    if (target && bar.current) {
      const stuckAt = Number.parseFloat(getComputedStyle(bar.current).top) || 0;
      target.style.scrollMarginTop = `${stuckAt + bar.current.offsetHeight + 16}px`;
    }
    target?.scrollIntoView?.({ block: "start" });
  }, [bar, id]);
}

/**
 * The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`, which scrolls to
 * that category's section. An unknown category reads as none.
 */
export function SettingsView({
  category: id,
  initialSearch = "",
  server,
  serverActions,
}: {
  category: CategoryId | undefined;
  /** The search's text when the page opens, for the stories; empty by default. */
  initialSearch?: string;
  server: ServerValues;
  serverActions: ServerActions;
}) {
  const wide = !isNarrow(useWidthClass());
  const [text, setText] = useState(initialSearch);
  const bar = useRef<HTMLDivElement>(null);
  useScrollToSection(id, bar);
  const search = <SearchField onChange={setText} text={text} wide={wide} />;
  const sections = CATEGORIES.map((category) => ({ category, shown: shownLabels(category, text) }))
    .filter(({ shown }) => shown.size > 0)
    .map(({ category, shown }) => (
      <Pane
        icon={category.icon}
        id={sectionId(category.id)}
        key={category.id}
        title={category.label}
      >
        <Rows
          category={category}
          server={server}
          serverActions={serverActions}
          shows={(label) => shown.has(label)}
        />
      </Pane>
    ));
  return (
    <Page>
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
