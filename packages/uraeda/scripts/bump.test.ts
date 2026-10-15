import { expect, test } from "vite-plus/test";
import { absoluteLinks, addSection, isAfter, notes, parseRecord, setCargoVersion } from "./bump.ts";

const RECORD = `---
kind: feature
finished: 2026-10-15
pull-request: https://github.com/mrtolkien/uraeda/pull/16
---

# Record: Text inputs and comments

> [!NOTE]
>
> The record of a merged feature.

## What and why

Writing is most of what the human does
in the web UI.

The second paragraph is left out.

## Behaviour
`;

test("a record gives its kind, title, pull request, and first paragraph of what and why", () => {
  expect(parseRecord("specs/done/2026-10-14-text-inputs.md", RECORD)).toEqual({
    kind: "feature",
    path: "specs/done/2026-10-14-text-inputs.md",
    pullRequest: "https://github.com/mrtolkien/uraeda/pull/16",
    summary: "Writing is most of what the human does in the web UI.",
    title: "Text inputs and comments",
  });
});

test("the notes list features then changes, linked at the tag", () => {
  const feature = parseRecord("specs/done/a.md", RECORD);
  const change = {
    ...feature,
    kind: "change",
    path: "specs/done/b.md",
    pullRequest: null,
    title: "B",
  };
  expect(notes("0.5.0", "2026-10-15", [change, feature])).toBe(
    [
      "## 0.5.0 - 2026-10-15",
      "",
      "### Features",
      "",
      "- **[Text inputs and comments](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/a.md)** ([#16](https://github.com/mrtolkien/uraeda/pull/16)): Writing is most of what the human does in the web UI.",
      "",
      "### Changes",
      "",
      "- **[B](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/b.md)**: Writing is most of what the human does in the web UI.",
      "",
    ].join("\n"),
  );
});

test("a release without records says so", () => {
  expect(notes("0.5.1", "2026-10-16", [])).toBe(
    "## 0.5.1 - 2026-10-16\n\nNo feature or change recorded in `specs/done/`.\n",
  );
});

test("a section goes under the header, above older ones", () => {
  const first = addSection("", "## 0.5.0 - 2026-10-15\n\nA.\n");
  expect(first).toBe("# Changelog\n\n## 0.5.0 - 2026-10-15\n\nA.\n");
  expect(addSection(first, "## 0.6.0 - 2026-10-20\n\nB.\n")).toBe(
    "# Changelog\n\n## 0.6.0 - 2026-10-20\n\nB.\n\n## 0.5.0 - 2026-10-15\n\nA.\n",
  );
});

test("only the workspace's version changes in Cargo.toml", () => {
  const cargo = `[workspace]\nmembers = []\n\n[workspace.package]\nversion = "0.4.0"\nedition = "2024"\n\n[dependencies]\nfoo = { version = "1.0.0" }\n`;
  expect(setCargoVersion(cargo, "0.5.0")).toBe(cargo.replace('"0.4.0"', '"0.5.0"'));
  expect(() => setCargoVersion("[package]\n", "0.5.0")).toThrow("no [workspace.package] version");
});

test.each([
  ["0.5.0", "0.4.0", true],
  ["0.4.1", "0.4.0", true],
  ["1.0.0", "0.9.9", true],
  ["0.6.0-rc.1", "0.5.0", true],
  ["0.6.0", "0.6.0-rc.1", true],
  ["0.6.0-rc.2", "0.6.0-rc.1", true],
  ["0.4.0", "0.4.0", false],
  ["0.3.9", "0.4.0", false],
  ["0.4.0-rc.1", "0.4.0", false],
])("%s after %s: %s", (next, current, after) => {
  expect(isAfter(next, current)).toBe(after);
});

test("links relative to a record point at the tag, others stay", () => {
  expect(
    absoluteLinks(
      "[a](2026-10-14-run-ui.md), [b](../decisions/stack.md), [c](/README.md), [d](https://x.dev), [e](#q1)",
      "specs/done/r.md",
      "0.5.0",
    ),
  ).toBe(
    "[a](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/done/2026-10-14-run-ui.md), [b](https://github.com/mrtolkien/uraeda/blob/v0.5.0/specs/decisions/stack.md), [c](https://github.com/mrtolkien/uraeda/blob/v0.5.0/README.md), [d](https://x.dev), [e](#q1)",
  );
});
