// The settings page: one form of bordered sections, Server, Appearance, Sign-in, Agents, Runs, and
// Reviews, each setting a row. The search sits at the end of the heading row on wide screens, and
// under the heading on narrow ones; while it holds text, it filters the rows, and a section left
// without one is hidden. A section named in the address is scrolled into view.
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useLayoutEffect, useState } from "react";
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
import { AppearanceSettings, PlannedSettings, SignInSettings } from "./OtherSettings.tsx";
import { RunSettings } from "./RunSettings.tsx";
import { type ServerActions, ServerSettings, type ServerValues } from "./ServerSettings.tsx";

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
      width={wide ? "var(--size-settings-index)" : undefined}
    />
  );
}

/** Scrolls the section `id` names into view, unless the page has a place of its own to return to. */
function useScrollToSection(id: CategoryId | undefined) {
  useLayoutEffect(() => {
    if (id === undefined || typeof currentEntry().scroll === "number") {
      return;
    }
    document.getElementById(sectionId(id))?.scrollIntoView?.({ block: "start" });
  }, [id]);
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
  useScrollToSection(id);
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
      <VStack gap={6}>
        {wide ? (
          <HStack align="center" gap={4} justify="between">
            <Heading level={1}>Settings</Heading>
            {search}
          </HStack>
        ) : (
          <VStack gap={4}>
            <Heading level={1}>Settings</Heading>
            {search}
          </VStack>
        )}
        {sections.length > 0 ? (
          <VStack gap={6}>{sections}</VStack>
        ) : (
          <Text>No setting matches “{text.trim()}”.</Text>
        )}
      </VStack>
    </Page>
  );
}
