// @vitest-environment node
// The settings search: the rows it keeps in each section, by name, help, terms, and section.
import { expect, test } from "vite-plus/test";
import { CATEGORIES, shownLabels } from "../settings/categories.ts";

test.each([
  ["host", [["Allowed host names", "Server"]]],
  ["FRESH", [["Build in a fresh session", "Runs"]]],
  // The colour scheme is found by its name, its choices, and "theme".
  ["COLOUR", [["Colour scheme", "Appearance"]]],
  ["scheme", [["Colour scheme", "Appearance"]]],
  ["mocha", [["Colour scheme", "Appearance"]]],
  ["Latte", [["Colour scheme", "Appearance"]]],
  ["THEME", [["Colour scheme", "Appearance"]]],
  ["dark", [["Colour scheme", "Appearance"]]],
  ["light", [["Colour scheme", "Appearance"]]],
  // A setting's help finds it too.
  ["tailnet", [["Allowed host names", "Server"]]],
  [
    "  model ",
    [
      ["The model and effort of each step", "Agents"],
      ["The review's command, model, and number of reviewers", "Reviews"],
      ["A second review by another model", "Reviews"],
    ],
  ],
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
