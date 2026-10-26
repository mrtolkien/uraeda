// The Keyboard decision's structural test: a shortcut that acts on the page is declared in the key
// registry and listened for nowhere else, and the one rule of "a layer is open" is `keys/layers.ts`
// (R1). The source of the web is scanned for a key listener, and each file that has one is on a
// named list with its reason: a key that belongs to a text field, a dialog while it is open, a
// radio group, or an overlay, which the registry skips by its own layer rule.
import { readdirSync, readFileSync } from "node:fs";
import { join, relative } from "node:path";
import { expect, test } from "vite-plus/test";

const src = join(import.meta.dirname, "..");

/** The web's source files, with the tests, the browser tests, and the lint samples left out. */
function sources(folder = src): Array<string> {
  return readdirSync(folder, { withFileTypes: true }).flatMap((entry) => {
    const path = join(folder, entry.name);
    if (entry.isDirectory()) {
      return /^__(tests|browser|focused|lint)__$/.test(entry.name) ? [] : sources(path);
    }
    return /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name) ? [path] : [];
  });
}

/** The files, by their path under `src`, whose text has a hit of `pattern`. */
function filesWith(pattern: RegExp) {
  return sources()
    .filter((path) => pattern.test(readFileSync(path, "utf8")))
    .map((path) => relative(src, path))
    .toSorted();
}

/** What listens for a key: a hotkeys hook, a keydown or keyup listener, a key handler on an element. */
const LISTENERS =
  /\buseHotkeys?\b|react-hotkeys|addEventListener\(\s*["'`]key(down|up|press)["'`]|\bon[kK]ey(Down|Up|Press)(Capture)?\b/;

/** Each file that keeps its own key listener, and why the key is not the page's. */
const ALLOWED: Record<string, string> = {
  "AddNote.tsx": "a text field's own keys: Enter adds the note",
  "AddRepository.tsx": "a text field's own keys: Enter adds the repository",
  "Composer.tsx": "a text field's own keys: Ctrl or Cmd+Enter sends, Escape leaves the field",
  "EditableLine.tsx": "a text field's own keys: Enter saves the line, Escape leaves it",
  "embedLayout.ts": "Escape leaves the full-screen overlay it draws",
  "fields/TextField.tsx": "a text field's own keys: Ctrl or Cmd+Enter submits",
  "keys/registry.tsx": "the registry: the one window listener",
  "KindCards.tsx": "a radio group's own keys: the arrows move between its cards",
  "lists/CategoryPane.tsx":
    "a dialog's own keys while it is open: Y, N, C, which follow the switch (R90)",
  "QuickAdd.tsx": "a text field's own keys: Enter adds the note",
  "RepositoryMenu.tsx": "the menu's filter field's own keys",
  "sandbox/mountSandboxBar.tsx": "the sandbox's bar: its own pick shortcut, in the sandbox only",
  "shell/Rail.tsx":
    "Escape pressed inside the open rail folds it and returns the focus to its logo (R100)",
  "sidebar/Search.tsx": "a text field's own keys: Escape clears the search",
  "sign-in/SignInPage.tsx": "a text field's own keys: Enter signs in, on a page outside the shell",
  "SlugField.tsx": "a text field's own keys: Enter and Escape",
  "StoryPick.tsx": "Escape ends pick mode, an overlay of its own",
};

test("only the registry listens for the page's keys", () => {
  const hits = filesWith(LISTENERS);
  const strays = hits.filter((file) => !Object.hasOwn(ALLOWED, file));
  expect(
    strays,
    `These files listen for keys: ${strays.join(", ")}. A key that acts on the page is declared ` +
      "with `useKeys` (keys/registry.tsx), with its label, icon, group, and hint, and not " +
      "listened for here. Only a key that belongs to a text field, an open dialog, a radio group, " +
      "or an overlay stays: add the file to ALLOWED in keys-structural.test.ts with its reason (R1).",
  ).toEqual([]);
});

test("each file on the allowlist still listens, so the list holds no stale entry", () => {
  const hits = new Set(filesWith(LISTENERS));
  const stale = Object.keys(ALLOWED).filter((file) => !hits.has(file));
  expect(
    stale,
    `These files no longer listen for keys: ${stale.join(", ")}. Remove them from ALLOWED in ` +
      "keys-structural.test.ts.",
  ).toEqual([]);
});

/** The selectors that say a layer is open: a shown dialog, an expanded popup, an open popover. */
const LAYER_RULE =
  /\[aria-haspopup|\[aria-expanded=|:popover-open|dialog\[open\]|dialog:modal|\[role=["']?(alert)?dialog/;

/** Each file besides `keys/layers.ts` that has such a selector, and why it is not a layer check. */
const LAYER_SELECTORS: Record<string, string> = {
  "pane/DetailOverlay.tsx":
    "finds the dialog around the pane to focus its first button, no key's layer check",
  "sandbox/mountSandboxBar.tsx":
    "places the sandbox's bar in the topmost modal dialog: it is no key's layer check",
};

test("the layer rule is in keys/layers.ts alone", () => {
  const hits = filesWith(LAYER_RULE).filter((file) => file !== "keys/layers.ts");
  const copies = hits.filter((file) => !Object.hasOwn(LAYER_SELECTORS, file));
  expect(
    copies,
    `These files carry their own selectors for "a layer is open": ${copies.join(", ")}. Use ` +
      "`isLayerOpen` or `useLayerOpen` from keys/layers.ts: a second copy of the rule is how a " +
      "shortcut acts under a dialog. A selector that is no layer check goes on LAYER_SELECTORS in " +
      "keys-structural.test.ts with its reason.",
  ).toEqual([]);
});
