// What a card of the New page inserts in the composer: its text, its nested lines, and a link to
// its file, which the started proposal keeps in its own folder.
import { expect, test } from "vite-plus/test";
import { insertion } from "../NewEntries.tsx";

/** The link is from the repository's root: a relative one would point inside the proposal's folder. */
test("an entry links its file from the repository's root", () => {
  const text = insertion({
    file: "specs/PRIORITIES.md",
    id: "now-1",
    kind: "line",
    lines: ["A detail", "  A deeper one"],
    text: "Amend the latest commit",
  });

  expect(text).toBe(
    "Amend the latest commit\n- A detail\n  - A deeper one\nFrom [PRIORITIES.md](/specs/PRIORITIES.md)",
  );
});
