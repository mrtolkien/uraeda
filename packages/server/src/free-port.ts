// A free port for a program started on it: a preview's Storybook, or a test's server.
import { readFileSync } from "node:fs";
import { createServer } from "node:net";

/**
 * The first port the system hands out by itself, to a `listen(0)` or an outgoing connection:
 * Linux's from its settings, 49152 elsewhere, as macOS's and IANA's.
 */
function systemPorts(): number {
  try {
    const [first] = readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8")
      .trim()
      .split(/\s+/);
    return Number(first) || 49_152;
  } catch {
    return 49_152;
  }
}

/** The ports tried, from here to the system's: below, the ones programs ask for by number. */
const LOWEST = 20_000;

/** How many ports are tried before the system picks one. */
const TRIES = 20;

/** Whether nothing holds `port` of 127.0.0.1 now. */
export function portFree(port: number): Promise<boolean> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", (error: NodeJS.ErrnoException) =>
      ["EADDRINUSE", "EACCES"].includes(error.code ?? "") ? resolve(false) : reject(error),
    );
    server.listen(port, "127.0.0.1", () => server.close(() => resolve(true)));
  });
}

/** A port of 127.0.0.1 the system picks: it may hand it out again, to any connection. */
function systemPort(): Promise<number> {
  return new Promise((resolve, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const { port } = server.address() as { port: number };
      server.close(() => resolve(port));
    });
  });
}

/**
 * A free port of 127.0.0.1, for a program that starts on it later. Taken at random below the ports
 * the system hands out by itself: one it picked would be free when found, then handed to another
 * process's connection before the program listens, as happened with several checkouts' tests at
 * once. Only a program asking for the same port by number can take it now.
 */
export async function freePort(random: () => number = Math.random): Promise<number> {
  const span = systemPorts() - LOWEST;
  for (let tries = 0; span > 0 && tries < TRIES; tries++) {
    const port = LOWEST + Math.floor(random() * span);
    if (await portFree(port)) {
      return port;
    }
  }
  return systemPort();
}
