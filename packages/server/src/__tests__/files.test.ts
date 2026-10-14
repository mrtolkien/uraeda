import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { fixtureRepo, git, port, testApp } from "./helpers.ts";

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
  const { app, name, repo } = await testApp();
  // The folder leaves git once listed: the core can no longer read it.
  rmSync(join(repo, ".git"), { recursive: true, force: true });
  const log = vi.spyOn(console, "error").mockImplementation(() => {});

  const raw = await app.request(`http://127.0.0.1:${port}/r/${name}/raw/README.md`);
  const mockup = await app.request(`http://127.0.0.1:${port}/r/${name}/mockups/ui.html`);

  expect([raw.status, mockup.status]).toEqual([500, 500]);
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
