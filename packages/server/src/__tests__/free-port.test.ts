// A free port for a preview or a test's server, below the ports the system hands out by itself.
import { readFileSync } from "node:fs";
import { createServer } from "node:net";
import { expect, onTestFinished, test } from "vite-plus/test";
import { freePort, portFree } from "../free-port.ts";

/** The first port Linux hands out by itself, or macOS's. */
function systemStart(): number {
  try {
    return Number(readFileSync("/proc/sys/net/ipv4/ip_local_port_range", "utf8").split(/\s+/)[0]);
  } catch {
    return 49_152;
  }
}

/** Holds `port` of 127.0.0.1 until the test ends. */
async function hold(port: number) {
  const server = createServer();
  await new Promise<void>((resolve) => server.listen(port, "127.0.0.1", resolve));
  onTestFinished(() => new Promise<void>((resolve) => server.close(() => resolve())));
}

test("a free port is below the ports the system hands out, and free", async () => {
  const port = await freePort();

  expect(port).toBeGreaterThanOrEqual(20_000);
  expect(port).toBeLessThan(systemStart());
  expect(await portFree(port)).toBe(true);
});

test("a port another program holds is skipped", async () => {
  const held = await freePort();
  await hold(held);
  const span = systemStart() - 20_000;
  // The first try lands on the held port, the next anywhere.
  const picks = [(held - 20_000 + 0.5) / span, 0.5];

  const port = await freePort(() => picks.shift() ?? Math.random());

  expect(port).not.toBe(held);
  expect(await portFree(held)).toBe(false);
});
