// What the document renderer does that a look at the gallery would not show: a diagram that
// cannot be drawn shows its source, and a reply that grows draws each finished block once, only
// its last block changing as pieces come.
import { type App, expect, open, test } from "nsh/test";

const page = (check: string) =>
  open("./__checks__/document.tsx", {
    height: 800,
    host: { params: { check } },
    width: 1400,
  });

/** A number the page says after `label`. */
const said = (app: App, label: string) =>
  Number(
    app
      .texts()
      .find((text) => text.startsWith(label))
      ?.slice(label.length),
  );

/** Sends `count` pieces one after the other, and returns the blocks made after each. */
async function appended(app: App, count: number, made: Array<number>): Promise<Array<number>> {
  if (count === 0) return made;
  await app.host.send("append");
  return appended(app, count - 1, [...made, said(app, "Made: ")]);
}

test("a diagram that fails shows its source", async () => {
  const app = await page("diagrams");
  await app.waitUntil(() => app.texts().join("\n").includes("could not be drawn"));
  await app.waitUntil(() => app.count("id:diagram-picture") === 1);
  const texts = app.texts().join("\n");
  // The broken one: its source, and why.
  expect(texts).toContain("A[Proposal --> ((");
  expect(texts).toContain("The diagram could not be drawn");
  // The one Merman draws is a picture: its source is not shown.
  expect(texts).not.toContain("B -- Yes --> C[Round]");
});

test("a growing reply redraws its last block only", async () => {
  const app = await page("reply");
  // The reply comes in pieces of 7 characters: its blocks finish one after the other while the
  // last grows, and none is made again: a block made twice would count past the reply's blocks.
  const pieces = said(app, "Pieces: ");
  const blocks = said(app, "Blocks: ");
  const made = await appended(app, pieces, []);
  expect(made.at(-1)).toBe(blocks - 1);
  expect(made).toEqual(made.toSorted((a, b) => a - b));
  expect(app.texts().join("\n")).toContain("And the last one, still growing.");
  // The reply ends: its last block is finished, and made once.
  await app.host.send("end");
  expect(said(app, "Made: ")).toBe(blocks);
});
