// The colour themes in fate: the record `Themes`, the shipped themes and the user's as
// `ServerThemes` last read them, with every file's problems, read on every endpoint.
import { dataView } from "@nkzw/fate/server";
import type { Theme, ThemeFile } from "uraeda-binding";
import type { ServerThemes } from "../themes.ts";
import type { Context } from "./context.ts";

/** The id of the one `Themes` record. */
export const THEMES_ID = "themes";

/**
 * The themes: the user's themes folder, as messages show it; the themes the lists show, dark
 * first, every role resolved; and every theme file of the user's, with its problems.
 */
export type ThemesRecord = {
  files: Array<ThemeFile>;
  folder: string;
  id: string;
  themes: Array<Theme>;
};

export const themesDataView = dataView<ThemesRecord>("Themes")({
  files: true,
  folder: true,
  id: true,
  themes: true,
});

/** The record of the themes as `ServerThemes` last read them. */
export function themesRecord(themes: ServerThemes): ThemesRecord {
  return { ...themes.current(), id: THEMES_ID };
}

/** Reads the record by id, on every endpoint, the global one too. */
export async function readThemesRecord(
  ctx: Context,
  ids: Array<string>,
): Promise<Array<ThemesRecord>> {
  return ids.includes(THEMES_ID) ? [themesRecord(ctx.themes)] : [];
}
