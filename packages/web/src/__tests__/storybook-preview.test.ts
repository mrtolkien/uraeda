// The helper: base, script tags, sockets, and other builders, one row per Storybook config and
// variable, as the spec's test plan lists them.
import { Window } from "happy-dom";
import { expect, test } from "vite-plus/test";
import uraedaPreview from "../../../../skills/uraeda/assets/storybook/uraeda-preview.js";

const BASE = "/r/uraeda/preview/2026-10-20-sidebar-resize/";
const vite = { framework: "@storybook/react-vite", stories: ["../src/**/*.stories.tsx"] };

/** A Vite config, as far as the helper reads and writes it. */
type ViteConfig = { base?: string; plugins: Array<unknown> };

/** The HTML that the helper's `post` hook of `transformIndexHtml` makes of `html`. */
async function transformIndexHtml(final: ViteConfig, html: string): Promise<string> {
  const plugin = final.plugins.find(
    (
      entry,
    ): entry is { transformIndexHtml: { handler: (html: string) => string; order: string } } =>
      typeof entry === "object" && entry !== null && "transformIndexHtml" in entry,
  );
  expect(plugin?.transformIndexHtml.order).toBe("post");
  return plugin!.transformIndexHtml.handler(html);
}

/**
 * The URLs of the sockets that the scripts of `head` make of `calls`, each the arguments of a
 * `WebSocket`, opened from a page at `url`.
 */
async function socketsOpenedBy(
  head: string,
  url: string,
  calls: Array<[string] | [string, string]>,
): Promise<Array<string>> {
  const window = new Window({
    settings: {
      enableJavaScriptEvaluation: true,
      suppressInsecureJavaScriptEnvironmentWarning: true,
    },
    url,
  });
  const opened: Array<string> = [];
  Object.assign(window, {
    WebSocket: class {
      constructor(socketUrl: string) {
        opened.push(socketUrl);
      }
    },
  });
  const holder = window.document.createElement("div");
  holder.innerHTML = head;
  for (const script of holder.querySelectorAll("script")) {
    const copy = window.document.createElement("script");
    copy.textContent = script.textContent;
    window.document.head.append(copy);
  }
  const Socket = (window as unknown as { WebSocket: new (...args: Array<string>) => unknown })
    .WebSocket;
  for (const call of calls) {
    new Socket(...call);
  }
  await window.happyDOM.close();
  return opened;
}

test("without the variable, the config is left as it is", () => {
  expect(uraedaPreview(vite, {})).toBe(vite);
});

test.each([
  ["the webpack framework", { framework: "@storybook/react-webpack5" }],
  ["a webpack builder", { ...vite, core: { builder: "@storybook/builder-webpack5" } }],
  ["Next.js on webpack", { framework: "@storybook/nextjs" }],
  [
    "a webpack framework at a Windows path",
    { framework: { name: "C:\\app\\node_modules\\@storybook\\angular" } },
  ],
])("%s stops Storybook", (_, config) => {
  expect(() => uraedaPreview(config, { URAEDA_PREVIEW_BASE: BASE })).toThrow(
    "uraeda-preview.js needs Storybook's Vite builder.",
  );
});

test.each([
  ["SvelteKit", { framework: "@storybook/sveltekit" }],
  ["a community Vite framework", { framework: "storybook-solidjs-vite" }],
  ["Next.js on Vite", { framework: "@storybook/nextjs-vite" }],
  [
    "a Vite framework at a Windows path",
    { framework: { name: "C:\\app\\node_modules\\@storybook\\react-vite" } },
  ],
  ["the Vite builder named", { ...vite, core: { builder: "@storybook/builder-vite" } }],
])("%s is served", (_, config) => {
  expect(() => uraedaPreview(config, { URAEDA_PREVIEW_BASE: BASE })).not.toThrow();
});

test("a webpack build the config does not show stops Storybook", () => {
  const wrapped = uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE });
  expect(() => wrapped.webpackFinal({}, {})).toThrow(
    "uraeda-preview.js needs Storybook's Vite builder.",
  );
});

test("Vite's base, and the two tags that ignore it, take the path", async () => {
  const wrapped = uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE });
  const final = await wrapped.viteFinal!({ plugins: [] }, {});
  const html = await transformIndexHtml(
    final,
    '<script src="/vite-inject-mocker-entry.js"></script><script src="/@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"></script><a href="//cdn.dev/x"></a>' +
      `<script src="${BASE}already.js"></script>`,
  );
  expect(final.base).toBe(BASE);
  expect(html).toContain(`src="${BASE}vite-inject-mocker-entry.js"`);
  expect(html).toContain(`src="${BASE}@id/__x00__virtual:/@storybook/builder-vite/vite-app.js"`);
  expect(html).toContain('href="//cdn.dev/x"');
  expect(html).toContain(`src="${BASE}already.js"`);
});

test("both live sockets follow the page's own address, the channel under the path", async () => {
  const head = await uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE }).previewHead!("<meta>", {});
  const opened = await socketsOpenedBy(
    head,
    "https://mac.tail1234.ts.net/r/uraeda/preview/x/iframe.html",
    [
      ["ws://127.0.0.1:6123/storybook-server-channel"],
      ["ws://127.0.0.1:6123/r/uraeda/preview/2026-10-20-sidebar-resize/", "vite-hmr"],
      ["wss://api.example.com/feed"],
    ],
  );
  expect(head).toContain("<meta>");
  expect(opened).toEqual([
    `wss://mac.tail1234.ts.net${BASE}storybook-server-channel`,
    `wss://mac.tail1234.ts.net${BASE}`,
    "wss://api.example.com/feed",
  ]);
});

test("the manager's channel socket moves under the path too", async () => {
  const head = await uraedaPreview(vite, { URAEDA_PREVIEW_BASE: BASE }).managerHead!("", {});
  const opened = await socketsOpenedBy(head, "http://127.0.0.1:4310/r/uraeda/preview/x/", [
    ["ws://127.0.0.1:6123/storybook-server-channel"],
  ]);
  expect(opened).toEqual([`ws://127.0.0.1:4310${BASE}storybook-server-channel`]);
});

test("the config's own heads and viteFinal still run", async () => {
  const own = { name: "own" };
  const wrapped = uraedaPreview(
    {
      ...vite,
      managerHead: (head: string) => `${head}<manager>`,
      previewHead: () => "<own>",
      viteFinal: (config: ViteConfig) => ({ ...config, plugins: [...config.plugins, own] }),
    },
    { URAEDA_PREVIEW_BASE: BASE },
  );

  expect(await wrapped.previewHead!("<meta>", {})).toMatch(/<\/script><own>$/);
  expect(await wrapped.managerHead!("<meta>", {})).toMatch(/<\/script><meta><manager>$/);
  const final = await wrapped.viteFinal!({ plugins: [] }, {});
  expect(final.plugins).toContain(own);
  expect(final.base).toBe(BASE);
});

test.each([
  ["no security of its own", vite, undefined, { insecureIframeMessaging: true }],
  [
    "its own security, kept",
    { ...vite, security: { insecureRemoteIframeEmbed: true } },
    undefined,
    { insecureIframeMessaging: true, insecureRemoteIframeEmbed: true },
  ],
  [
    "its own security as a preset function, given the earlier value",
    { ...vite, security: (value?: object) => ({ ...value, insecureRemoteIframeEmbed: true }) },
    { earlier: true },
    { earlier: true, insecureIframeMessaging: true, insecureRemoteIframeEmbed: true },
  ],
  [
    "the earlier presets' security, without one of its own",
    vite,
    { earlier: true },
    { earlier: true, insecureIframeMessaging: true },
  ],
  [
    "its own insecureIframeMessaging turned off",
    { ...vite, security: { insecureIframeMessaging: false } },
    undefined,
    { insecureIframeMessaging: true },
  ],
])("under Uraeda, %s, iframe messaging is on", async (_, config, earlier, expected) => {
  const wrapped = uraedaPreview(config, { URAEDA_PREVIEW_BASE: BASE });

  expect(await wrapped.security(earlier, {})).toEqual(expected);
});

test("without the variable, a project's security is left as it is", () => {
  const config = { ...vite, security: { insecureRemoteIframeEmbed: true } };

  expect(uraedaPreview(config, {})).toBe(config);
  expect(config.security).toEqual({ insecureRemoteIframeEmbed: true });
});

test("a project's security preset function is given Storybook's options", async () => {
  const options = { configType: "DEVELOPMENT" };
  const wrapped = uraedaPreview(
    { ...vite, security: (_value?: object, given?: unknown) => ({ given }) },
    { URAEDA_PREVIEW_BASE: BASE },
  );

  expect(await wrapped.security(undefined, options)).toEqual({
    given: options,
    insecureIframeMessaging: true,
  });
});

test.each(["previewHead", "managerHead"] as const)(
  "a %s preset returning undefined adds nothing to the head",
  async (name) => {
    const wrapped = uraedaPreview(
      { ...vite, [name]: () => undefined },
      { URAEDA_PREVIEW_BASE: BASE },
    );
    const head = await wrapped[name]!("<meta>", {});

    expect(head).not.toContain("undefined");
    expect(head).not.toContain("<meta>");
    expect(head).toMatch(/^<script>.*<\/script>$/s);
  },
);
