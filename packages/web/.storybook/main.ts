// Uraeda's own Storybook: the stories of `packages/web/src`, fed by Uraeda's real server over a fresh
// copy of the fixture repository, on the fake agent (see `specs/decisions/preview.md`). The skill's
// helper wraps the config, so Uraeda serves it under its own address when it runs it.
import type { StorybookConfig } from "@storybook/react-vite";
import type { Plugin, PluginOption } from "vite-plus";
import uraedaPreview from "../../../skills/uraeda/assets/storybook/uraeda-preview.js";
import { fixtureServer } from "./fixture.ts";

/**
 * StyleX's dev runtime fetches its stylesheet again at the root-absolute `'/virtual:stylex.css'`:
 * under Uraeda's base path, that reaches Uraeda, not this Storybook.
 */
function stylexUnderBase(base: string): Plugin {
  return {
    name: "uraeda-stylex-base",
    transform(code, id) {
      return id.includes("virtual:stylex:runtime")
        ? code.replaceAll("'/virtual:stylex.css'", `'${base}virtual:stylex.css'`)
        : undefined;
    },
  };
}

/** Whether a plugin is the given one, by name. */
const named = (name: string) => (plugin: PluginOption) =>
  Boolean(plugin && typeof plugin === "object" && "name" in plugin && plugin.name === name);

/**
 * The web UI's Vite config, as Storybook read it, with Uraeda's server over the fixture: on the fake
 * agent, dated 2026-10-16, with no `.env`, and fate's requests sent as GETs (R4). The build runs no
 * server, so it builds no fixture.
 */
const viteFinal: StorybookConfig["viteFinal"] = (config, { configType }) => {
  const plugins = (config.plugins ?? []).filter((plugin) => !named("uraeda-server")(plugin));
  const base = process.env.URAEDA_PREVIEW_BASE;
  if (base) {
    plugins.push(stylexUnderBase(base));
  }
  if (configType === "DEVELOPMENT") {
    plugins.push(...fixtureServer());
  }
  // StyleX's plugin holds the dependency crawl on some of Astryx's components, as Astryx's own
  // Storybook found: the optimizer goes on without waiting for the crawl's end.
  return {
    ...config,
    optimizeDeps: { ...config.optimizeDeps, holdUntilCrawlEnd: false },
    plugins,
  };
};

const config: StorybookConfig = {
  core: { disableTelemetry: true },
  framework: "@storybook/react-vite",
  stories: ["../src/**/*.stories.tsx"],
  viteFinal,
};

export default uraedaPreview(config);
