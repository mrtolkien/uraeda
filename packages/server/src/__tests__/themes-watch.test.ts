import { mkdirSync, symlinkSync, unlinkSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { ServerThemes } from "../themes.ts";

/** The core's binding, as one object: the themes take it whole. */
const binding = await import("uraeda-binding");

/** SC-005: a saved theme file redraws the page within 1 second. */
const SC_005_MS = 1000;

/** How long a change through a symlink may take: only SC-005's test is held to its second. */
const POLL = { timeout: 5000 };

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
test("a symlinked themes folder is followed, and pointed elsewhere", async () => {
  const dir = temporaryFolder("uraeda-config");
  const dotfiles = temporaryFolder("uraeda-dotfiles");
  symlinkSync(dotfiles, join(dir, "themes"));
  const themes = await opened(dir);

  writeFileSync(join(dotfiles, "ember.toml"), ember("#ff7a45"));
  await expect.poll(() => needsYou(themes, "ember"), POLL).toBe("#ff7a45");

  const other = temporaryFolder("uraeda-dotfiles");
  writeFileSync(join(other, "ember.toml"), ember("#ee5522"));
  unlinkSync(join(dir, "themes"));
  symlinkSync(other, join(dir, "themes"));
  await expect.poll(() => needsYou(themes, "ember"), POLL).toBe("#ee5522");
  writeFileSync(join(other, "ember.toml"), ember("#dd4411"));
  await expect.poll(() => needsYou(themes, "ember"), POLL).toBe("#dd4411");
});

/** Edge case: a theme file symlinked elsewhere, as by GNU Stow. */
test("a symlinked theme file is seen changing at its target", async () => {
  const dir = temporaryFolder("uraeda-config");
  const dotfiles = temporaryFolder("uraeda-dotfiles");
  mkdirSync(join(dir, "themes"));
  writeFileSync(join(dotfiles, "my-ember.toml"), ember("#ff7a45"));
  symlinkSync(join(dotfiles, "my-ember.toml"), join(dir, "themes", "ember.toml"));
  const themes = await opened(dir);
  expect(needsYou(themes, "ember")).toBe("#ff7a45");

  writeFileSync(join(dotfiles, "my-ember.toml"), ember("#ee5522"));
  await expect.poll(() => needsYou(themes, "ember"), POLL).toBe("#ee5522");
});

/** Edge case: a theme file symlinked to a file not made yet, as before a dotfiles checkout. */
test("a symlinked theme file whose target is made later is served", async () => {
  const dir = temporaryFolder("uraeda-config");
  const dotfiles = temporaryFolder("uraeda-dotfiles");
  mkdirSync(join(dir, "themes"));
  symlinkSync(
    join("..", "..", basename(dotfiles), "colours", "my-ember.toml"),
    join(dir, "themes", "ember.toml"),
  );
  const themes = await opened(dir);
  expect(needsYou(themes, "ember")).toBeUndefined();

  mkdirSync(join(dotfiles, "colours"));
  writeFileSync(join(dotfiles, "colours", "my-ember.toml"), ember("#ff7a45"));
  await expect.poll(() => needsYou(themes, "ember"), POLL).toBe("#ff7a45");
});

test("a read that finds nothing changed tells no one", async () => {
  const dir = temporaryFolder("uraeda-config");
  mkdirSync(join(dir, "themes"));
  writeFileSync(join(dir, "themes", "ember.toml"), ember("#ff7a45"));
  const themes = await opened(dir);
  const told = vi.fn();
  themes.onChange(told);

  // As after an editor's swap file, which changes no theme.
  await themes.reload();
  await themes.reload();
  expect(told).not.toHaveBeenCalled();
});

test("a first read that fails is tried again, so the shipped themes are served", async () => {
  const dir = temporaryFolder("uraeda-config");
  let reads = 0;
  const failing = {
    readThemes(folder: string) {
      reads += 1;
      return reads === 1
        ? Promise.reject(new Error("io: the read failed."))
        : binding.readThemes(folder);
    },
    themesFolder: binding.themesFolder,
  };
  const stderr = vi.spyOn(process.stderr, "write").mockReturnValue(true);
  onTestFinished(() => stderr.mockRestore());
  const themes = await ServerThemes.open({ binding: failing, dir });
  onTestFinished(() => themes.close());

  await expect.poll(() => needsYou(themes, "catppuccin-mocha"), POLL).toBeDefined();
});
