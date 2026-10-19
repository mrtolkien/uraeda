import { execFile } from "node:child_process";

/** Runs git in `cwd`, giving its output, or an error that says what git printed. */
export function git(cwd: string, args: Array<string>, input?: string): Promise<string> {
  return new Promise((resolve, reject) => {
    const child = execFile(
      "git",
      args,
      { cwd, encoding: "utf8", maxBuffer: 256 * 1024 * 1024 },
      (error, stdout, stderr) => {
        if (error) {
          reject(new Error(`git ${args.join(" ")}: ${stderr.trim() || error.message}`));
        } else {
          resolve(stdout);
        }
      },
    );
    if (input !== undefined) {
      child.stdin?.end(input);
    }
  });
}
