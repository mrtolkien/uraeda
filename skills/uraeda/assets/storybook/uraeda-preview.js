// Lets Uraeda serve a Storybook under its own address,
// `/r/<repository>/preview/<secret>/<folder>/`.
//
// Wrap the config of `.storybook/main.ts` with it:
//
//   import uraedaPreview from "<path to the skill>/assets/storybook/uraeda-preview.js";
//   export default uraedaPreview({ framework: "@storybook/react-vite", stories: [...] });
//
// Uraeda sets `URAEDA_PREVIEW_BASE` to that path when it starts the preview decision's command.
// Without it, the config is left as it is, so `storybook dev` runs as usual. Under Uraeda, it also
// turns on Storybook's `security.insecureIframeMessaging`: Uraeda shows Storybook's interface in a
// sandboxed frame, which has no origin of its own, and only Uraeda's pages, which hold the preview
// path's secret, can reach it. It needs Storybook's Vite builder, and stops a Storybook built with
// webpack.

import process from "node:process";

/**
 * A preset value of Storybook's config: the value itself, or a function of the value the earlier
 * presets made. Storybook's own types let either be undefined, which adds nothing.
 *
 * @template T
 * @typedef {T | undefined | ((value: T, options: any) => T | undefined | Promise<T | undefined>)} Preset
 */

/**
 * A Vite config, as far as the helper reads and writes it.
 *
 * @typedef {{ base?: string, plugins?: Array<unknown> }} ViteConfig
 */

/**
 * Storybook's security settings, as far as the helper reads and writes them: it keeps the others.
 *
 * @typedef {{ insecureIframeMessaging?: boolean } & Record<string, any>} Security
 */

/**
 * A Storybook config, as far as the helper reads and writes it.
 *
 * @typedef {object} StorybookConfig
 * @property {string | { name: string }} [framework]
 * @property {{ builder?: string | { name: string } }} [core]
 * @property {Preset<string>} [previewHead]
 * @property {Preset<string>} [managerHead]
 * @property {Preset<Security>} [security]
 * @property {(config: any, options: any) => any} [viteFinal]
 */

const NEEDS_VITE = "uraeda-preview.js needs Storybook's Vite builder.";

/**
 * The config of a Storybook that Uraeda serves under `env.URAEDA_PREVIEW_BASE`, or `config` itself
 * when it is unset. With it, Vite's `base` is the path, the two script tags Storybook adds after
 * Vite's own rewriting take it too, and both live sockets, Storybook's channel and Vite's hot
 * reload, open on the page's own address, the channel under the path. Its `security` turns on
 * iframe messaging, over the project's own settings.
 *
 * @template {StorybookConfig} T
 * @param {T} config
 * @param {Record<string, string | undefined>} [env]
 * @returns {T & { previewHead: (head: string, options: unknown) => Promise<string>, managerHead: (head: string, options: unknown) => Promise<string>, security: (value: Security | undefined, options: unknown) => Promise<Security>, viteFinal: (config: any, options: unknown) => Promise<any>, webpackFinal: (config: unknown, options: unknown) => never }}
 */
export default function uraedaPreview(config, env = process.env) {
  const base = env.URAEDA_PREVIEW_BASE;
  if (!base) {
    return /** @type {any} */ (config);
  }
  if (isWebpack(config)) {
    refuseWebpack();
  }
  const patch = socketPatch(base);
  return {
    ...config,
    managerHead: async (head, options) =>
      patch + ((await run(config.managerHead, head, options)) ?? ""),
    previewHead: async (head, options) =>
      patch + ((await run(config.previewHead, head, options)) ?? ""),
    security: async (value, options) => ({
      ...(await run(config.security, value, options)),
      insecureIframeMessaging: true,
    }),
    viteFinal: async (vite, options) => {
      /** @type {ViteConfig} */
      const own = config.viteFinal ? await config.viteFinal(vite, options) : vite;
      return { ...own, base, plugins: [...(own.plugins ?? []), basePlugin(base)] };
    },
    webpackFinal: refuseWebpack,
  };
}

/**
 * The frameworks that build with webpack: Storybook's own Next.js, Angular, and Ember, and any
 * framework named `<name>-webpack5`. Any other framework may build with Vite, such as
 * `@storybook/sveltekit`, `@storybook/nextjs-vite`, or `storybook-solidjs-vite`.
 */
const WEBPACK_FRAMEWORK = /(?:^|\/)@storybook\/(?:nextjs|angular|ember)\/?$|-webpack5\/?$/;

/**
 * Whether Storybook says it builds with webpack: a webpack framework, or a builder other than
 * `@storybook/builder-vite`. A webpack build it does not say so of reaches `webpackFinal`.
 *
 * @param {StorybookConfig} config
 */
function isWebpack(config) {
  const builder = nameOf(config.core?.builder);
  return (
    WEBPACK_FRAMEWORK.test(nameOf(config.framework)) ||
    (builder !== "" && !/(?:^|\/)@storybook\/builder-vite\/?$/.test(builder))
  );
}

/**
 * Stops Storybook: Uraeda serves only a Vite build. Storybook calls it as `webpackFinal` only when
 * it builds with webpack.
 *
 * @returns {never}
 */
function refuseWebpack() {
  throw new Error(NEEDS_VITE);
}

/**
 * The name of a framework or a builder, written as a string or as an object, its Windows
 * separators made `/`.
 *
 * @param {string | { name: string } | undefined} value
 */
function nameOf(value) {
  return ((typeof value === "string" ? value : value?.name) ?? "").replaceAll("\\", "/");
}

/**
 * The value a preset makes of `value`, the earlier presets' value: `value` itself when there is no
 * preset.
 *
 * @template T
 * @param {Preset<T>} preset
 * @param {T} value
 * @param {unknown} options
 * @returns {Promise<T | undefined>}
 */
async function run(preset, value, options) {
  if (preset === undefined) {
    return value;
  }
  return typeof preset === "function" ? await preset(value, options) : preset;
}

/**
 * A Vite plugin giving the path to root-absolute `src` and `href` values in the HTML, after Vite's
 * own rewriting: Storybook adds `/vite-inject-mocker-entry.js` and its app's module after it.
 * Protocol-relative URLs and values under the path already are left alone.
 *
 * @param {string} base
 */
function basePlugin(base) {
  return {
    name: "uraeda-preview",
    transformIndexHtml: {
      /** @param {string} html */
      handler: (html) =>
        html.replaceAll(/\b(src|href)=(["'])(\/(?!\/)[^"']*)\2/g, (tag, name, quote, url) =>
          url.startsWith(base) ? tag : `${name}=${quote}${base}${url.slice(1)}${quote}`,
        ),
      order: /** @type {const} */ ("post"),
    },
  };
}

/**
 * A script replacing the page's `WebSocket` with a subclass: Storybook's channel, which ignores
 * Vite's `base`, opens under the path, and both it and Vite's hot reload socket (`vite-hmr`) open
 * on the page's own host, with `wss:` under `https:`. Other sockets are left as they are.
 *
 * @param {string} base
 */
function socketPatch(base) {
  return `<script>(() => {
  const base = ${JSON.stringify(base)};
  const Native = window.WebSocket;
  window.WebSocket = class extends Native {
    constructor(url, protocols) {
      const target = new URL(url, location.href);
      const channel = target.pathname === "/storybook-server-channel";
      if (channel || [protocols].flat().includes("vite-hmr")) {
        if (channel) {
          target.pathname = base + "storybook-server-channel";
        }
        target.protocol = location.protocol === "https:" ? "wss:" : "ws:";
        target.hostname = location.hostname;
        target.port = location.port;
      }
      super(target.href, protocols);
    }
  };
})();</script>`;
}
