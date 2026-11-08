/**
 * The smoke test's check of extensions in the package: a config folder holding the documentation's
 * example, `examples/extensions/wiki/`, and the reading of its page from the started server, signed
 * in with the access key the start printed. The packaged server compiles the page with the Babel
 * plugins bundled into it, against its own copy of Astryx's StyleX tokens, and must give the CSS
 * the checkout's page compiler gives: the same classes as the app's.
 */
import { cpSync, mkdirSync, readFileSync } from "node:fs";
import { request } from "node:http";
import { join, resolve } from "node:path";
import { compilePage } from "../../server/src/extensions/page-compiler.ts";
import { layout } from "../../server/src/paths.ts";

/** The documentation's example extension, in the checkout. */
const EXAMPLE = resolve(import.meta.dirname, "../../../examples/extensions/wiki");

/** An answer of the server: its status, its `Set-Cookie` headers, and its body. */
type Answer = { body: string; cookies: Array<string>; status: number | null };

/** Sends `method path` to 127.0.0.1:`port`, with the headers and the body given. */
function send(
  port: number,
  method: string,
  path: string,
  { body, headers = {} }: { body?: string; headers?: Record<string, string> } = {},
): Promise<Answer> {
  return new Promise((done) => {
    const sent = request({ headers, host: "127.0.0.1", method, path, port }, (response) => {
      let text = "";
      response.on("data", (chunk: Buffer) => (text += chunk));
      response.on("end", () =>
        done({
          body: text,
          cookies: response.headers["set-cookie"] ?? [],
          status: response.statusCode ?? null,
        }),
      );
    });
    sent.once("error", (error) => done({ body: error.message, cookies: [], status: null }));
    sent.end(body);
  });
}

/**
 * A new config folder, `<folder>/config-extension`, holding the example as `extensions/wiki`, and
 * a new data folder beside it, so the start makes and prints an access key: their variables.
 */
export function extensionFolders(folder: string): Record<string, string> {
  const config = join(folder, "config-extension");
  mkdirSync(join(config, "extensions"), { recursive: true });
  cpSync(EXAMPLE, join(config, "extensions", "wiki"), { recursive: true });
  return { URAEDA_CONFIG_DIR: config, URAEDA_DATA_DIR: join(folder, "data-extension") };
}

/**
 * Why the server on `port`, which printed `stdout`, does not serve the example's page as the
 * checkout compiles it; null when it does.
 */
export async function pageProblem(port: number, stdout: string): Promise<string | null> {
  const key = /Access key, shown once: (\S+)/.exec(stdout)?.[1];
  if (key === undefined) {
    return `no access key on stdout: ${stdout.trim()}`;
  }
  const signedIn = await send(port, "POST", "/session", {
    body: JSON.stringify({ key }),
    headers: { "content-type": "application/json" },
  });
  const cookie = signedIn.cookies[0]?.split(";")[0];
  if (signedIn.status !== 204 || cookie === undefined) {
    return `signing in answered ${signedIn.status}: ${signedIn.body}`;
  }
  const page = await send(port, "GET", "/extensions/wiki/page", { headers: { cookie } });
  if (page.status !== 200) {
    return `/extensions/wiki/page answered ${page.status}: ${page.body}`;
  }
  const { css } = JSON.parse(page.body) as { css: string };
  const entry = join(EXAMPLE, "page.tsx");
  const expected = compilePage(readFileSync(entry, "utf8"), entry, layout(false).stylexTokens);
  if ("error" in expected) {
    return `the checkout does not compile the example's page: ${expected.error.message}`;
  }
  return css !== "" && css === expected.css
    ? null
    : `the package's CSS differs from the checkout's:\n${css}\n---\n${expected.css}`;
}
