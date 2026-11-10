// The extensions' mutations: turning one on, writing its settings, and reporting a page's problem,
// on every endpoint, and running an action, on a repository's endpoint, where its extension is on.
import { randomUUID } from "node:crypto";
import { type Context, inRepository } from "./context.ts";
import { callSiteError, settingsWrite } from "./errors.ts";
import { extensionActionDataView, extensionsDataView, extensionsRecord } from "./extensions.ts";
import type { ListResolver } from "./list-mutations.ts";
import { sources } from "./sources.ts";

/**
 * Writes through the binding, a settings file that cannot be read refused with its problem, then
 * answers the record once the host read the extensions again, masked to the fields selected.
 */
async function written(
  { ctx, select }: Omit<ListResolver<unknown>, "input">,
  write: (configDir: string) => Promise<void>,
) {
  await settingsWrite(() => write(ctx.settings.dir));
  await ctx.extensions?.refresh();
  return sources.masked(extensionsDataView, ctx, await extensionsRecord(ctx), select);
}

/** Runs an extension's action in the request's repository, refused where it is off. */
async function act(
  ctx: Context,
  input: { extension: string; inputJson: string; name: string },
): Promise<string> {
  const { extensions, repo } = inRepository(ctx);
  if (!extensions) {
    throw callSiteError(`refused: ${input.extension} is not loaded`);
  }
  try {
    return await extensions.act(input.extension, input.name, input.inputJson, repo);
  } catch (error) {
    throw callSiteError(error);
  }
}

export const extensionMutations = {
  "extensions.act": {
    resolve: async ({
      ctx,
      input,
      select,
    }: ListResolver<{ extension: string; inputJson: string; name: string }>) =>
      sources.masked(
        extensionActionDataView,
        ctx,
        { id: randomUUID(), outputJson: await act(ctx, input) },
        select,
      ),
    type: "ExtensionAction",
  },
  // A problem an extension's page met in the browser, shown with the extension's own until its
  // page's next version.
  "extensions.reportPageProblem": {
    resolve: async ({
      ctx,
      input,
      select,
    }: ListResolver<{ message: string; name: string; version: number }>) => {
      ctx.extensions?.reportPageProblem(input.name, input.version, String(input.message));
      return sources.masked(extensionsDataView, ctx, await extensionsRecord(ctx), select);
    },
    type: "Extensions",
  },
  "extensions.setOn": {
    resolve: ({ input, ...call }: ListResolver<{ name: string; on: "all" | Array<string> }>) =>
      written(call, (dir) =>
        call.ctx.binding.setExtensionOn(dir, call.ctx.dataDir, input.name, input.on),
      ),
    type: "Extensions",
  },
  "extensions.setSetting": {
    resolve: ({
      input,
      ...call
    }: ListResolver<{ key: string; name: string; repository: string | null; valueJson: string }>) =>
      written(call, (dir) =>
        call.ctx.binding.setExtensionSetting(
          dir,
          call.ctx.dataDir,
          input.name,
          input.repository,
          input.key,
          input.valueJson,
        ),
      ),
    type: "Extensions",
  },
};
