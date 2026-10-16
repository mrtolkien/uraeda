// The settings page's layout: on wide screens, the list of categories beside the open one, Server
// when none is named; on narrow screens, the list as a page, then each category as its own page.
import { Heading } from "@astryxdesign/core/Heading";
import { Link } from "@astryxdesign/core/Link";
import { List, ListItem } from "@astryxdesign/core/List";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Page } from "../layout/Page.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { type Category, CATEGORIES, type CategoryId } from "./categories.ts";
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

/**
 * The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`: `indexPath` is
 * the first, and `pathOf` builds a category's address. An unknown category reads as none.
 */
export function SettingsView({
  category: id,
  indexPath,
  pathOf,
  server,
  serverActions,
}: {
  category: CategoryId | undefined;
  indexPath: string;
  pathOf: (id: CategoryId) => string;
  server: ServerValues;
  serverActions: ServerActions;
}) {
  const wide = useWidthClass() === "wide";
  const category = CATEGORIES.find((each) => each.id === id);
  if (!wide && !category) {
    return (
      <Page>
        <VStack gap={4}>
          <Heading level={1}>Settings</Heading>
          <Index open={undefined} pathOf={pathOf} />
        </VStack>
      </Page>
    );
  }
  const open = category ?? CATEGORIES[0];
  const settings = <Open category={open} server={server} serverActions={serverActions} />;
  if (!wide) {
    return (
      <Page>
        <VStack gap={4}>
          <Link href={indexPath}>
            <Text>‹ Settings</Text>
          </Link>
          {settings}
        </VStack>
      </Page>
    );
  }
  return (
    <Page>
      <VStack gap={6}>
        <Heading level={1}>Settings</Heading>
        <div {...stylex.props(styles.columns)}>
          <Index open={open.id} pathOf={pathOf} />
          <div>{settings}</div>
        </div>
      </VStack>
    </Page>
  );
}
