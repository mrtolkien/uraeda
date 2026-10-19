import { run } from "./run-command.ts";

/** Runs git in `cwd`, giving its output, or an error that says what git printed. */
export function git(cwd: string, args: Array<string>): Promise<string> {
  return run("git", args, cwd);
}
