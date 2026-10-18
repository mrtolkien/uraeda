// What the preview runner shares with its processes: a free-port check, the process groups it
// started, and a stream's last lines of output.
import { createServer } from "node:net";
import { stripVTControlCharacters } from "node:util";

/** How many lines of a Storybook's output are kept. */
const LINES_KEPT = 50;

/** Whether another program holds `port` of 127.0.0.1 now. */
export function portTaken(port: number): Promise<boolean> {
  return new Promise((resolve) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) => resolve(error.code === "EADDRINUSE"));
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(false)));
  });
}

/** Where a runner records its process groups: `GroupRecord`, in the data folder. */
export type GroupRecorder = { add(pid: number): void; remove(pid: number): void };

/**
 * The process groups every runner started, killed as the server exits, even on a crash; a server
 * killed past its exit hook leaves them to the next start, through the runner's record.
 */
export const groups = new Set<number>();
let ending = false;

export function endWithServer() {
  if (!ending) {
    ending = true;
    process.once("exit", () => {
      for (const pid of groups) {
        signalGroup(pid, "SIGKILL");
      }
    });
  }
}

export function signalGroup(pid: number, signal: NodeJS.Signals) {
  try {
    process.kill(-pid, signal);
  } catch {
    // The group is gone.
  }
}

/** Keeps a stream's lines, without colour codes, in `lines`, the last `LINES_KEPT` only. */
export function keepLines(stream: NodeJS.ReadableStream | null, lines: Array<string>) {
  let partial = "";
  const keep = (line: string) => {
    const text = stripVTControlCharacters(line).trim();
    if (text !== "") {
      lines.push(text);
      lines.splice(0, Math.max(0, lines.length - LINES_KEPT));
    }
  };
  stream?.setEncoding("utf8");
  stream?.on("data", (chunk: string) => {
    const parts = (partial + chunk).split(/\r?\n|\r/);
    partial = parts.pop() ?? "";
    parts.forEach(keep);
  });
  stream?.on("end", () => keep(partial));
}
