import { statSync } from "node:fs";
import { serve } from "@hono/node-server";
import { createApp } from "./app.ts";
import { loadBinding } from "./binding.ts";
import { parseOptions } from "./options.ts";

async function main(argv: Array<string>) {
  const options = parseOptions(argv);
  if (!statSync(options.specs, { throwIfNoEntry: false })?.isDirectory()) {
    throw new Error(`${options.specs}: no such folder`);
  }
  const { temporaryReadSpecs } = await loadBinding();
  const app = createApp({ ...options, readSpecs: temporaryReadSpecs });
  serve({ fetch: app.fetch, hostname: "127.0.0.1", port: options.port }, () => {
    console.log(`Uraeda server on http://127.0.0.1:${options.port}`);
  });
}

main(process.argv.slice(2)).catch((error: Error) => {
  process.stderr.write(`uraeda-server: ${error.message}\n`);
  process.exit(1);
});
