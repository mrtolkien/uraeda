import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadBinding } from "./binding.ts";
import { loadDataDir, loadEnv } from "./env.ts";
import { startLive, startSessions } from "./live.ts";
import { parseOptions } from "./options.ts";
import { ClaudeAdapter, PLUGIN_DIR } from "./runner/claude.ts";

async function main(argv: Array<string>) {
  const options = parseOptions(argv, loadEnv(process.cwd()));
  const binding = await loadBinding();
  // The core says when the folder is not a repository; a repository without specs/ is shown.
  await binding.readWorkspace(options.repo).catch((error: Error) => {
    if (error.message.includes("not in a git repository")) {
      throw new Error(`${options.repo} is not a git repository`);
    }
  });
  const { sessions, stop } = await startSessions({
    adapter: new ClaudeAdapter({ pluginDir: PLUGIN_DIR }),
    binding,
    dataDir: loadDataDir(process.cwd()),
  });
  // The sessions end with the server: their turns are interrupted, their processes closed, then
  // the server exits.
  for (const signal of ["SIGINT", "SIGTERM"] as const) {
    process.once(signal, () => {
      void stop().finally(() => process.exit(0));
    });
  }
  const app = createApp({ ...options, binding, sessions });
  try {
    startLive(binding, options.repo);
  } catch (error) {
    console.error(`uraeda-server: ${(error as Error).message}; pages refresh when shown again`);
  }
  serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port }, () => {
    console.log(`Uraeda server on http://127.0.0.1:${options.port}`);
  });
}

main(process.argv.slice(2)).catch((error: Error) => {
  process.stderr.write(`uraeda-server: ${error.message}\n`);
  process.exit(1);
});
