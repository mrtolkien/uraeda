// The settings page's route: the server's settings record, read on the global client as the list
// of repositories is, and its changes, the colour themes, and the extensions with the names of the
// repositories they can be on in, passed to `SettingsView`. Removing
// the host name this browser reached the server through asks first, while the file's names are in
// force.
import { useFateClient } from "react-fate";
import { useRepositories, useSettings } from "../data.ts";
import { useExtensionsRecord } from "./useExtensionsRecord.ts";
import { refusal } from "../errors.ts";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { OnListClient } from "../ListClient.tsx";
import { useRestoreScroll } from "../routes.tsx";
import { ExtensionsRecordView, SettingsRecordView } from "../views.ts";
import { categoryOf } from "./categories.ts";
import { optimisticSettings } from "./optimistic.ts";
import { cutsOff } from "./hosts.ts";
import type { ServerActions } from "./ServerSettings.tsx";
import { SettingsView } from "./SettingsView.tsx";
import { useThemes } from "../useThemes.ts";
import type { AppearanceThemes } from "./AppearanceSettings.tsx";
import type { ExtensionActions, ExtensionsValues } from "./ExtensionSettings.tsx";
import { withOn } from "./extensions.ts";

const UNREACHABLE = "Could not reach the Uraeda server.";

/** The themes until their record is read: none listed, no file. */
const NO_THEMES: AppearanceThemes = { files: [], folder: "", themes: [] };

/** What removing the host name of this browser asks. */
function removeOwn(name: string): ConfirmOptions {
  return {
    body: `This browser reaches Uraeda through ${name}. Once it is removed, the server refuses this browser until the name is added again, from another device or in the file.`,
    cancel: "Cancel",
    confirm: "Remove",
    destructive: true,
    title: "Remove the host name of this browser?",
  };
}

/** Sends a change: the core's refusal, or the server's absence, as the error to show. */
async function run(call: () => Promise<{ error?: unknown }>): Promise<string | undefined> {
  try {
    const { error } = await call();
    return error ? refusal(error).message : undefined;
  } catch {
    return UNREACHABLE;
  }
}

/**
 * The Extensions section's record and changes: where one is on shows at once, and a setting once
 * the core wrote it, as the port's does.
 */
function useExtensionsSection(): { actions: ExtensionActions; values: ExtensionsValues } {
  const fate = useFateClient();
  const record = useExtensionsRecord();
  const repositories = useRepositories();
  const view = ExtensionsRecordView;
  const { extensions: change } = fate.mutations;
  return {
    actions: {
      setOn: (name, on) =>
        run(() =>
          change.setOn({
            input: { name, on: on === "all" ? "all" : [...on] },
            optimistic: { extensions: withOn(record.extensions, name, on), id: record.id },
            view,
          }),
        ),
      setSetting: (name, repository, key, valueJson) =>
        run(() => change.setSetting({ input: { key, name, repository, valueJson }, view })),
    },
    values: {
      extensions: record.extensions,
      folder: record.folder,
      repositories: repositories.rows.map((row) => row.name),
    },
  };
}

/** The page, on the record the global client reads. */
function OnSettings({ category }: { category?: string }) {
  const fate = useFateClient();
  const extensions = useExtensionsSection();
  const settings = useSettings();
  const themes = useThemes() ?? NO_THEMES;
  const confirm = useConfirm();
  useRestoreScroll(true);
  const view = SettingsRecordView;
  const { settings: change } = fate.mutations;
  const shown = optimisticSettings(settings);
  const actions: ServerActions = {
    addHost: (name) => run(() => change.addHost({ input: { name }, view })),
    editHost: (from, to) => run(() => change.editHost({ input: { from, to }, view })),
    removeHost: async (name) => {
      if (
        cutsOff(name, window.location.hostname, settings.server.allowedHosts.source) &&
        !(await confirm(removeOwn(name)))
      ) {
        return undefined;
      }
      return run(() =>
        change.removeHost({ input: { name }, optimistic: shown.removeHost(name), view }),
      );
    },
    // Typed in a field, as the port is.
    setAutomaticContinues: (continues) =>
      run(() => change.setAutomaticContinues({ input: { continues }, view })),
    setBuildInFreshSession: (fresh) =>
      run(() =>
        change.setBuildInFreshSession({
          input: { fresh },
          optimistic: shown.setBuildInFreshSession(fresh),
          view,
        }),
      ),
    setContinue: (key, on) =>
      run(() =>
        change.setContinue({ input: { key, on }, optimistic: shown.setContinue(key, on), view }),
      ),
    setOpenBrowser: (open) =>
      run(() =>
        change.setOpenBrowser({ input: { open }, optimistic: shown.setOpenBrowser(open), view }),
      ),
    // The port and a host name's edit are typed in a field, which shows them as typed until saved.
    setPort: (port) => run(() => change.setPort({ input: { port }, view })),
    setSingleKeyShortcuts: (on) =>
      run(() =>
        change.setSingleKeyShortcuts({
          input: { on },
          optimistic: shown.setSingleKeyShortcuts(on),
          view,
        }),
      ),
    setVimCommands: (lines) =>
      run(() =>
        change.setVimCommands({
          input: { lines },
          optimistic: shown.setVimCommands(lines),
          view,
        }),
      ),
    setVimMode: (on) =>
      run(() => change.setVimMode({ input: { on }, optimistic: shown.setVimMode(on), view })),
  };
  return (
    <SettingsView
      category={category === undefined ? undefined : categoryOf(category)?.id}
      extensionActions={extensions.actions}
      extensions={extensions.values}
      server={settings}
      serverActions={actions}
      themes={themes}
    />
  );
}

/**
 * The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`, which scrolls to
 * that category's section.
 */
export function SettingsPage({ category }: { category?: string }) {
  return (
    <OnListClient>
      <OnSettings category={category} />
    </OnListClient>
  );
}
