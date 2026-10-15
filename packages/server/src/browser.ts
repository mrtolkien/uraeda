import { spawn as spawnProcess } from "node:child_process";

type Spawn = (
  command: string,
  args: Array<string>,
) => { on(event: "error", listener: (error: Error) => void): void; unref(): void };

const OPENERS: Partial<Record<NodeJS.Platform, string>> = { darwin: "open", linux: "xdg-open" };

const detached: Spawn = (command, args) =>
  spawnProcess(command, args, { detached: true, stdio: "ignore" });

const toStderr = (line: string) => {
  process.stderr.write(line);
};

/** Whether a desktop can show a browser: not over SSH, and on Linux only with a display. */
function hasDesktop(env: NodeJS.ProcessEnv, platform: NodeJS.Platform): boolean {
  if (env.SSH_CONNECTION || env.SSH_TTY) {
    return false;
  }
  return platform !== "linux" || Boolean(env.DISPLAY || env.WAYLAND_DISPLAY);
}

/** Opens `url` in the user's browser, without waiting; returns what it did. */
export function openBrowser(
  url: string,
  {
    env = process.env,
    platform = process.platform,
    spawn = detached,
    warn = toStderr,
  }: {
    env?: NodeJS.ProcessEnv;
    platform?: NodeJS.Platform;
    spawn?: Spawn;
    warn?: (line: string) => void;
  } = {},
): "opened" | "skipped" {
  const opener = OPENERS[platform];
  if (!opener || !hasDesktop(env, platform)) {
    return "skipped";
  }
  const child = spawn(opener, [url]);
  child.on("error", (error) => warn(`uraeda: could not open a browser: ${error.message}\n`));
  child.unref();
  return "opened";
}
