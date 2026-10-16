/**
 * The settings' changes, which every endpoint serves, the global one too: each written by the core,
 * then read again by `ServerSettings`, which sends the record's live update, then answered.
 */
import type { Settings } from "uraeda-binding";
import { refusable } from "./errors.ts";
import type { ListResolver } from "./list-mutations.ts";
import { settingsDataView, settingsRecord } from "./settings.ts";
import { sources } from "./sources.ts";

/**
 * Writes a change through the binding, a file that cannot be read refused with its problem, then
 * answers the record read again, masked to the fields the client selected: never before the
 * settings hold the change.
 */
async function settingsChanged(
  { ctx, select }: Omit<ListResolver<unknown>, "input">,
  write: (dir: string) => Promise<Settings>,
) {
  await refusable(async () => {
    try {
      await write(ctx.settings.dir);
    } catch (error) {
      // The binding rejects a file that cannot be read with `unreadable: Cannot read …`: the
      // client shows it as any other refusal.
      const message = error instanceof Error ? error.message : String(error);
      throw /^unreadable: /.test(message)
        ? new Error(message.replace(/^unreadable: /, "refused: "))
        : error;
    }
  });
  await ctx.settings.reload();
  return sources.masked(settingsDataView, ctx, settingsRecord(ctx.settings), select);
}

/** The settings' mutations, served by every endpoint, the global one too. */
export const settingsMutations = {
  "settings.addHost": {
    resolve: ({ input, ...call }: ListResolver<{ name: string }>) =>
      settingsChanged(call, (dir) => call.ctx.binding.addAllowedHost(dir, input.name)),
    type: "Settings",
  },
  "settings.editHost": {
    resolve: ({ input, ...call }: ListResolver<{ from: string; to: string }>) =>
      settingsChanged(call, (dir) => call.ctx.binding.editAllowedHost(dir, input.from, input.to)),
    type: "Settings",
  },
  "settings.removeHost": {
    resolve: ({ input, ...call }: ListResolver<{ name: string }>) =>
      settingsChanged(call, (dir) => call.ctx.binding.removeAllowedHost(dir, input.name)),
    type: "Settings",
  },
  "settings.setOpenBrowser": {
    resolve: ({ input, ...call }: ListResolver<{ open: boolean }>) =>
      settingsChanged(call, (dir) => call.ctx.binding.setOpenBrowser(dir, input.open)),
    type: "Settings",
  },
  "settings.setPort": {
    resolve: ({ input, ...call }: ListResolver<{ port: string }>) =>
      settingsChanged(call, (dir) => call.ctx.binding.setPort(dir, input.port)),
    type: "Settings",
  },
};
