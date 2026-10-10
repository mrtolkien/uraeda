import { parseArgs } from "node:util";

export type Options = {
  /** The `specs/` folder to read. */
  specs: string;
  port: number;
  /** Origins allowed besides the server's own, like the UI's dev server. */
  allowOrigins: Array<string>;
  /** The built UI, served as static files when set. */
  webRoot?: string;
};

export function parseOptions(argv: Array<string>): Options {
  const { values } = parseArgs({
    args: argv,
    options: {
      specs: { type: "string", default: "specs" },
      port: { type: "string", default: "4310" },
      "allow-origin": { type: "string", multiple: true, default: [] },
      "web-root": { type: "string" },
    },
  });
  return {
    specs: values.specs,
    port: Number(values.port),
    allowOrigins: values["allow-origin"],
    webRoot: values["web-root"],
  };
}
