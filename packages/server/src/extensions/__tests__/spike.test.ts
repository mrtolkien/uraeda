// The two points the extensions system relies on, checked through the real libraries: fate reads a
// record kind whose records are added after its server is made, and StyleX compiled at run time
// gives an extension's styles Astryx's own classes, through the page compiler, with React Compiler.
import { createFateServer, dataView, list } from "@nkzw/fate/server";
import { mkdtempSync, readFileSync, writeFileSync } from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { liveBus } from "../../fate.ts";
import { layout } from "../../paths.ts";
import { compilePage } from "../page-compiler.ts";
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

const PAGE = `import * as stylex from "@stylexjs/stylex";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";

const styles = stylex.create({ row: { paddingBlock: spacingVars["--spacing-3"] } });

type RowProps = { label: string };

export function Row({ label }: RowProps) {
  return <div {...stylex.props(styles.row)}>{label}</div>;
}
`;

/** Compiles `source` as a page in a folder outside the checkout, as an extension's is. */
function compiled(source: string) {
  const file = join(mkdtempSync(join(tmpdir(), "uraeda-extension-")), "Row.tsx");
  writeFileSync(file, source);
  return compilePage(source, file, layout().stylexTokens);
}

/** The compiled page, failing the test on a compile error. */
function compiledPage(source: string) {
  const result = compiled(source);
  if ("error" in result) {
    throw new Error(result.error.message);
  }
  return result;
}

test("StyleX compiled at run time gives Astryx's own class to the same style", () => {
  const { code, css } = compiledPage(PAGE);

  // StyleX turns the spread of `stylex.props` into a static `className`.
  const name = /className: "([^"]+)"|className="([^"]+)"/.exec(code)?.slice(1).find(Boolean);
  expect(name).toBeDefined();
  const astryxCss = readFileSync(require.resolve("@astryxdesign/core/astryx.css"), "utf8");
  const rule = `.${name}:not(#\\#):not(#\\#){padding-block:var(--spacing-3)}`;
  expect(astryxCss).toContain(rule);
  expect(css).toContain(rule);
});

test("React Compiler memoizes a page's components, and leaves TSX for the module compiler", () => {
  const { code } = compiledPage(PAGE);

  expect(code).toContain('from "react/compiler-runtime"');
  expect(code).toContain("type RowProps = {");
  expect(code).toContain("<div {...");
});

test("a page that does not parse gives the line and column of its error", () => {
  const result = compiled("export function Row() {\n  const label = ;\n}\n");

  expect(result).toEqual({ error: { column: 17, line: 2, message: "Unexpected token" } });
});
