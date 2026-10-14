import { parseArgs } from "node:util";
import { resolve } from "node:path";
import type { Env } from "./env.ts";

/** The server's options; `given` is also true when `--repo` named the repository. */
export type Options = Env & {
  /** Origins allowed besides the server's own and the allowed hosts', like a dev server's. */
  allowOrigins: Array<string>;
  /** The built UI, served as static files when set. */
  webRoot?: string;
};

/** The command line's options, over the settings of `.env`. */
export function parseOptions(argv: Array<string>, env: Env): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      repo: { type: "string" },
      port: { type: "string" },
      "allow-origin": { type: "string", multiple: true, default: [] },
      "web-root": { type: "string" },
    },
  });
  return {
    ...env,
    repo: values.repo ? resolve(values.repo) : env.repo,
    given: Boolean(values.repo) || env.given,
    port: values.port ? Number(values.port) : env.port,
    allowOrigins: values["allow-origin"],
    webRoot: values["web-root"],
  };
}
