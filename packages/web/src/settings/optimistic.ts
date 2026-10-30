// What the settings page shows at once while a change is sent: the record with the value saved in
// the file, which the input decides. The value in force, and where it comes from, are the server's
// to decide, by its order of flags, variables, and the file: they stay as they were until its
// answer. A refusal puts the record back as it was.
import type { Settings } from "uraeda-server/fate";

type Values = Pick<Settings, "id" | "keyboard" | "runs" | "server">;

/** The records each change of the settings page shows while it is sent. */
export function optimisticSettings({ id, keyboard, runs, server }: Values) {
  const { allowedHosts, openBrowser } = server;
  return {
    // A host name added is left to the answer: the core trims it and puts it in lower case.
    removeHost: (name: string) => ({
      id,
      server: {
        ...server,
        allowedHosts: {
          ...allowedHosts,
          saved: (allowedHosts.saved ?? []).filter((host) => host !== name),
        },
      },
    }),
    setBuildInFreshSession: (fresh: boolean) => ({
      id,
      runs: { ...runs, buildInFreshSession: { ...runs.buildInFreshSession, saved: fresh } },
    }),
    setOpenBrowser: (open: boolean) => ({
      id,
      server: { ...server, openBrowser: { ...openBrowser, saved: open } },
    }),
    setSingleKeyShortcuts: (on: boolean) => ({
      id,
      keyboard: { ...keyboard, singleKeyShortcuts: { ...keyboard.singleKeyShortcuts, saved: on } },
    }),
  };
}
