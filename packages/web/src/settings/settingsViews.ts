// The settings page's selections: the server's settings record and the extensions' record, which
// every endpoint serves.
import { view } from "react-fate";
import type { Extensions, Settings } from "uraeda-server/fate";

/** A setting: its value in force, the file's, and its source. */
const SettingSelection = { inForce: true, saved: true, source: true } as const;

/**
 * The server's settings, which every endpoint serves: the file, its problem, and each setting's
 * value in force, the file's, and its source. Named apart from the page's `SettingsView`.
 */
export const SettingsRecordView = view<Settings>()({
  file: true,
  id: true,
  keyboard: {
    singleKeyShortcuts: SettingSelection,
    vimCommands: SettingSelection,
    vimMode: SettingSelection,
  },
  problem: true,
  runs: {
    automaticContinues: SettingSelection,
    catchUpPullRequests: SettingSelection,
    claudeEffortFromEnv: true,
    continueAfterLimit: SettingSelection,
    continueAfterRestart: SettingSelection,
    defaultAgent: true,
    options: true,
    scheduledJobs: SettingSelection,
  },
  server: {
    allowedHosts: SettingSelection,
    openBrowser: SettingSelection,
    port: SettingSelection,
  },
});

/**
 * Every extension, built in or yours, as the settings' Extensions section reads it, from every
 * endpoint: each one's state, problems, where it is on, and its settings. The registries read
 * it too, for where each one is on (`ExtensionsOn`).
 */
export const ExtensionsRecordView = view<Extensions>()({
  api: true,
  docs: true,
  extensions: true,
  folder: true,
  id: true,
});
