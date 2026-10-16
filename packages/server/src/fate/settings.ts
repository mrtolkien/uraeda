// The settings in fate: the record `Settings`, the values in force as `ServerSettings` holds them,
// the file's, and their sources, read on every endpoint.
import { dataView } from "@nkzw/fate/server";
import type { RunSettingsView, ServerSettings, ServerSettingsView } from "../settings.ts";
import type { Context } from "./context.ts";

/** The id of the one `Settings` record. */
export const SETTINGS_ID = "settings";

/**
 * The settings: the settings file, with `~` for the home folder; why it cannot be read, or null;
 * and each setting's value in force, the file's, and where the value in force comes from, the
 * server's and the runs'.
 */
export type SettingsRecord = {
  file: string;
  id: string;
  problem: string | null;
  runs: RunSettingsView;
  server: ServerSettingsView;
};

export const settingsDataView = dataView<SettingsRecord>("Settings")({
  file: true,
  id: true,
  problem: true,
  runs: true,
  server: true,
});

/** The record of the settings as `ServerSettings` last read them: never `Options` or the file. */
export function settingsRecord(settings: ServerSettings): SettingsRecord {
  return {
    file: settings.file,
    id: SETTINGS_ID,
    problem: settings.problem,
    runs: settings.runs(),
    server: settings.view(),
  };
}

/** Reads the record by id, on every endpoint, the global one too. */
export async function readSettingsRecord(
  ctx: Context,
  ids: Array<string>,
): Promise<Array<SettingsRecord>> {
  return ids.includes(SETTINGS_ID) ? [settingsRecord(ctx.settings)] : [];
}
