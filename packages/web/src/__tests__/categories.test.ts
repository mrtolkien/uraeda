// @vitest-environment node
// The settings search: the rows it keeps in each section, by name, help, terms, and section.
import { expect, test } from "vite-plus/test";
import { CATEGORIES, shownLabels } from "../settings/categories.ts";

test.each([
  ["host", [["Allowed host names", "Server"]]],
  // The run map's row, by the old setting's words and by what it sets.
  ["FRESH", [["How each step runs", "Runs"]]],
  ["reviewer", [["How each step runs", "Runs"]]],
  // The continues' switches and their cap, under Runs.
  [
    "Continue",
    [
      ["Continue after a restart", "Runs"],
      ["Continue after a usage limit", "Runs"],
      ["Automatic continues in a row", "Runs"],
    ],
  ],
  // The mode and the themes are found by the colour scheme's old names, their own, and "theme".
  [
    "COLOUR",
    [
      ["Mode", "Appearance"],
      ["Dark theme", "Appearance"],
      ["Light theme", "Appearance"],
      ["Your themes", "Appearance"],
    ],
  ],
  [
    "scheme",
    [
      ["Mode", "Appearance"],
      ["Dark theme", "Appearance"],
      ["Light theme", "Appearance"],
    ],
  ],
  ["mocha", [["Dark theme", "Appearance"]]],
  ["Latte", [["Light theme", "Appearance"]]],
  [
    "THEME",
    [
      ["Mode", "Appearance"],
      ["Dark theme", "Appearance"],
      ["Light theme", "Appearance"],
      ["Your themes", "Appearance"],
    ],
  ],
  [
    "dark",
    [
      ["Mode", "Appearance"],
      ["Dark theme", "Appearance"],
    ],
  ],
  [
    "light",
    [
      ["Mode", "Appearance"],
      ["Light theme", "Appearance"],
    ],
  ],
  ["toml", [["Your themes", "Appearance"]]],
  // A setting's help finds it too.
  ["tailnet", [["Allowed host names", "Server"]]],
  // The search is trimmed, in any case.
  ["  vimrc ", [["Vim commands", "Keyboard"]]],
  [
    "sign-IN",
    [
      ["Sign out", "Sign-in"],
      ["Sign out everywhere", "Sign-in"],
    ],
  ],
  ["xyz", []],
])("searching %j finds %j", (text, found) => {
  // The rows the form keeps, in its order, each with its section.
  const shown = CATEGORIES.flatMap((category) =>
    [...shownLabels(category, text)].map((label) => [label, category.label]),
  );
  expect(shown).toEqual(found);
});
