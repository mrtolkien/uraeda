// The colour themes the server serves, in their one record: the shipped themes and the user's, every
// role resolved, with the problems of each theme file of the user's.
import { useLiveView, useRequest, view } from "react-fate";
import type { Themes } from "uraeda-server/fate";
import { useRefreshOnShow } from "./data.ts";

/** The id of the one record of the themes, as the server names it. */
const THEMES_ID = "themes";

/**
 * The themes' record, whole: the user's themes folder, as messages show it; the themes the lists
 * show, dark first; and every theme file of the user's, with its problems.
 */
const ThemesRecordView = view<Themes>()({ files: true, folder: true, id: true, themes: true });

/**
 * The colour themes the server serves: the same from every endpoint, read on the client the caller
 * is under, kept up to date as a theme file changes, as `useSettings` is.
 */
export function useThemes() {
  const request = { themes: { id: THEMES_ID, view: ThemesRecordView } };
  const { themes } = useRequest(request);
  useRefreshOnShow(request);
  return useLiveView(ThemesRecordView, themes);
}

/** The themes' record, as `useThemes` gives it once read. */
export type ThemesRecord = NonNullable<ReturnType<typeof useThemes>>;
