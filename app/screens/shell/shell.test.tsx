// The app's shell against the real server: `just app-test` starts a sandbox, and the checks' app,
// `__checks__/Shell.tsx`, draws the shell over it, with a host the test plays (the Linux host's
// own work is `crates/app/tests/host.rs`). The test tells the host what happens on its machine:
// its server starts, stops, or speaks another version of the protocol.
import { type App, expect, open, test } from "nsh/test";

const shell = (scenario: string) =>
  open("./__checks__/Shell.tsx", {
    height: 800,
    host: { handlers: { key: null, revoked: null }, params: { scenario } },
    network: "live",
    width: 1400,
  });

const says = (app: App, words: string) =>
  app.waitUntil(() => app.texts().join(" ").includes(words), { timeout: 20_000 });

const shows = (app: App) => app.texts().join(" ");

// US1, and the edge case "the server stops while the app is open".
test("the app starts a server when none runs", async () => {
  // No server runs: the host starts one, and the app says so while it waits.
  const app = await shell("starts");
  await says(app, "Starting Uraeda's server");
  await app.host.send("started", null);
  // The frame: the rail's places, and the sandbox's repositories.
  await says(app, "Inbox");
  expect(shows(app)).not.toContain("Starting Uraeda's server");

  // The server stops while the app is open: the app says so, and asks the host for one again.
  await app.host.send("stops", null);
  await says(app, "Uraeda's server stopped");
  await says(app, "Starting it again");
  // The frame stays, its records as they were last.
  expect(shows(app)).toContain("Inbox");
  await app.host.send("started", null);
  await app.waitUntil(() => !shows(app).includes("Uraeda's server stopped"), { timeout: 20_000 });
  expect(shows(app)).toContain("live");
});

/** The app opened in `scenario` says to update `side`, and nothing else. */
async function refused(scenario: string, side: string, other: string) {
  const app = await shell(scenario);
  await says(app, side);
  const shown = shows(app);
  expect([scenario, shown.includes(other)]).toEqual([scenario, false]);
  // It does nothing else: no frame, no record read.
  expect([scenario, shown.includes("Inbox")]).toEqual([scenario, false]);
}

// The edge case "a client and a server of different versions meet".
test("a refused version shows which side to update", async () => {
  await refused("app-older", "Update this app", "Update the server");
  await refused("server-older", "Update the server", "Update this app");
});

// The edge cases "a revoked device" and "pairing against a server with sign-in on".
test("a revoked device is sent back to pairing", async () => {
  // Another machine's server, with sign-in on: the device pairs with the access key.
  const app = await shell("revoked");
  await says(app, "Pair this device");
  const key = app.host.posts().find((post) => post.name === "key")?.data as string;
  expect(key.startsWith("ura_")).toBe(true);
  await app.type("label:Pairing code", key);
  await app.press("label:Pair");
  await says(app, "Inbox");

  // The owner revokes it from another device: its line ends, the server refuses its token, and the
  // app pairs again, saying why.
  await app.host.send("revoke", null);
  await app.waitUntil(() => app.host.posts().some((post) => post.name === "revoked"), {
    timeout: 20_000,
  });
  await says(app, "This device was unpaired from the server");
  await says(app, "Pair this device");
  expect(shows(app)).not.toContain("Inbox");
});
