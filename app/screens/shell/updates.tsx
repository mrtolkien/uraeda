// The app's own updates, on Native Shell's `nsh/updater`: the release the app's `nsh.json` names
// (its GitHub Releases, `latest.json`, signed), found once as the app starts and again from the
// settings' Updates, then downloaded and swapped in, and the app restarted on the new version.
// Where the app cannot replace itself, an AppImage, a folder only the system writes, it opens the
// release's page instead. A browser's app comes with its server, and a development run has no
// release: neither updates itself, and `shellInfo()` gives them no version.
//
// What is platform-specific is NSH's: a new platform's package needs only its `nsh-updater.json`
// and its archive in the release's manifest (CONTRIBUTING.md, "Releasing").
import { openUrl, signal, View } from "nsh";
import * as nshUpdater from "nsh/updater";
import type { AppUpdate } from "nsh/updater";
import { device } from "../../store";
import { Button, IconButton, Progress, Text } from "../../ui/controls";
import { Toast } from "../../ui/surfaces";

/** Where a person gets a release by hand. */
export const RELEASES = "https://github.com/mrtolkien/uraeda/releases/latest";

/** What the app asks of NSH's updater. */
export type UpdateSource = Pick<
  typeof nshUpdater,
  "checkForUpdate" | "downloadUpdate" | "installAndRestart" | "shellInfo"
>;

let source: UpdateSource = nshUpdater;

/**
 * Stands in for NSH's updater: a check's page does, as `nsh test` runs no package and its
 * updater finds nothing.
 */
export function standInForUpdater(stand: UpdateSource) {
  source = stand;
}

export type Updates =
  | { is: "unchecked" }
  | { is: "checking" }
  | { is: "current" }
  | { is: "found"; update: AppUpdate }
  | { is: "downloading"; update: AppUpdate; done: number | null }
  | { is: "installing"; update: AppUpdate }
  | { is: "failed"; words: string; update?: AppUpdate };

/** Where the app's update stands. */
export const updates = signal<Updates>({ is: "unchecked" });

/** This app's version, when it updates itself: `null` in a browser and in a development run. */
export const ownVersion = () => source.shellInfo().version;

/** Whether a check, a download, or an install is under way. */
export const busy = () => ["checking", "downloading", "installing"].includes(updates().is);

const reason = (error: unknown) => (error instanceof Error ? error.message : String(error));

/** Asks the release for a newer version than this app's. */
export async function checkForUpdates() {
  if (ownVersion() === null || busy()) return;
  updates.set({ is: "checking" });
  try {
    const newer = await source.checkForUpdate();
    updates.set(newer ? { is: "found", update: newer } : { is: "current" });
  } catch (error) {
    updates.set({ is: "failed", words: `The check failed: ${reason(error)}` });
  }
}

let checked = false;

/** The check as the app starts, once a run. */
export function checkAtStart() {
  if (checked) return;
  checked = true;
  void checkForUpdates();
}

/** The update found, while one is. */
export function found(): AppUpdate | undefined {
  const now = updates();
  return "update" in now ? now.update : undefined;
}

/**
 * Downloads the update found, swaps it in, and restarts the app on it; where the app cannot replace
 * itself, opens the release's page.
 */
export async function installUpdate() {
  const update = found();
  if (update === undefined || busy()) return;
  if (!update.canInstall) {
    await openUrl(RELEASES);
    return;
  }
  updates.set({ done: null, is: "downloading", update });
  try {
    await source.downloadUpdate(({ received, total }) => {
      // A percent at a time: the bytes come in many more pieces than the eye can tell.
      const done = total ? Math.floor((received / total) * 100) / 100 : null;
      const now = updates();
      if (now.is !== "downloading" || now.done !== done) {
        updates.set({ done, is: "downloading", update });
      }
    });
    updates.set({ is: "installing", update });
    // It settles only on a failure: on success, the app quits and starts again, new.
    await source.installAndRestart();
  } catch (error) {
    updates.set({
      is: "failed",
      update,
      words: `The update failed, and this app is as it was: ${reason(error)}`,
    });
  }
}

/** What the update's button says: install it here, or get it from the release's page. */
export const installLabel = (update: AppUpdate) =>
  update.canInstall ? "Install and restart" : "Get it";

/** Where the update stands, in words, for the toast and the settings. */
export function updateWords(): string | undefined {
  const now = updates();
  switch (now.is) {
    case "checking":
      return "Looking for a new version…";
    case "current":
      return "This is the latest version.";
    case "found":
      return now.update.canInstall
        ? `Uraeda ${now.update.version} is out: it installs here, and the app restarts on it.`
        : `Uraeda ${now.update.version} is out. This copy cannot replace itself: get it from its release's page.`;
    case "downloading":
      return now.done === null
        ? `Downloading Uraeda ${now.update.version}…`
        : `Downloading Uraeda ${now.update.version}`;
    case "installing":
      return `Installing Uraeda ${now.update.version}: the app restarts on it.`;
    case "failed":
      return now.words;
    case "unchecked":
      return undefined;
  }
}

/** How much of the update is downloaded, once its size is known. */
function share() {
  const now = updates();
  return now.is === "downloading" ? now.done : null;
}

/** Where the update stands: its words, or its download's bar once its size is known. */
export function UpdateStatus() {
  return (
    <If
      when={share() !== null}
      else={
        <If when={updateWords()}>
          {(words) => <Text tone={updates().is === "failed" ? "danger" : "quiet"}>{words()}</Text>}
        </If>
      }
    >
      <Progress
        label={updateWords() ?? ""}
        testID="update-progress"
        value={share() ?? 0}
        words={`${Math.round((share() ?? 0) * 100)}%`}
      />
    </If>
  );
}

/** The update's button, while there is one to press. */
export function InstallButton(props: { testID?: string }) {
  return (
    <If when={updates().is === "found" || updates().is === "failed" ? found() : undefined}>
      {(update) => (
        <Button
          icon={update().canInstall ? "download" : "external-link"}
          label={installLabel(update())}
          onPress={() => void installUpdate()}
          testID={props.testID ?? "install-update"}
        />
      )}
    </If>
  );
}

/** The toast of a new version, until it is installed or put off: "Not now" keeps it quiet. */
export function UpdateToast() {
  const shown = () => {
    const update = found();
    return update !== undefined && device.get("update.later") !== update.version;
  };
  return (
    <If when={shown() ? found() : undefined}>
      {(update) => (
        <Toast icon="download" testID="update-toast" title={`Uraeda ${update().version}`}>
          <View style={{ alignItems: "flex-start", flexDirection: "row", gap: 8 }}>
            <View style={{ flex: 1, minWidth: 0 }}>
              <UpdateStatus />
            </View>
            <IconButton
              icon="x"
              label="Not now"
              onPress={() => device.set("update.later", update().version)}
            />
          </View>
          <View style={{ alignItems: "flex-end" }}>
            <InstallButton testID="toast-install" />
          </View>
        </Toast>
      )}
    </If>
  );
}
