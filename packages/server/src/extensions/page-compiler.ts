// Compiles an extension's page file the way the app's build compiles its own components: React
// Compiler first, then StyleX with the app's hashing options, so an extension's styles get the same
// classes as Astryx's and the app's. The output is still TSX: the module compiler strips its types
// and JSX afterwards.
import { transformSync } from "@babel/core";
import type { Options as StylexOptions, Rule, StyleXTransformObj } from "@stylexjs/babel-plugin";
import { createRequire } from "node:module";

/** A compile error, at a 1-based line and column of the page's source. */
export type PageError = { column: number; line: number; message: string };

/** A compiled page: its TSX, and the CSS its `stylex.create` calls produce. */
export type CompiledPage = { code: string; css: string };

const require = createRequire(import.meta.url);

// By their paths: StyleX's types name Babel 7's plugin type, which Babel 8 does not export.
const REACT_COMPILER = require.resolve("babel-plugin-react-compiler");
const STYLEX = require.resolve("@stylexjs/babel-plugin");

// Required: it is CommonJS, and its types declare an ES default export that Node's import does not
// give.
const { processStylexRules } = require(STYLEX) as StyleXTransformObj;

/** The import extension pages use for Astryx's theme variables. */
const TOKENS_IMPORT = "@astryxdesign/core/theme/tokens.stylex";

/**
 * The app's StyleX options (`packages/web/vite.transforms.ts`, with `@stylexjs/unplugin`'s
 * defaults for a production build): any difference in the hashing options would give an
 * extension's styles classes that never override Astryx's.
 */
function stylexOptions(tokens: string): Partial<StylexOptions> {
  return {
    debug: false,
    dev: false,
    importSources: ["stylex", "@stylexjs/stylex"],
    runtimeInjection: false,
    treeshakeCompensation: true,
    unstable_moduleResolution: {
      filePathResolver: (path: string) => (path === TOKENS_IMPORT ? tokens : undefined),
      getCanonicalFilePath: (path: string) => path,
      type: "custom",
    },
  };
}

/**
 * Compiles a page file, `source` read from `filename`, with Astryx's token file at `tokens`.
 * Gives its code and CSS, or the position and message of the first error.
 */
export function compilePage(
  source: string,
  filename: string,
  tokens: string,
): CompiledPage | { error: PageError } {
  try {
    const result = transformSync(source, {
      babelrc: false,
      configFile: false,
      filename,
      // Plain code frames, which `pageError` reads a plugin's error position from.
      highlightCode: false,
      parserOpts: { plugins: ["typescript", "jsx"] },
      // As the app's `reactCompilerPreset()`, which targets React 19 by default.
      plugins: [
        [REACT_COMPILER, { target: "19" }],
        [STYLEX, stylexOptions(tokens)],
      ],
    });
    const rules = (result?.metadata as { stylex?: Array<Rule> } | undefined)?.stylex ?? [];
    return {
      code: result?.code ?? "",
      css: pageCss(rules),
    };
  } catch (error) {
    return { error: pageError(error, filename) };
  }
}

/** Marks the placeholder rules `pageCss` adds, and removes. */
const LEVEL = "uraeda-priority-level-";

/**
 * The CSS of a page's rules, with the options `@stylexjs/unplugin` gives `processStylexRules` for
 * the app (no layers). Without layers, StyleX orders its rules by specificity, adding one
 * `:not(#\#)` per priority level present before a rule's: alone, a page's `padding-block` would
 * get none, and lose to Astryx's `padding`. A placeholder rule at every level up to the page's
 * highest gives each rule as many as Astryx's stylesheet gives the same level (all of them, from 0
 * to 4: `padding` one, `padding-block` two, `padding-top` four).
 */
export function pageCss(rules: Array<Rule>): string {
  if (rules.length === 0) {
    return "";
  }
  const highest = Math.max(...rules.map(([, , priority]) => Math.floor(priority / 1000)));
  const placeholders = Array.from({ length: highest + 1 }, (_, level): Rule => {
    const name = `${LEVEL}${level}`;
    return [name, { ltr: `.${name}{--${name}:0}`, rtl: null }, level * 1000];
  });
  const css = processStylexRules([...placeholders, ...rules], { useLayers: false });
  return css
    .split("\n")
    .filter((line) => !line.includes(LEVEL))
    .join("\n");
}

/**
 * Babel's parse errors carry `loc`, its column 0-based; a plugin's errors only show it in their
 * code frame, the line marked `>` and the column of the `^` under it. The message keeps its first
 * line, without the file's path or the position Babel adds to it.
 */
function pageError(error: unknown, filename: string): PageError {
  const text = error instanceof Error ? error.message : String(error);
  const firstLine = text.split("\n")[0].replace(`${filename}: `, "");
  const message = firstLine.replace(/\s*\(\d+:\d+\)$/, "");
  const loc = (error as { loc?: { column: number; line: number } } | null)?.loc;
  if (loc) {
    return { column: loc.column + 1, line: loc.line, message };
  }
  const frame = /^> *(\d+) \|.*\n *\|( *)\^/m.exec(text);
  return frame
    ? { column: frame[2].length, line: Number(frame[1]), message }
    : { column: 1, line: 1, message };
}
