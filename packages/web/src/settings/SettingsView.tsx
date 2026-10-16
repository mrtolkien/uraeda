// The settings page's layout: on wide screens, the list of categories beside the open one, Server
// when none is named; on narrow screens, the list as a page, then each category as its own page.
// The search sits in the heading row on wide screens and first on narrow ones; while it holds text,
// its results take the place of the categories.
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type MouseEvent, type ReactNode, useState } from "react";
import { Page } from "../layout/Page.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { type Category, CATEGORIES, type CategoryId, searchSettings } from "./categories.ts";
import { AppearanceSettings, PlannedSettings, SignInSettings } from "./OtherSettings.tsx";
import { type ServerActions, ServerSettings, type ServerValues } from "./ServerSettings.tsx";

const styles = stylex.create({
  columns: {
    alignItems: "start",
    columnGap: spacingVars["--spacing-8"],
    display: "grid",
    gridTemplateColumns: "var(--size-settings-index) minmax(0, 1fr)",
  },
});

/** The list of categories, each a row leading to its page, the open one selected. */
function Index({
  open,
  pathOf,
}: {
  open: CategoryId | undefined;
  pathOf: (id: CategoryId) => string;
}) {
  return (
    <List aria-label="Categories" hasDividers>
      {CATEGORIES.map((category) => (
        <ListItem
          // Nodes, not strings, so a long line wraps instead of being cut.
          description={<>{category.summary}</>}
          href={pathOf(category.id)}
          isSelected={category.id === open}
          key={category.id}
          label={<>{category.label}</>}
        />
      ))}
    </List>
  );
}

/** One category's settings. */
function Open({
  category,
  server,
  serverActions,
}: {
  category: Category;
  server: ServerValues;
  serverActions: ServerActions;
}) {
  switch (category.id) {
    case "server":
      return <ServerSettings actions={serverActions} values={server} />;
    case "appearance":
      return <AppearanceSettings />;
    case "sign-in":
      return <SignInSettings />;
    default:
      return <PlannedSettings category={category} />;
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
      // As wide as the list of categories under it on a desktop; the whole line on a phone.
      width={wide ? "var(--size-settings-index)" : undefined}
    />
  );
}

/**
 * The settings `text` finds, each a row leading to its category; `onOpen` is called once a row
 * opened its category in the page, as the search is done.
 */
function Results({
  onOpen,
  pathOf,
  text,
}: {
  onOpen: () => void;
  pathOf: (id: CategoryId) => string;
  text: string;
}) {
  const found = searchSettings(text);
  if (found.length === 0) {
    return <Text>No setting matches “{text.trim()}”.</Text>;
  }
  return (
    <List
      aria-label="Settings found"
      hasDividers
      // The row's link opens its page in the app by preventing the browser's own navigation; a
      // link opened in a new tab leaves the search as it is.
      onClick={(event: MouseEvent) => {
        if (event.defaultPrevented) {
          onOpen();
        }
      }}
    >
      {found.map(({ category, label }) => (
        <ListItem
          description={<>{category.label}</>}
          href={pathOf(category.id)}
          key={`${category.id}/${label}`}
          label={<>{label}</>}
        />
      ))}
    </List>
  );
}

/** A phone's page: the search first, then its results, the list of categories, or one category. */
function Narrow({
  category,
  indexPath,
  pathOf,
  results,
  search,
  settings,
}: {
  category: Category | undefined;
  indexPath: string;
  pathOf: (id: CategoryId) => string;
  results: ReactNode | undefined;
  search: ReactNode;
  settings: ReactNode;
}) {
  let content: ReactNode;
  if (results) {
    content = results;
  } else if (!category) {
    content = (
      <>
        <Heading level={1}>Settings</Heading>
        <Index open={undefined} pathOf={pathOf} />
      </>
    );
  } else {
    content = (
      <>
        {/* A button, not a link in text: the way back is as tall as a control for a finger. */}
        <HStack>
          <Button href={indexPath} label="‹ Settings" variant="ghost" />
        </HStack>
        {settings}
      </>
    );
  }
  return (
    <Page>
      <VStack gap={4}>
        {search}
        {content}
      </VStack>
    </Page>
  );
}

/**
 * The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`: `indexPath` is
 * the first, and `pathOf` builds a category's address. An unknown category reads as none.
 */
export function SettingsView({
  category: id,
  indexPath,
  initialSearch = "",
  pathOf,
  server,
  serverActions,
}: {
  category: CategoryId | undefined;
  indexPath: string;
  /** The search's text when the page opens, for the stories; empty by default. */
  initialSearch?: string;
  pathOf: (id: CategoryId) => string;
  server: ServerValues;
  serverActions: ServerActions;
}) {
  const wide = useWidthClass() === "wide";
  const [text, setText] = useState(initialSearch);
  const category = CATEGORIES.find((each) => each.id === id);
  const open = category ?? CATEGORIES[0];
  const settings = <Open category={open} server={server} serverActions={serverActions} />;
  const search = <SearchField onChange={setText} text={text} wide={wide} />;
  const results =
    text.trim() === "" ? undefined : (
      <Results onOpen={() => setText("")} pathOf={pathOf} text={text} />
    );
  if (!wide) {
    return (
      <Narrow
        category={category}
        indexPath={indexPath}
        pathOf={pathOf}
        results={results}
        search={search}
        settings={settings}
      />
    );
  }
  return (
    <Page>
      <VStack gap={6}>
        <HStack align="center" gap={4} justify="between">
          <Heading level={1}>Settings</Heading>
          {search}
        </HStack>
        {results ?? (
          <div {...stylex.props(styles.columns)}>
            <Index open={open.id} pathOf={pathOf} />
            <div>{settings}</div>
          </div>
        )}
      </VStack>
    </Page>
  );
}
