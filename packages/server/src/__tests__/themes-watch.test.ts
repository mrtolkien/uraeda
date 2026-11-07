import { mkdirSync, symlinkSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, onTestFinished, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { ServerThemes } from "../themes.ts";

/** The core's binding, as one object: the themes take it whole. */
const binding = await import("uraeda-binding");

/** SC-005: a saved theme file redraws the page within 1 second. */
const SC_005_MS = 1000;

/** A dark theme of the user's, extending Mocha, its `needs-you` the colour `colour`. */
const ember = (colour: string) =>
  `name = "Ember"\nextends = "catppuccin-mocha"\n\n[roles]\nneeds-you = "${colour}"\n`;

/** The themes of the config folder `dir`, closed after the test. */
async function opened(dir: string) {
  const themes = await ServerThemes.open({ binding, dir });
  onTestFinished(() => themes.close());
  return themes;
}

/** Resolves on the next change of `themes`, or rejects after SC-005's second. */
function nextChange(themes: ServerThemes): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(() => {
      stop();
      reject(new Error(`no change within ${SC_005_MS} ms`));
    }, SC_005_MS);
    const stop = themes.onChange(() => {
      clearTimeout(timer);
      stop();
      resolve();
    });
  });
}

/** The colour of `needs-you` in the served theme `id`, or undefined when it is not served. */
function needsYou(themes: ServerThemes, id: string): string | undefined {
  return themes.current().themes.find((theme) => theme.id === id)?.roles["needs-you"];
}

/** US3.2, SC-005 */
test("a theme file written is served again", async () => {
  const dir = temporaryFolder("uraeda-config");
  const themes = await opened(dir);
  expect(needsYou(themes, "ember")).toBeUndefined();

  // The folder is made after the watch opened, as by a first theme of the user's.
  const changed = nextChange(themes);
  mkdirSync(join(dir, "themes"));
  writeFileSync(join(dir, "themes", "ember.toml"), ember("#ff7a45"));
  await changed;
  expect(needsYou(themes, "ember")).toBe("#ff7a45");

  const again = nextChange(themes);
  writeFileSync(join(dir, "themes", "ember.toml"), ember("#ee5522"));
  await again;
  expect(needsYou(themes, "ember")).toBe("#ee5522");
});

/** Edge case: a symlinked config folder, as from a dotfiles manager. */
test("a symlinked themes folder is followed", async () => {
  const dir = temporaryFolder("uraeda-config");
  const dotfiles = temporaryFolder("uraeda-dotfiles");
  symlinkSync(dotfiles, join(dir, "themes"));
  const themes = await opened(dir);

  const changed = nextChange(themes);
  writeFileSync(join(dotfiles, "ember.toml"), ember("#ff7a45"));
  await changed;

  expect(needsYou(themes, "ember")).toBe("#ff7a45");
});
