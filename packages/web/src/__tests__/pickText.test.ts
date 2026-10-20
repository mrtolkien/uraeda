// US4: the text of a pick, the one the sandbox's bar copies.
import { expect, test } from "vite-plus/test";
import { pickText } from "../sandbox/pickText.ts";

const PAGE = {
  address: "http://127.0.0.1:4410/r/sample/f/2026-10-11-web-ui/round",
  height: 900,
  theme: "dark",
  width: 1440,
} as const;

test("a pick names the page, the element, its source, text, HTML, and viewport, in order", () => {
  const text = pickText(
    {
      html: '<button type="submit">Submit answers</button>',
      name: "Submit answers",
      role: "button",
      source: "packages/web/src/RoundSubmit.tsx:215:11",
      text: "Submit answers",
    },
    PAGE,
  );

  expect(text).toBe(
    [
      "Sandbox pick: http://127.0.0.1:4410/r/sample/f/2026-10-11-web-ui/round",
      "Element: button “Submit answers”",
      "Source: packages/web/src/RoundSubmit.tsx:215:11",
      "Text: Submit answers",
      'HTML: <button type="submit">Submit answers</button>',
      "Viewport: 1440 × 900, dark",
    ].join("\n"),
  );
});

test("pickText cuts HTML at 500, keeps the text the pick script cut, and names an unknown source", () => {
  const text = pickText(
    {
      html: "<p>".padEnd(600, "a"),
      name: "",
      role: "paragraph",
      source: null,
      text: `${"b".repeat(200)}…`,
    },
    PAGE,
  );

  expect(text).toContain("Source: unknown");
  expect(text).toContain(`Text: ${"b".repeat(200)}…\n`);
  expect(text.split("\n").find((line) => line.startsWith("HTML: "))).toHaveLength(
    "HTML: ".length + 501,
  );
});

test("a text or HTML at its limit is not cut", () => {
  const text = pickText(
    { html: "h".repeat(500), name: "n", role: "link", source: null, text: "t".repeat(200) },
    PAGE,
  );

  expect(text).toContain(`Text: ${"t".repeat(200)}\n`);
  expect(text).toContain(`HTML: ${"h".repeat(500)}\n`);
});

test("a line break in the HTML does not start another field", () => {
  const text = pickText(
    { html: "<ul>\n  <li>One</li>\n</ul>", name: "", role: "list", source: null, text: "One" },
    { ...PAGE, theme: "light" },
  );

  expect(text.split("\n")).toHaveLength(6);
  expect(text).toContain("HTML: <ul> <li>One</li> </ul>");
  expect(text).toContain("Viewport: 1440 × 900, light");
});

test("the source names the path, line, and column, without code-inspector's tag name", () => {
  const text = pickText(
    {
      html: "<div></div>",
      name: "",
      role: "element",
      source: "packages/web/src/X.tsx:3:5:div",
      text: "",
    },
    PAGE,
  );

  expect(text).toContain("\nSource: packages/web/src/X.tsx:3:5\n");
});

test("a source without a tag name is kept whole", () => {
  const text = pickText(
    {
      html: "<p></p>",
      name: "",
      role: "paragraph",
      source: "packages/web/src/X.tsx:3:5",
      text: "",
    },
    PAGE,
  );

  expect(text).toContain("\nSource: packages/web/src/X.tsx:3:5\n");
});

test("the HTML holds no source attribute, and is cut after it is removed", () => {
  const inner = `<span data-insp-path="packages/web/src/Y.tsx:9:7:span">Hi</span>`;
  const text = pickText(
    {
      html: `<p data-insp-path="packages/web/src/X.tsx:3:5:p" class="a">${inner}${"b".repeat(430)}</p>`,
      name: "",
      role: "paragraph",
      source: "packages/web/src/X.tsx:3:5:p",
      text: "",
    },
    PAGE,
  );

  expect(text).toContain(`\nHTML: <p class="a"><span>Hi</span>${"b".repeat(430)}</p>\n`);
});
