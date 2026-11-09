// What the settings page shows at once while a change is sent: the record with the value saved in
// the file, which the input decides. The value in force, and where it comes from, are the server's
// to decide, by its order of flags, variables, and the file: they stay as they were until its
// answer. A refusal puts the record back as it was.
import type { Settings } from "uraeda-server/fate";

type Values = Pick<Settings, "id" | "keyboard" | "runs" | "server">;

/**
 * A kind of automatic run, as the server's `settings.setContinue` names it: a continue, or the
 * catch-up of open pull requests.
 */
export type ContinueKey = "catch-up" | "limit" | "restart";

/** The record's switch of each kind of automatic run. */
export const CONTINUE_SETTINGS = {
  "catch-up": "catchUpPullRequests",
  limit: "continueAfterLimit",
  restart: "continueAfterRestart",
} as const satisfies Record<ContinueKey, keyof Settings["runs"]>;

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
    setContinue: (key: ContinueKey, on: boolean) => {
      const name = CONTINUE_SETTINGS[key];
      return { id, runs: { ...runs, [name]: { ...runs[name], saved: on } } };
    },
    setOpenBrowser: (open: boolean) => ({
      id,
      server: { ...server, openBrowser: { ...openBrowser, saved: open } },
    }),
    // The run options have no flag or variable: what is written is what is in force.
    setRunOptions: (options: Settings["runs"]["options"]) => ({ id, runs: { ...runs, options } }),
    setSingleKeyShortcuts: (on: boolean) => ({
      id,
      keyboard: { ...keyboard, singleKeyShortcuts: { ...keyboard.singleKeyShortcuts, saved: on } },
    }),
    setVimCommands: (lines: Array<string>) => ({
      id,
      keyboard: { ...keyboard, vimCommands: { ...keyboard.vimCommands, saved: lines } },
    }),
    setVimMode: (on: boolean) => ({
      id,
      keyboard: { ...keyboard, vimMode: { ...keyboard.vimMode, saved: on } },
    }),
  };
}
