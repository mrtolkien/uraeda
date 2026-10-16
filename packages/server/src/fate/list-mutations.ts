/**
 * The list's mutations, which every endpoint serves, the global one too, and what they share with
 * the repository's mutations: their arguments, and the session manager's errors as refusals.
 */
import { homedir } from "node:os";
import { typedFolder } from "../folders.ts";
import { type Context, unlockedList } from "./context.ts";
import { callSiteError, refusable } from "./errors.ts";
import { repositoriesRecord, sources } from "./sources.ts";
import { repositoriesDataView } from "./views-repositories.ts";

/** The arguments of a mutation of the list, which every endpoint serves. */
export type ListResolver<Input> = { ctx: Context; input: Input; select: Array<string> };

/** Runs a session manager's call, its errors as refusals the client shows where it called. */
export async function refusedOn<T>(call: () => T | Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw callSiteError(/^(refused|conflict|hook): /.test(message) ? error : `refused: ${message}`);
  }
}

/**
 * The list after a change through the binding, read again by the hosts, which sends it to every
 * view: masked to the fields the client selected.
 */
async function listChanged(ctx: Context, select: Array<string>, added: string | null = null) {
  await ctx.hosts.reload();
  return sources.masked(repositoriesDataView, ctx, repositoriesRecord(ctx, added), select);
}

/** The list's mutations, served by every endpoint, the global one too. */
export const listMutations = {
  "repositories.add": {
    resolve: async ({ ctx, input, select }: ListResolver<{ folder: string }>) => {
      unlockedList(ctx);
      const folder = await refusedOn(() => typedFolder(input.folder, homedir()));
      const { repository } = await refusable(() => ctx.binding.addRepository(ctx.dataDir, folder));
      return listChanged(ctx, select, repository.name);
    },
    type: "Repositories",
  },
  "repositories.open": {
    resolve: async ({ ctx, input, select }: ListResolver<{ name: string }>) => {
      unlockedList(ctx);
      await refusable(() => ctx.binding.openRepository(ctx.dataDir, input.name));
      return listChanged(ctx, select);
    },
    type: "Repositories",
  },
  "repositories.remove": {
    resolve: async ({ ctx, input, select }: ListResolver<{ name: string }>) => {
      unlockedList(ctx);
      const host = ctx.hosts.get(input.name);
      if (host && ctx.sessions.busy(host.path)) {
        throw callSiteError(`refused: An agent is working in ${input.name}: stop it first.`);
      }
      await refusable(() => ctx.binding.removeRepository(ctx.dataDir, input.name));
      return listChanged(ctx, select);
    },
    type: "Repositories",
  },
};
