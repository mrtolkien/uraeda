// The inbox's panes: the notes of each category, and each category as a section of the list and
// as its pickers list it.
import type { useInbox } from "./data.ts";
import type { PickerItem } from "./keys/pickerSources.ts";

/** The inbox as the page reads it. */
export type Inbox = NonNullable<ReturnType<typeof useInbox>>;

/** A section's id: "none" for the notes before the first category. */
export function sectionId(name: string | undefined) {
  return name === undefined ? "none" : `category:${name}`;
}

/** The notes of each pane: "No category" when it holds notes, then every category, file order. */
export function panesOf(inbox: Inbox) {
  const notesOf = new Map(inbox.categories.map((category) => [category.name, category.notes]));
  const none = notesOf.get(undefined);
  return [
    ...(none && none.length > 0 ? [{ name: undefined, notes: none }] : []),
    ...inbox.names.map((name) => ({
      name: name as string | undefined,
      notes: notesOf.get(name) ?? [],
    })),
  ];
}

/** A category's pane, with its notes. */
export type Category = ReturnType<typeof panesOf>[number];

/** A category as its pickers list it, by its pane's id, its notes as its preview. */
export function itemOf(category: Category): PickerItem {
  const title = category.name ?? "No category";
  return {
    icon: "uraeda:layers",
    id: sectionId(category.name),
    kind: "notes",
    path: "",
    preview: [`## ${title}`, "", ...category.notes.map((note) => `- ${note.text}`)].join("\n"),
    title,
  };
}
