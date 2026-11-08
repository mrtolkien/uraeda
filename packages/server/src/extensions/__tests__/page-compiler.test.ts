import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { layout } from "../../paths.ts";
import { ASTRYX_LEVELS, compilePage } from "../page-compiler.ts";

const ASTRYX_CSS = readFileSync(
  createRequire(import.meta.url).resolve("@astryxdesign/core/astryx.css"),
  "utf8",
);

// One style per priority level, each also in Astryx's stylesheet: a shorthand of shorthands, a
// shorthand of longhands, a logical longhand, and a physical longhand.
const PAGE = `import * as stylex from "@stylexjs/stylex";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";

const styles = stylex.create({
  color: { color: colorVars["--color-text-primary"] },
  padding: { padding: 0 },
  paddingBlock: { paddingBlock: spacingVars["--spacing-3"] },
  paddingTop: { paddingTop: 0 },
});

export const classes = [
  stylex.props(styles.color),
  stylex.props(styles.padding),
  stylex.props(styles.paddingBlock),
  stylex.props(styles.paddingTop),
];
`;

function compiled(source: string) {
  return compilePage(
    source,
    join(temporaryFolder("uraeda-extension"), "page.tsx"),
    layout().stylexTokens,
  );
}

test("each priority level's rule is as specific as Astryx's, whatever levels a page uses", () => {
  const result = compiled(PAGE);
  if ("error" in result) {
    throw new Error(result.error.message);
  }

  const rules = result.css.split("\n").filter(Boolean);
  expect(rules).toHaveLength(4);
  for (const rule of rules) {
    expect(ASTRYX_CSS).toContain(rule);
  }
});

test("Astryx's stylesheet has as many specificities as the levels the compiler knows it has", () => {
  // Each rule has one `:not(#\\#)` per level present below its own: the counts are 0 to one less
  // than the number of levels, and the rows below check which level each count is.
  const counts = new Set(
    ASTRYX_CSS.split("\n").map((line) => line.split(String.raw`:not(#\#)`).length - 1),
  );

  expect([...counts].sort((a, b) => a - b)).toEqual(ASTRYX_LEVELS.map((_, index) => index));
});

// A page using one style at each of Astryx's higher levels: an attribute condition, and pseudo-elements
// over a shorthand, a longhand, a physical longhand, and a `@starting-style` inside one. Astryx skips
// some levels, so a placeholder at each would give these one more `:not(#\\#)` than its stylesheet.
test.each([
  [
    "an attribute condition",
    `animationFillMode: { default: null, '[data-astryx-press="fading"]': "both" }`,
  ],
  ["a @starting-style", `opacity: { default: null, "@starting-style": 0 }`],
  ["::after over a shorthand", `"::after": { borderRadius: "inherit" }`],
  ["::before over a longhand", `"::before": { content: '""' }`],
  ["::after over a physical longhand", `"::after": { bottom: 0 }`],
  [
    "::backdrop in a @starting-style",
    `"::backdrop": { opacity: { default: null, "@starting-style": 0 } }`,
  ],
])("%s is as specific as Astryx's", (_, style) => {
  const result = compiled(`import * as stylex from "@stylexjs/stylex";
const styles = stylex.create({ row: { ${style} } });
export const row = stylex.props(styles.row);
`);
  if ("error" in result) {
    throw new Error(result.error.message);
  }

  const rules = result.css.split("\n").filter(Boolean);
  expect(rules).toHaveLength(1);
  expect(ASTRYX_CSS).toContain(rules[0]);
});

test("a component's stylex.props compile to their classes, inside React Compiler's memo cache", () => {
  const result = compiled(`import * as stylex from "@stylexjs/stylex";
const styles = stylex.create({ row: { padding: 0 }, on: { color: "red" } });
export function Row({ on, label }: { on: boolean; label: string }) {
  return <div {...stylex.props(styles.row, on && styles.on)}>{label}</div>;
}
`);
  if ("error" in result) {
    throw new Error(result.error.message);
  }

  expect(result.code).toContain("_c(");
  expect(result.code).not.toContain("stylex.props");
  expect(result.code).toContain('className: "x1717udv x1e2nbdu"');
  expect(result.css.split("\n")).toEqual([
    String.raw`.x1717udv:not(#\#){padding:0}`,
    String.raw`.x1e2nbdu:not(#\#):not(#\#):not(#\#){color:red}`,
  ]);
  expect(ASTRYX_CSS).toContain(String.raw`.x1717udv:not(#\#){padding:0}`);
});

test("a style StyleX cannot compile gives the line and column of its value", () => {
  const source = `import * as stylex from "@stylexjs/stylex";
const styles = stylex.create({ row: { width: Math.random() } });
export const row = stylex.props(styles.row);
`;

  expect(compiled(source)).toEqual({
    error: { column: 46, line: 2, message: "Unsupported expression: CallExpression" },
  });
});
