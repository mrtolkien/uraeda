// `vp run sandbox`'s Vite config: the web app as `vp dev` serves it, with each element's source
// location, the skill's pick script and the sandbox's bar on its page, and the server on the fake
// agent, over the sample projects of `.sandbox/`, in a locked list, without sign-in. The command,
// `sandbox/main.ts`, sets the environment it reads; nothing else loads this config, so no build has
// any of it.
import { readFileSync } from "node:fs";
import { sep } from "node:path";
import { fileURLToPath } from "node:url";
import { layout } from "uraeda-server/paths";
import { defineConfig, type Plugin, type UserConfig } from "vite-plus";
import { atWork, sandboxAgent } from "./sandbox/agent.ts";
import { sourceLocations } from "./sandbox/sourceLocations.ts";
import { themeWatcher, uraedaServer } from "./vite.config.ts";
import { uiTransforms } from "./vite.transforms.ts";

/** The port the sandbox asks for first, away from `vp dev`'s 4310 and the screenshots' 4390. */
export const SANDBOX_PORT = 4410;

/** The web package, Vite's root. */
const web = import.meta.dirname;

/** The skill's pick script, served as it is: Storybooks load the same file. */
const PICK_SCRIPT = fileURLToPath(
  new URL("../../skills/uraeda/assets/storybook/uraeda-pick.js", import.meta.url),
);

/** Where the page loads the pick script from: a path of the sandbox's own, not a file of the app. */
const PICK_PATH = "/@uraeda-sandbox/uraeda-pick.js";

/** The variables naming the folders the sandbox reads and writes, all inside a `.sandbox/`. */
const FOLDERS = ["URAEDA_REPO", "URAEDA_DATA_DIR", "URAEDA_CONFIG_DIR"] as const;

/**
 * Refuses to serve unless the environment names folders inside a `.sandbox/`, as the command sets
 * it: this config run any other way would open the human's own data and config folders.
 */
function checkEnvironment() {
  for (const name of FOLDERS) {
    const value = process.env[name];
    if (!value || !value.split(sep).includes(".sandbox")) {
      throw new Error(
        `The sandbox runs from \`vp run sandbox\`: ${name} is not in a .sandbox folder.`,
      );
    }
  }
}

/**
 * The sandbox's page: the pick script, as a classic script at the top of the page, which makes it
 * its own parent, and the bar's entry, beside the app's. Once Vite listens, it prints the address,
 * and asks the server for a first page, which starts it: the turn at work starts then, not when
 * the human first opens the page.
 */
function sandboxPage(): Plugin {
  return {
    apply: "serve",
    configureServer(server) {
      checkEnvironment();
      server.middlewares.use(PICK_PATH, (_request, response) => {
        response.setHeader("content-type", "text/javascript; charset=utf-8");
        // Read at each request: an edit to the script reaches the next page loaded.
        response.end(readFileSync(PICK_SCRIPT, "utf8"));
      });
      server.httpServer?.once("listening", () => {
        const address = server.httpServer?.address();
        if (typeof address !== "object" || address === null) {
          return;
        }
        const url = `http://127.0.0.1:${address.port}/`;
        server.config.logger.info(`Sandbox: ${url}`);
        void fetch(new URL("fate", url)).then(
          (response) => response.body?.cancel(),
          (error: Error) => server.config.logger.error(`Sandbox not started: ${error.message}`),
        );
      });
    },
    name: "uraeda-sandbox-page",
    transformIndexHtml: () => [
      { attrs: { src: PICK_PATH }, injectTo: "head", tag: "script" },
      { attrs: { src: "/src/sandbox/main.tsx", type: "module" }, injectTo: "body", tag: "script" },
    ],
  };
}

/**
 * The sandbox's config, its server reading `.env` nowhere, `checkout`'s included, on `port` or the
 * next one free. Once the server has started, the implementation feature's session is at work, as
 * at each start.
 */
export function sandboxConfig({
  checkout = layout().checkout,
  port = SANDBOX_PORT,
}: { checkout?: string | null; port?: number } = {}): UserConfig {
  const adapter = sandboxAgent();
  return {
    // Source locations first: the UI's transforms add lines that would move them (R7).
    plugins: [
      sourceLocations(),
      ...uiTransforms(),
      sandboxPage(),
      uraedaServer(
        {
          adapter,
          file: false,
          lockedList: true,
          signIn: false,
          started: (server) => {
            const repo = process.env.URAEDA_REPO ?? "";
            atWork(server.sessions, repo).catch((error: Error) =>
              process.stderr.write(
                `uraeda: the turn at work did not start in ${repo}: ${error.message}\n`,
              ),
            );
          },
        },
        checkout,
      ),
      themeWatcher(),
    ],
    root: web,
    server: { host: "127.0.0.1", port, strictPort: false },
  };
}

export default defineConfig(sandboxConfig());
