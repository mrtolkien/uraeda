import { execFile } from "node:child_process";

/** Runs a command, giving its output, or an error with what it printed. */
export function run(command: string, args: Array<string>, cwd?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    execFile(
      command,
      args,
      { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
      (error, stdout, stderr) =>
        error
          ? reject(new Error(`${command} ${args.join(" ")}: ${stderr.trim() || error.message}`))
          : resolve(stdout),
    );
  });
}
