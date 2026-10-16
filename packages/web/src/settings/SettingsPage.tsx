// The settings page's route: the server's settings record, read on the global client as the list
// of repositories is, and its changes, passed to `SettingsView`. Removing the host name this
// browser reached the server through asks first, while the file's names are in force.
import { useFateClient } from "react-fate";
import { useSettings } from "../data.ts";
import { refusal } from "../errors.ts";
import { type ConfirmOptions, useConfirm } from "../fields/Confirm.tsx";
import { OnListClient } from "../RepositoryMenu.tsx";
import { useRepoPath, useRestoreScroll } from "../routes.tsx";
import { SettingsRecordView } from "../views.ts";
import { categoryOf } from "./categories.ts";
import type { ServerActions, ServerValues } from "./ServerSettings.tsx";
import { SettingsView } from "./SettingsView.tsx";

const UNREACHABLE = "Could not reach the Uraeda server.";

/** The names that reach the server whatever its settings say. */
const ALWAYS_ALLOWED = new Set(["127.0.0.1", "localhost"]);

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

/**
 * Whether removing `name` cuts this browser off: it is the host name the browser reached the
 * server through, `browser`, not one that always passes, and the file's names are in force.
 */
function cutsOff(name: string, browser: string, values: ServerValues): boolean {
  const host = browser.toLowerCase();
  return (
    !ALWAYS_ALLOWED.has(host) && values.server.allowedHosts.source.kind === "file" && name === host
  );
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

/** The page, on the record the global client reads. */
function OnSettings({ category }: { category?: string }) {
  const fate = useFateClient();
  const settings = useSettings();
  const confirm = useConfirm();
  const here = useRepoPath();
  useRestoreScroll(true);
  const view = SettingsRecordView;
  const { settings: change } = fate.mutations;
  const actions: ServerActions = {
    addHost: (name) => run(() => change.addHost({ input: { name }, view })),
    editHost: (from, to) => run(() => change.editHost({ input: { from, to }, view })),
    removeHost: async (name) => {
      if (cutsOff(name, window.location.hostname, settings) && !(await confirm(removeOwn(name)))) {
        return undefined;
      }
      return run(() => change.removeHost({ input: { name }, view }));
    },
    setBuildInFreshSession: (fresh) =>
      run(() => change.setBuildInFreshSession({ input: { fresh }, view })),
    setOpenBrowser: (open) => run(() => change.setOpenBrowser({ input: { open }, view })),
    setPort: (port) => run(() => change.setPort({ input: { port }, view })),
  };
  return (
    <SettingsView
      category={category === undefined ? undefined : categoryOf(category)?.id}
      indexPath={here("/settings")}
      pathOf={(id) => here(`/settings/${id}`)}
      server={settings}
      serverActions={actions}
    />
  );
}

/** The settings page, at `/r/<name>/settings` or `/r/<name>/settings/<category>`. */
export function SettingsPage({ category }: { category?: string }) {
  return (
    <OnListClient>
      <OnSettings category={category} />
    </OnListClient>
  );
}
