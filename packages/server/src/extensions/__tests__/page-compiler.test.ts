import { readFileSync } from "node:fs";
import { createRequire } from "node:module";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { layout } from "../../paths.ts";
import { compilePage } from "../page-compiler.ts";

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

test("a style StyleX cannot compile gives the line and column of its value", () => {
  const source = `import * as stylex from "@stylexjs/stylex";
const styles = stylex.create({ row: { width: Math.random() } });
export const row = stylex.props(styles.row);
`;

  expect(compiled(source)).toEqual({
    error: { column: 46, line: 2, message: "Unsupported expression: CallExpression" },
  });
});
