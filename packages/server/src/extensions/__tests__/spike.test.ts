// The two points the extensions system relies on, checked through the real libraries: fate reads a
// record kind whose records are added after its server is made, and StyleX compiled at run time
// gives an extension's styles Astryx's own classes.
import { transformSync } from "@babel/core";
import { createFateServer, dataView, list } from "@nkzw/fate/server";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { liveBus } from "../../fate.ts";
import { createSources, fileSource } from "../../fate/source.ts";

type ExtensionRecord = { data: unknown; id: string };

const extensionDataView = dataView<ExtensionRecord>("ExtensionRecord")({ data: true, id: true });

/** A fate server whose only record kind reads `records`, a map still empty when it is made. */
function extensionFate(records: Map<string, unknown>) {
  const live = liveBus();
  const read = async (_ctx: object, ids: Array<string>) =>
    ids.flatMap((id) => (records.has(id) ? [{ data: records.get(id), id }] : []));
  const sources = createSources<object>([fileSource(extensionDataView, { byIds: read })]);
  const server = createFateServer({
    context: () => ({}),
    live,
    mutations: {},
    roots: { extensionRecords: list(extensionDataView) },
    sources,
  });
  return { live, server };
}

const post = (path: string, body: unknown) =>
  new Request(`http://127.0.0.1${path}`, {
    body: JSON.stringify(body),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

/** Waits until the text the stream sent contains `text`, and gives it. */
async function readUntil(reader: ReadableStreamDefaultReader<Uint8Array>, text: string) {
  const decoder = new TextDecoder();
  let received = "";
  while (!received.includes(text)) {
    const { done, value } = await reader.read();
    if (done) {
      throw new Error(`The stream ended before "${text}": ${received}`);
    }
    received += decoder.decode(value, { stream: true });
  }
  return received;
}

test("a record kind registered after the fate server is made is read and updated live", async () => {
  const records = new Map<string, unknown>();
  const { live, server } = extensionFate(records);
  records.set("deploy:status", { state: "idle" });

  const response = await server.handleRequest(
    post("/fate", {
      operations: [
        {
          id: "0",
          ids: ["deploy:status"],
          kind: "byId",
          select: ["id", "data"],
          type: "ExtensionRecord",
        },
      ],
      version: 1,
    }),
  );
  const { results } = (await response.json()) as { results: Array<{ data: unknown }> };
  expect(results[0].data).toEqual([{ data: { state: "idle" }, id: "deploy:status" }]);

  const stream = await server.handleLiveRequest(
    new Request("http://127.0.0.1/fate/live?connectionId=c1", {
      headers: { accept: "text/event-stream" },
    }),
  );
  const reader = stream.body!.getReader();
  await readUntil(reader, "connected");
  const subscribed = await server.handleLiveRequest(
    post("/fate/live", {
      connectionId: "c1",
      operations: [
        {
          entityId: "deploy:status",
          id: "s1",
          kind: "subscribe",
          select: ["id", "data"],
          type: "ExtensionRecord",
        },
      ],
      version: 1,
    }),
  );
  const answer = (await subscribed.json()) as { results: Array<{ ok: boolean }> };
  expect(answer.results[0].ok).toBe(true);

  records.set("deploy:status", { state: "deploying" });
  live.update("ExtensionRecord", "deploy:status");
  expect(await readUntil(reader, "deploying")).toContain('"state":"deploying"');
  await reader.cancel();
});

const require = createRequire(import.meta.url);

/** Astryx's token file, as the app resolves `@astryxdesign/core/theme/tokens.stylex`. */
const TOKENS = require.resolve("@astryxdesign/core/theme/tokens.stylex");

/** StyleX's Babel plugin, by its path: its types name Babel 7's, which Babel 8 does not export. */
const STYLEX = require.resolve("@stylexjs/babel-plugin");

const PAGE = `import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";

const styles = stylex.create({ row: { paddingBlock: spacingVars["--spacing-3"] } });

export function Row() {
  return <div {...stylex.props(styles.row)} />;
}
`;

test("StyleX compiled at run time gives Astryx's own class to the same style", () => {
  // A page in a folder outside the checkout, as an extension's is.
  const file = join(mkdtempSync(join(tmpdir(), "uraeda-extension-")), "Row.tsx");
  writeFileSync(file, PAGE);

  const result = transformSync(PAGE, {
    babelrc: false,
    configFile: false,
    filename: file,
    parserOpts: { plugins: ["typescript", "jsx"] },
    plugins: [
      [
        STYLEX,
        {
          debug: false,
          dev: false,
          importSources: ["@stylexjs/stylex"],
          runtimeInjection: false,
          unstable_moduleResolution: {
            filePathResolver: (path: string) =>
              path === "@astryxdesign/core/theme/tokens.stylex" ? TOKENS : null,
            getCanonicalFilePath: (path: string) => path,
            type: "custom",
          },
        },
      ],
    ],
  });

  // StyleX turns the spread of `stylex.props` into a static `className`.
  const name = /className="([^"]+)"/.exec(result!.code!)?.[1];
  expect(name).toBeDefined();
  const astryxCss = readFileSync(require.resolve("@astryxdesign/core/astryx.css"), "utf8");
  expect(astryxCss).toContain(`.${name}:not(#\\#):not(#\\#){padding-block:var(--spacing-3)}`);
});
