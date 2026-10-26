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

/** What listens for a key: a hotkeys hook, a keydown or keyup listener, a key handler on an element. */
const LISTENERS = new RegExp(
  [
    String.raw`\buseHotkeys?\b`,
    "react-hotkeys",
    // A listener of a key event, by its literal name, or by a name the scan cannot read (a variable,
    // a loop's): that one is on the list too, with the reason it is not a key of the page's.
    String.raw`addEventListener\(\s*["'\x60]key(down|up|press)["'\x60]`,
    String.raw`addEventListener\(\s*(?!["'\x60])`,
    String.raw`\bon[kK]ey(Down|Up|Press)(Capture)?\b`,
    // The property form: `element.onkeydown = ...`.
    String.raw`\bonkey(down|up|press)\s*=`,
  ].join("|"),
  "g",
);

/** The files, by their path under `src`, and how many listeners of `pattern` each has. */
function hitsOf(pattern: RegExp) {
  const all = new RegExp(
    pattern.source,
    pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`,
  );
  return Object.fromEntries(
    sources()
      .map((path) => [relative(src, path), [...readFileSync(path, "utf8").matchAll(all)].length])
      .filter(([, count]) => count !== 0)
      .toSorted(([a], [b]) => String(a).localeCompare(String(b))),
  ) as Record<string, number>;
}

/** The files, by their path under `src`, whose text has a hit of `pattern`. */
const filesWith = (pattern: RegExp) => Object.keys(hitsOf(pattern));

/**
 * Each file that keeps its own key listener, how many it has, and why the key is not the page's. A
 * file whose count grows is a new listener in a file that was allowed for another: add it here with
 * its reason, or declare the key with `useKeys`.
 */
const ALLOWED: Record<string, { hits: number; reason: string }> = {
  "AddNote.tsx": { hits: 1, reason: "a text field's own keys: Enter adds the note" },
  "AddRepository.tsx": { hits: 1, reason: "a text field's own keys: Enter adds the repository" },
  "attach/useImageDrop.ts": { hits: 1, reason: "drag and drop events, named in a loop: no key" },
  "Composer.tsx": {
    hits: 3,
    reason: "a text field's own keys: Ctrl or Cmd+Enter sends, Escape leaves the field",
  },
  "EditableLine.tsx": {
    hits: 1,
    reason: "a text field's own keys: Enter saves the line, Escape leaves it",
  },
  "embedLayout.ts": { hits: 1, reason: "Escape leaves the full-screen overlay it draws (R132)" },
  "fields/TextField.tsx": {
    hits: 2,
    reason: "a text field's own keys: Ctrl or Cmd+Enter submits",
  },
  "Folds.tsx": {
    hits: 1,
    reason:
      "listens for the human's own scrolling input, a key among them, to end a scripted scroll",
  },
  "keepPlace.ts": {
    hits: 1,
    reason: "notes that the human scrolled or typed, to keep the page's place: it acts on no key",
  },
  "keys/registry.tsx": { hits: 8, reason: "the registry: the one window listener" },
  "KindCards.tsx": {
    hits: 1,
    reason: "a radio group's own keys: the arrows move between its cards",
  },
  "lists/CategoryPane.tsx": {
    hits: 4,
    reason: "a dialog's own keys while it is open: Y, N, C, which follow the switch (R90)",
  },
  "QuickAdd.tsx": { hits: 1, reason: "a text field's own keys: Enter adds the note" },
  "RepositoryMenu.tsx": { hits: 1, reason: "the menu's filter field's own keys" },
  "routes.tsx": { hits: 1, reason: "the navigation event's own name, `CHANGE`: no key" },
  "sandbox/mountSandboxBar.tsx": {
    hits: 1,
    reason: "the sandbox's bar: its own pick shortcut, in the sandbox only",
  },
  "session/ActivityPanel.tsx": { hits: 1, reason: "the navigation event's own name: no key" },
  "shell/Rail.tsx": {
    hits: 2,
    reason: "Escape pressed inside the open rail folds it and returns the focus to its logo (R100)",
  },
  "sidebar/Search.tsx": { hits: 1, reason: "a text field's own keys: Escape clears the search" },
  "sign-in/SignInPage.tsx": {
    hits: 1,
    reason: "a text field's own keys: Enter signs in, on a page outside the shell",
  },
  "SlugField.tsx": { hits: 1, reason: "a text field's own keys: Enter and Escape" },
  "StoryPick.tsx": { hits: 1, reason: "Escape ends pick mode, an overlay of its own (R132)" },
};

test("only the registry listens for the page's keys", () => {
  const counts = hitsOf(LISTENERS);
  const strays = Object.keys(counts).filter((file) => !Object.hasOwn(ALLOWED, file));
  const grown = Object.entries(counts).filter(
    ([file, hits]) => Object.hasOwn(ALLOWED, file) && hits > ALLOWED[file]!.hits,
  );
  expect(
    [strays, grown.map(([file, hits]) => `${file}: ${hits} > ${ALLOWED[file]!.hits}`)],
    `These files listen for keys, or listen for more than they are allowed: ${[
      ...strays,
      ...grown.map(([file]) => file),
    ].join(", ")}. A key that acts on the page is declared ` +
      "with `useKeys` (keys/registry.tsx), with its label, icon, group, and hint, and not " +
      "listened for here. Only a key that belongs to a text field, an open dialog, a radio group, " +
      "or an overlay stays: add the file, or its new count, to ALLOWED in keys-structural.test.ts " +
      "with its reason (R1).",
  ).toEqual([[], []]);
});

test("each file on the allowlist still listens, so the list holds no stale entry", () => {
  const counts = hitsOf(LISTENERS);
  const stale = Object.entries(ALLOWED).filter(([file, { hits }]) => (counts[file] ?? 0) < hits);
  expect(
    stale.map(([file]) => file),
    `These files listen for fewer keys than the list records: ${stale.map(([file]) => file).join(", ")}. ` +
      "Lower or remove them in ALLOWED in keys-structural.test.ts.",
  ).toEqual([]);
});

/** The selectors that say a layer is open: a shown dialog, an expanded popup, an open popover. */
const LAYER_RULE = new RegExp(
  [
    String.raw`\[aria-haspopup`,
    String.raw`\[aria-expanded=`,
    ":popover-open",
    String.raw`dialog\[open\]`,
    "dialog:modal",
    String.raw`\[role=["']?(alert)?dialog`,
    // A copy of `INSIDE`: the dialog or popover that holds the element a key was pressed in.
    String.raw`closest\(\s*["'\x60][^"'\x60]*(dialog|\[popover)`,
  ].join("|"),
);

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

test("the scan sees each form of key listener and each copy of the layer rule", () => {
  const listeners = [
    "useHotkeys('j', run)",
    "window.addEventListener('keydown', run)",
    "window.addEventListener(name, run)",
    "<div onKeyDown={run} />",
    "element.onkeydown = run;",
  ];
  for (const sample of listeners) {
    expect(sample.match(LISTENERS), sample).not.toBeNull();
  }
  const copies = [
    'target.closest("dialog, [popover]")',
    "target.closest('[role=\"dialog\"]')",
    'document.querySelector("dialog[open]")',
  ];
  for (const sample of copies) {
    expect(LAYER_RULE.test(sample), sample).toBe(true);
  }
});
