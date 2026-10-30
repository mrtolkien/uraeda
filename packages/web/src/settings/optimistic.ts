// What the settings page shows at once while a change is sent: the record with the value saved, in
// force too unless a flag or a variable gives it for this run. The server's answer replaces it, and
// a refusal puts the record back as it was.
import type { Settings } from "uraeda-server/fate";

type Values = Pick<Settings, "id" | "keyboard" | "runs" | "server">;

/** A setting, as the record holds it. */
type Setting<T> = { inForce: T; saved: T | null; source: Settings["server"]["port"]["source"] };

/** `setting` with `value` saved in the file: in force too, unless a flag or a variable gives it. */
function savedAs<T>(setting: Setting<T>, value: T): Setting<T> {
  const given = setting.source.kind === "flag" || setting.source.kind === "environment";
  return given
    ? { ...setting, saved: value }
    : { inForce: value, saved: value, source: { kind: "file" } };
}

/** The records each change of the settings page shows while it is sent. */
export function optimisticSettings({ id, keyboard, runs, server }: Values) {
  const hosts = server.allowedHosts.saved ?? [];
  const withHosts = (names: Array<string>) => ({
    id,
    server: { ...server, allowedHosts: savedAs(server.allowedHosts, names) },
  });
  return {
    addHost: (name: string) => withHosts([...hosts, name]),
    removeHost: (name: string) => withHosts(hosts.filter((host) => host !== name)),
    setBuildInFreshSession: (fresh: boolean) => ({
      id,
      runs: { ...runs, buildInFreshSession: savedAs(runs.buildInFreshSession, fresh) },
    }),
    setOpenBrowser: (open: boolean) => ({
      id,
      server: { ...server, openBrowser: savedAs(server.openBrowser, open) },
    }),
    setSingleKeyShortcuts: (on: boolean) => ({
      id,
      keyboard: { ...keyboard, singleKeyShortcuts: savedAs(keyboard.singleKeyShortcuts, on) },
    }),
  };
}
