import { expect, test } from "vite-plus/test";
import { matchStory, type StoryIndex } from "../index.ts";

/** One entry of a Storybook's index, its id given, as Storybook may rename a title. */
function entry(id: string, importPath: string, exportName: string) {
  return { exportName, id, importPath, name: exportName, title: id, type: "story" as const };
}

const INDEX: StoryIndex = {
  entries: {
    "invoicelist--empty": entry(
      "invoicelist--empty",
      "../specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx",
      "Empty",
    ),
    "layout-handle--grip": entry("layout-handle--grip", "./src/SidebarHandle.stories.tsx", "Grip"),
    "repeatmenu--open": entry("repeatmenu--open", "./src/tasks/RepeatMenu.stories.tsx", "Open"),
    "sidebarhandle--docs": {
      id: "sidebarhandle--docs",
      importPath: "./src/SidebarHandle.stories.tsx",
      name: "Docs",
      title: "SidebarHandle",
      type: "docs",
    },
    "sidebarhandle--dragging": entry(
      "sidebarhandle--dragging",
      "./src/SidebarHandle.stories.tsx",
      "Dragging",
    ),
  },
  v: 5,
};

// One row per entry and link: the entry's `importPath`, joined to the preview folder, is the
// link's file, and its `exportName` the link's export (R1).
test.each([
  [
    "the file and export",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Dragging",
    "sidebarhandle--dragging",
  ],
  [
    "a renamed title",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Grip",
    "layout-handle--grip",
  ],
  [
    "a mockups Storybook",
    "storybook",
    "specs/2026-11-02-invoices/mockups/InvoiceList.stories.tsx",
    "Empty",
    "invoicelist--empty",
  ],
  ["the root", ".", "src/tasks/RepeatMenu.stories.tsx", "Open", "repeatmenu--open"],
  [
    "an export not in the index",
    "packages/web",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Missing",
    undefined,
  ],
  [
    "another file's export",
    "packages/web",
    "packages/web/src/Other.stories.tsx",
    "Dragging",
    undefined,
  ],
  [
    "the file from another folder",
    "storybook",
    "packages/web/src/SidebarHandle.stories.tsx",
    "Dragging",
    undefined,
  ],
])("%s", (_, folder, path, name, id) => {
  expect(matchStory(INDEX, folder, { export: name, path })).toBe(id);
});
