// The server's Storybooks: their runner and frame secret, the ones of the folders waiting for the
// human, and the WebSockets to them.
import type { RepoContext } from "./fate/context.ts";
import { keptBases, startWaiting } from "./fate/preview-waiting.ts";
import { guardCheck } from "./guard.ts";
import { livePreviews, renewPreviews } from "./live.ts";
import { GroupRecord, groupsFolder, killLeftGroups } from "./preview/groups.ts";
import { previewUpgrade } from "./preview/proxy.ts";
import type { Previews } from "./preview/runner.ts";
import { oldGroupsFolder, removeOldRunFiles } from "./run-folder.ts";
import type { ServerSettings } from "./settings.ts";
import { FrameSecret } from "./sign-in/frames.ts";

/**
 * The server's Storybook runner and its frame secret. The Storybooks a killed server left run no
 * more: their record's groups are killed first, an earlier version's in the data folder's root too,
 * before its running files there are removed.
 */
export function startPreviews(dataDir: string): { frames: FrameSecret; previews: Previews } {
  const record = groupsFolder(dataDir);
  killLeftGroups(record);
  killLeftGroups(oldGroupsFolder(dataDir));
  removeOldRunFiles(dataDir);
  const previews = livePreviews({ record: new GroupRecord(record) });
  // One frame secret for the server: each replacement restarts its Storybooks under the new base.
  const frames = new FrameSecret();
  frames.onReplace(() => renewPreviews(previews));
  return { frames, previews };
}

/**
 * Starts the Storybooks of the folders waiting for the human, one after the other, and returns the
 * runner's sweep, which keeps them: a tick while the last one still reads them is skipped, and one
 * whose read fails keeps none. Each listed repository's context is the one a turn's end gives
 * `warmPreview`.
 */
export function waitingPreviews(shared: Omit<RepoContext, "repo">): () => void {
  const { hosts, previews } = shared;
  const contexts = () => hosts.all().map((host) => ({ ...shared, repo: host.path }));
  startWaiting(contexts()).catch(() => {});
  let sweeping = false;
  return () => {
    if (sweeping) {
      return;
    }
    sweeping = true;
    void keptBases(contexts())
      .catch(() => new Set<string>())
      .then((kept) => previews.sweep(kept))
      .finally(() => {
        sweeping = false;
      });
  };
}

/** The server's upgrades: WebSockets to the Storybooks, through the guard's rule. */
export function upgrades(
  options: { allowOrigins: Array<string>; port: number; settings: ServerSettings },
  frames: FrameSecret,
  previews: Previews,
) {
  return previewUpgrade({
    check: guardCheck({
      allowedHosts: () => options.settings.allowedHosts(),
      allowOrigins: options.allowOrigins,
      isFrame: (path) => frames.allows(path),
      port: options.port,
    }),
    frames,
    previews,
  });
}
