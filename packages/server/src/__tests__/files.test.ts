import { mkdirSync, mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import { fixtureRepo, git, port, testApp } from "./helpers.ts";

test("serves a mockup sandboxed, with its type", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/mockups"));
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/mockups/ui.html"), "<p>UI</p>");

  const response = await testApp(repo).request(
    `http://127.0.0.1:${port}/mockups/specs/2026-10-11-web-ui/mockups/ui.html`,
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toBe("<p>UI</p>");
});

test("serves a file's raw text, and nothing outside the repository", async () => {
  const app = testApp();

  const draft = await app.request(`http://127.0.0.1:${port}/raw/specs/drafts/git-listener.md`);
  const outside = await app.request(`http://127.0.0.1:${port}/raw/..%2F..%2Fetc%2Fpasswd`);

  expect(await draft.text()).toContain("# Git listener process");
  expect(draft.headers.get("content-type")).toBe("text/plain; charset=utf-8");
  expect(outside.status).toBe(404);
});

test("a file that cannot be read for another reason than its absence is a server error, logged", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const app = testApp(mkdtempSync(join(tmpdir(), "uraeda-not-a-repo-")));

  const raw = await app.request(`http://127.0.0.1:${port}/raw/README.md`);
  const mockup = await app.request(`http://127.0.0.1:${port}/mockups/ui.html`);

  expect([raw.status, mockup.status]).toEqual([500, 500]);
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});
