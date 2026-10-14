import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { createApp } from "../app.ts";
import { fixtureRepo, git, port, testApp, testHosts } from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

test("serves a mockup sandboxed, with its type", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/mockups"));
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/mockups/ui.html"), "<p>UI</p>");

  const { app, name } = await testApp(repo);

  const response = await app.request(
    `http://127.0.0.1:${port}/r/${name}/mockups/specs/2026-10-11-web-ui/mockups/ui.html`,
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toBe("<p>UI</p>");
});

test("serves a file's raw text, and nothing outside the repository", async () => {
  const { app, name } = await testApp();

  const draft = await app.request(
    `http://127.0.0.1:${port}/r/${name}/raw/specs/drafts/git-listener.md`,
  );
  const outside = await app.request(
    `http://127.0.0.1:${port}/r/${name}/raw/..%2F..%2Fetc%2Fpasswd`,
  );

  expect(await draft.text()).toContain("# Git listener process");
  expect(draft.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(outside.status).toBe(404);
});

test("a file that cannot be read for another reason than its absence is a server error, logged", async () => {
  const { dataDir, hosts, names, sessions } = await testHosts([fixtureRepo()], {
    installed: false,
  });
  // The core fails for a reason other than a missing file.
  const failing = {
    ...binding,
    readRaw: () => Promise.reject(new Error("refused: disk unreadable")),
  };
  const app = createApp({
    allowedHosts: [],
    allowOrigins: [],
    binding: failing,
    dataDir,
    hosts,
    port,
    sessions,
  });
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const raw = await app.request(`http://127.0.0.1:${port}/r/${names[0]}/raw/specs/README.md`);
  const mockup = await app.request(
    `http://127.0.0.1:${port}/r/${names[0]}/mockups/specs/README.md`,
  );

  expect([raw.status, mockup.status]).toEqual([500, 500]);
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
