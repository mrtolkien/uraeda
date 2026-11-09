// The mutation of a feature's own run options, which apply from its next run on: its record shows
// them beside the settings' (see `featureRecord`).
import type { RunOptions } from "uraeda-binding";
import { sender } from "../live.ts";
import type { Resolver } from "./context.ts";
import { refusable } from "./errors.ts";
import { featureRecord } from "./sessions.ts";
import { sources } from "./sources.ts";
import { featureDataView } from "./views.ts";

/** The repository mutations of a feature's run options. */
export const runOptionsMutations = {
  "feature.setRunOptions": {
    resolve: async ({ ctx, input, select }: Resolver<{ folder: string; options: RunOptions }>) => {
      const feature = await refusable(async () => {
        // A folder that is no change's or feature's keeps no options.
        const read = await ctx.binding.readFeature(ctx.repo, input.folder);
        const root = await ctx.sessions.mainRoot(ctx.repo);
        ctx.featureOptions.set(root, input.folder, input.options);
        return read;
      });
      const host = ctx.hosts.byPath(ctx.repo);
      if (host) {
        sender(host.live)("Feature", input.folder);
      }
      return sources.masked(featureDataView, ctx, await featureRecord(ctx, feature), select);
    },
    type: "Feature",
  },
};
