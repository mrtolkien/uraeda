import { statSync } from "node:fs";
import { join } from "node:path";
import nkzw from "@nkzw/oxlint-config";
import { SOURCES } from "./packages/server/src/binding.ts";

/**
 * The UI components decision's values (see `specs/decisions/ui-components.md`): colours, spacing,
 * sizes, radii, borders, and type come from Astryx's tokens, imported from its `.stylex` files or
 * written `var(--…)` for the theme's own; raw values only for `0`, percentages, `auto`, and
 * keywords. `var(--*)` and `<percentage>` are read by `packages/web/lint/stylex.js`.
 */
const tokenLimit = {
  limit: [
    "var(--*)",
    "<percentage>",
    0,
    "0",
    "auto",
    "none",
    "normal",
    "inherit",
    "currentColor",
    "transparent",
    "fit-content",
    "min-content",
    "max-content",
  ],
  reason:
    "Use an Astryx token, or the theme's `var(--…)`: raw values are allowed only for 0, percentages, auto, and keywords (see the UI components decision).",
};
const tokenProps = [
  // Colour
  "color",
  "background",
  "backgroundColor",
  "borderColor",
  "border*Color",
  "outlineColor",
  "textDecorationColor",
  "caretColor",
  "accentColor",
  "fill",
  "stroke",
  // Spacing
  "margin*",
  "padding*",
  "gap",
  "rowGap",
  "columnGap",
  "inset*",
  "top",
  "right",
  "bottom",
  "left",
  // Sizes
  "width",
  "height",
  "minWidth",
  "maxWidth",
  "minHeight",
  "maxHeight",
  "*BlockSize",
  "*InlineSize",
  "blockSize",
  "inlineSize",
  "flexBasis",
  // Radii and borders
  "border*Radius",
  "border",
  "border*Width",
  "borderBlock",
  "borderInline",
  "borderTop",
  "borderRight",
  "borderBottom",
  "borderLeft",
  "borderBlockStart",
  "borderBlockEnd",
  "borderInlineStart",
  "borderInlineEnd",
  "outline",
  "outlineWidth",
  "outlineOffset",
  // Type
  "font",
  "fontFamily",
  "fontSize",
  "fontWeight",
  "lineHeight",
  "letterSpacing",
];

/** Raw elements, each with the Astryx component to use instead. */
const forbiddenElements = [
  ["button", "use Astryx Button"],
  ["input", "use Astryx TextInput"],
  ["textarea", "use Astryx TextArea"],
  ["select", "use Astryx Selector"],
  ["dialog", "use Astryx Dialog or BottomSheet"],
].map(([element, message]) => ({ element, message }));

/**
 * The dev shell's variables the tests need, which Vite Task does not pass to a task unless listed:
 * the browsers, their fonts and EGL driver, and mini.test. Not part of a result, so not fingerprinted.
 */
const testEnv = [
  "PLAYWRIGHT_BROWSERS_PATH",
  "PLAYWRIGHT_SKIP_VALIDATE_HOST_REQUIREMENTS",
  "PLAYWRIGHT_SKIP_BROWSER_DOWNLOAD",
  "FONTCONFIG_FILE",
  "__EGL_VENDOR_LIBRARY_DIRS",
  "MINI_TEST",
];

/** A test ignores the host's git configuration: the tests' repositories get git's defaults. */
const isolatedGit = "GIT_CONFIG_GLOBAL=/dev/null GIT_CONFIG_NOSYSTEM=1";

/** What the Rust crates are built from: the skill is compiled into the core. */
const rustSources = [
  "crates/**",
  "Cargo.toml",
  "Cargo.lock",
  "clippy.toml",
  "rust-toolchain.toml",
  "skills/uraeda/**",
];

/** What the TypeScript tests read: the packages, the fixtures, and the skill the core embeds. */
const tsTestInputs = [
  "packages/**",
  "fixtures/**",
  "skills/uraeda/**",
  "vite.config.ts",
  "pnpm-lock.yaml",
  "!**/node_modules/**",
  "!**/dist/**",
  "!**/.vitest/**",
];

/** The binding's sources, from `binding.ts`'s list, a folder standing for every file under it. */
const bindingInputs = SOURCES.map((source) =>
  statSync(join(import.meta.dirname, source)).isDirectory() ? `${source}/**` : source,
);

/**
 * The checks of `vp run ready`, as a graph of cached tasks (see `specs/decisions/toolchain.md`):
 * each lists the files it reads in `cache.input`, so a change reruns only the checks it can break.
 * The `ready:*` groups, which run nothing themselves, are the units CI's jobs run, uncached.
 */
const tasks = {
  // The benchmarks of the specs' success criteria: they measure time, so are never replayed.
  bench: {
    cache: false,
    command: [
      `${isolatedGit} cargo nextest run --run-ignored only -E 'test(/^bench_/)'`,
      `${isolatedGit} vp test bench --run`,
    ],
    dependsOn: ["binding:touch"],
  },
  // A hit restores the built binding, and its generated files, which are committed.
  "binding:build": {
    cache: {
      input: [...bindingInputs, "packages/binding/package.json"],
      output: [
        "packages/binding/*.node",
        "packages/binding/index.js",
        "packages/binding/index.d.ts",
      ],
    },
    command:
      "node_modules/.bin/napi build --platform --esm --no-const-enum --manifest-path ../../crates/binding/Cargo.toml --output-dir .",
    cwd: "packages/binding",
  },
  // A hit restores the binding with the time it was built at, which a source saved since with the
  // same content is newer than: the web configs' `checkBinding` would refuse it. The binding is
  // built from its sources as they are, so it is marked as built now, on every run.
  "binding:touch": {
    cache: false,
    // In a shell: Vite Task runs a plain command without expanding its globs.
    command: "sh -c 'touch -c packages/binding/*.node'",
    dependsOn: ["binding:build"],
  },
  "browser:desktop": {
    cache: { input: tsTestInputs, output: [], untrackedEnv: testEnv },
    command: `${isolatedGit} vp test --project desktop`,
    dependsOn: ["binding:touch"],
  },
  "browser:phone": {
    cache: { input: tsTestInputs, output: [], untrackedEnv: testEnv },
    command: `${isolatedGit} vp test --project phone`,
    dependsOn: ["binding:touch"],
  },
  "lua:fmt": {
    cache: { input: ["editors/nvim/**"], output: [] },
    command: "stylua --check editors/nvim",
  },
  ready: {
    command: "true",
    dependsOn: ["ready:rust", "ready:typescript", "ready:browser-phone", "ready:browser-desktop"],
  },
  "ready:browser-desktop": { command: "true", dependsOn: ["browser:desktop"] },
  "ready:browser-phone": { command: "true", dependsOn: ["browser:phone"] },
  "ready:rust": {
    command: "true",
    dependsOn: ["rust:fmt", "rust:clippy", "rust:test", "rust:features", "specs:check"],
  },
  "ready:typescript": {
    command: "true",
    dependsOn: ["binding:build", "web:theme", "lua:fmt", "ts:check", "ts:test", "web:build"],
  },
  "rust:clippy": {
    cache: { input: rustSources, output: [] },
    command: "cargo clippy --workspace --all-targets -- -D warnings",
  },
  // `ura` never builds napi: a binding built into the other crates' tests would not link.
  "rust:features": {
    cache: { input: ["crates/*/Cargo.toml", "Cargo.toml", "Cargo.lock"], output: [] },
    command: "! cargo tree -p uraeda-cli -e features --prefix none | grep -qE '^napi(-derive)? v'",
  },
  "rust:fmt": {
    cache: { input: ["crates/**", "rustfmt.toml"], output: [] },
    command: "cargo fmt --check",
  },
  "rust:test": {
    // CI sets NEXTEST_PROFILE=ci, to report every failure at once.
    cache: {
      input: [...rustSources, "fixtures/**", ".config/nextest.toml"],
      output: [],
      untrackedEnv: [...testEnv, "NEXTEST_PROFILE"],
    },
    command: `${isolatedGit} cargo nextest run`,
  },
  "specs:check": {
    cache: { input: [...rustSources, "specs/**"], output: [] },
    command: [
      "cargo run -q -p uraeda-cli -- check specs",
      "cargo run -q -p uraeda-cli -- check skills/uraeda/assets/example/specs",
    ],
  },
  // CI only (see the toolchain decision): the Neovim plugin's tests, on the `ura` they build.
  "test:nvim": {
    cache: false,
    command: [
      "cargo build -q -p uraeda-cli",
      `${isolatedGit} nvim --headless --noplugin -u tests/minimal_init.lua -c 'lua MiniTest.run()'`,
    ],
    cwd: "editors/nvim",
  },
  // Every file `vp check` formats or lints, by extension: a Rust or Lua change does not rerun it.
  "ts:check": {
    cache: {
      input: [
        "**/*.{ts,tsx,js,mjs,cjs,json,jsonc,md,toml,yml,yaml,html,css}",
        "!**/node_modules/**",
        "!target/**",
        "!**/dist/**",
        "!fixtures/**",
      ],
      output: [],
    },
    command: "vp check",
  },
  "ts:test": {
    cache: { input: tsTestInputs, output: [], untrackedEnv: testEnv },
    command: `${isolatedGit} vp test --project uraeda-binding --project uraeda-server --project uraeda-web`,
    dependsOn: ["binding:touch"],
  },
  "web:build": {
    cache: {
      input: [
        "packages/web/**",
        "packages/server/**",
        "vite.config.ts",
        "pnpm-lock.yaml",
        "!**/node_modules/**",
        "!**/dist/**",
      ],
      output: ["packages/web/dist/**"],
    },
    command: "vp build",
    cwd: "packages/web",
    dependsOn: ["binding:build"],
  },
  "web:theme": {
    cache: { input: ["packages/web/src/theme/**"], output: [] },
    command:
      "node_modules/.bin/astryx theme build src/theme/theme.ts --out src/theme/built/uraeda.css --check",
    cwd: "packages/web",
  },
};

export default {
  // `vp dev` at the root runs the web UI, with the server in its process.
  defaultPackage: "./packages/web",
  fmt: {
    ignorePatterns: [
      // Generated by dist, which checks that it is unchanged.
      ".github/workflows/release.yml",
      "fixtures/**",
      "packages/binding/index.js",
      "packages/binding/index.d.ts",
      // Generated by `napi create-npm-dirs`, with their READMEs written by hand.
      "packages/binding/npm/**",
      // Built by `vp run --filter @uraeda/ui build`.
      "packages/uraeda/{dist,plugin,web}/**",
      "packages/web/.fate/**",
      // Generated by `astryx theme build`, which checks that it is unchanged.
      "packages/web/src/theme/built/**",
    ],
    proseWrap: "always",
  },
  lint: {
    // The fate stack's shared config (see `specs/decisions/code-quality.md`).
    extends: [nkzw],
    ignorePatterns: [
      "fixtures/**",
      "packages/binding/index.js",
      "packages/binding/index.d.ts",
      "packages/binding/npm/**",
      "packages/uraeda/{dist,plugin,web}/**",
      "packages/web/.fate/**",
      "packages/web/src/theme/built/**",
      // One file per banned pattern, which `packages/web/src/__tests__/lint.test.ts` lints one by
      // one, with this variable set.
      ...((globalThis as { process?: { env: Record<string, string | undefined> } }).process?.env
        .URAEDA_LINT_FIXTURES
        ? []
        : ["packages/web/src/__lint__/**"]),
    ],
    jsPlugins: [
      { name: "vite-plus", specifier: "vite-plus/oxlint-plugin" },
      { name: "stylex", specifier: "./packages/web/lint/stylex.js" },
    ],
    overrides: [
      {
        // The UI decisions' rules, for the web UI.
        files: ["packages/web/src/**"],
        plugins: ["react"],
        rules: {
          // The UI components decision writes the app's styles with `stylex.create`, through
          // StyleX's namespace, as StyleX's own documentation does.
          "import/no-namespace": ["error", { ignore: ["@stylexjs/stylex"] }],
          // The UI components decision's Astryx components and StyleX styles.
          "react/forbid-component-props": [
            "error",
            {
              forbid: [
                { message: "style a component through its xstyle prop", propName: "style" },
                { message: "style a component through its xstyle prop", propName: "className" },
              ],
            },
          ],
          "react/forbid-dom-props": [
            "error",
            { forbid: [{ message: "style with StyleX's stylex.props", propName: "style" }] },
          ],
          "react/forbid-elements": ["error", { forbid: forbiddenElements }],
          "stylex/valid-styles": [
            "error",
            { propLimits: Object.fromEntries(tokenProps.map((prop) => [prop, tokenLimit])) },
          ],
        },
      },
      {
        // The code quality decision exempts tests from the file length limit.
        files: ["**/__tests__/**", "**/__browser__/**", "**/*.test.ts", "**/*.test.tsx"],
        rules: { "max-lines": "off" },
      },
    ],
    rules: {
      // The code quality decision's limits (see `specs/decisions/code-quality.md`).
      "max-depth": ["error", { max: 4 }],
      "max-lines": ["error", { max: 500 }],
      "max-lines-per-function": ["error", { max: 100 }],
      "max-params": ["error", { max: 7 }],
      "vite-plus/prefer-vite-plus-imports": "error",
    },
    // A disable directive left on code that no longer breaks its rule fails, so markers go once
    // their code is fixed (see `specs/decisions/code-quality.md`).
    options: { reportUnusedDisableDirectives: "error", typeAware: true, typeCheck: true },
  },
  run: { tasks },
  staged: {
    "!(*.{rs,lua})": "vp check --fix",
    // StyLua finds `editors/nvim/stylua.toml` from each file's folder.
    "*.lua": "stylua",
    // rustfmt finds the root's `rustfmt.toml` the same way.
    "*.rs": "rustfmt",
  },
  test: {
    // Each package runs with its own Vite config: the UI's needs React, fate, and happy-dom.
    projects: [
      "packages/binding",
      "packages/server",
      "packages/uraeda",
      "packages/web",
      // The layout at an iPhone 17's size and a desktop's, in WebKit: `nix develop` provides it.
      "packages/web/vite.browser.config.ts",
    ],
  },
};
