import { parseArgs } from "node:util";
import { resolve } from "node:path";
import { type Env, hostNames } from "./env.ts";

/**
 * The server's options, as given for this run: a flag replaces its variable, and keeps its own
 * name; `given` is also true when `--repo` named the repository.
 */
export type Options = Env & {
  /** Origins allowed besides the server's own and the allowed hosts', like a dev server's. */
  allowOrigins: Array<string>;
  /** Whether the start makes a new access key, signing every device out: `--new-key`. */
  newKey: boolean;
  /** Whether `--no-open` turns off opening a browser for this run. */
  noOpen: boolean;
  /** What to print instead of starting: `--help` or `--version`. */
  show?: "help" | "version";
};

/** `uraeda --help`. `--allow-origin` is left out: it is meant for development servers. */
export const HELP = `Usage: uraeda [options]

Starts Uraeda's web UI for the repository of the current folder.

  --port <port>            the port on 127.0.0.1, 4310 by default (URAEDA_PORT)
  --repo <folder>          the repository to open, the current folder by default (URAEDA_REPO)
  --allowed-hosts <names>  host names accepted besides 127.0.0.1, comma separated (URAEDA_ALLOWED_HOSTS)
  --no-open                do not open the browser
  --new-key                make a new access key and sign every device out
  --version                print the version
  --help                   print this help
`;

/**
 * The command line's options, over the variables of `.env` and the environment: each flag given
 * replaces its variable, with its own name, and `--allowed-hosts` given empty still does. Throws
 * `unknown option --<name>; see uraeda --help` on an unknown option.
 */
export function parseOptions(argv: Array<string>, env: Env): Options {
  const values = parse(argv);
  const show = values.help ? "help" : values.version ? "version" : undefined;
  const hosts = values["allowed-hosts"];
  return {
    ...env,
    ...(hosts !== undefined && {
      allowedHosts: { name: "--allowed-hosts", value: hostNames(hosts) },
    }),
    allowOrigins: values["allow-origin"],
    given: Boolean(values.repo) || env.given,
    newKey: Boolean(values["new-key"]),
    noOpen: Boolean(values["no-open"]),
    ...(values.port !== undefined && { port: { name: "--port", value: values.port } }),
    repo: values.repo ? resolve(values.repo) : env.repo,
    ...(show && { show }),
  };
}

/** `parseArgs` on the command's options, with an unknown option named the spec's way. */
function parse(argv: Array<string>) {
  try {
    return parseArgs({
      args: argv,
      options: {
        "allow-origin": { default: [], multiple: true, type: "string" },
        "allowed-hosts": { type: "string" },
        help: { type: "boolean" },
        "new-key": { type: "boolean" },
        "no-open": { type: "boolean" },
        port: { type: "string" },
        repo: { type: "string" },
        version: { type: "boolean" },
      },
    }).values;
  } catch (error) {
    const unknown = /^Unknown option '-{1,2}([^']+)'/.exec((error as Error).message);
    if ((error as { code?: string }).code === "ERR_PARSE_ARGS_UNKNOWN_OPTION" && unknown) {
      throw new Error(`unknown option --${unknown[1]}; see uraeda --help`, { cause: error });
    }
    throw error;
  }
}
