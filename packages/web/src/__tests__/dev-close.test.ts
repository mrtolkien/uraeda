// @vitest-environment node
// The server in Vite's own: closing Vite's server stops it, and waits for it.
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { FakeAdapter } from "uraeda-server/testing";
import { createServer } from "vite-plus";
import { expect, test, vi } from "vite-plus/test";
import { uraedaServer } from "../../vite.config.ts";

test("closing Vite's server waits for the server's stop, and the work its start began", async () => {
  vi.stubEnv("URAEDA_REPO", fixtureRepo());
  vi.stubEnv("URAEDA_DATA_DIR", temporaryFolder("uraeda-data"));
  vi.stubEnv("URAEDA_CONFIG_DIR", temporaryFolder("uraeda-config"));
  // The sandbox's turns at work, which read and write the repositories a test's end removes.
  let done = false;
  const server = await createServer({
    configFile: false,
    logLevel: "silent",
    plugins: [
      uraedaServer(
        {
          agents: { fake: new FakeAdapter() },
          file: false,
          signIn: false,
          started: () =>
            new Promise<void>((resolve) =>
              setTimeout(() => {
                done = true;
                resolve();
              }, 300),
            ),
        },
        null,
      ),
    ],
    root: temporaryFolder("uraeda-vite"),
    server: { host: "127.0.0.1", port: 0 },
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  await fetch(`http://127.0.0.1:${port}/fate`, {
    body: JSON.stringify({ operations: [], version: 1 }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });

  await server.close();

  expect(done).toBe(true);
});
