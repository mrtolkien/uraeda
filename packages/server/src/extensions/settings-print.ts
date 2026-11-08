// What tells the extensions host which extensions' settings changed between two reads of the
// settings file.

/** The key of every repository's settings, beside each repository's own by its name. */
export const GLOBAL = "";

/**
 * The settings' print, compared between reads: every repository's, and each repository's that
 * differs, so a repository joining the list without settings of its own reloads nothing.
 */
export function printOf(values: Map<string, Record<string, unknown>>): string {
  const global = JSON.stringify(values.get(GLOBAL) ?? {});
  const own = [...values].filter(
    ([key, value]) => key === GLOBAL || JSON.stringify(value) !== global,
  );
  return JSON.stringify(own);
}
