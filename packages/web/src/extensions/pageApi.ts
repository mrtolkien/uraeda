// The page API: what an extension's page module, and each of Uraeda's built-ins, registers through.
// Every registration is tagged with its extension, and undone with it, by `remove`.
import type {
  Contribution,
  ExtensionKey,
  HomePane,
  ItemRenderer,
  NewSection,
  Place,
  Registry,
  SettingsSection,
  StatusItem,
} from "./registry.ts";

export type PageApi = {
  homePane(pane: HomePane): void;
  itemRenderer(renderer: ItemRenderer): void;
  key(key: ExtensionKey): void;
  newSection(section: NewSection): void;
  place(place: Place): void;
  settingsSection(section: SettingsSection): void;
  statusItem(item: StatusItem): void;
};

/**
 * The page API of the extension `name` over `registry`, with `remove`, which undoes all it
 * registered. A built-in gives its `order` among the built-ins; `title` names it where another
 * extension's key clashes with its own.
 */
export function pageApi(
  name: string,
  registry: Registry,
  { order, title = name }: { order?: number; title?: string } = {},
): PageApi & { remove(): void } {
  const extension = { name, title };
  const add = (contribution: Contribution) =>
    void registry.register(extension, order, contribution);
  return {
    homePane: (value) => add({ kind: "homePane", value }),
    itemRenderer: (value) => add({ kind: "itemRenderer", value }),
    key: (value) => add({ kind: "key", value }),
    newSection: (value) => add({ kind: "newSection", value }),
    place: (value) => add({ kind: "place", value }),
    remove: () => registry.remove(name),
    settingsSection: (value) => add({ kind: "settingsSection", value }),
    statusItem: (value) => add({ kind: "statusItem", value }),
  };
}
