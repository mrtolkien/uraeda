import { mkdirSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { attachImage } from "uraeda-binding";
import { expect, test, vi } from "vite-plus/test";
import { createApp } from "../app.ts";
import { FrameSecret } from "../sign-in/frames.ts";
import {
  appSettings,
  fixture,
  fixtureRepo,
  git,
  port,
  testApp,
  testHosts,
  testPreviews,
} from "./helpers.ts";

/** The core's binding, as one object: the server takes it whole. */
const binding = await import("uraeda-binding");

test("serves a mockup sandboxed, with its type", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/mockups"));
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/mockups/ui.html"), "<p>UI</p>");

  const { app, frames, name } = await testApp(repo);

  const response = await app.request(
    `http://127.0.0.1:${port}/r/${name}/mockups/${frames.current()}/specs/2026-10-11-web-ui/mockups/ui.html`,
  );

  expect(response.status).toBe(200);
  expect(response.headers.get("content-security-policy")).toBe("sandbox allow-scripts");
  expect(response.headers.get("referrer-policy")).toBe("no-referrer");
  expect(response.headers.get("content-type")).toBe("text/html; charset=utf-8");
  expect(await response.text()).toBe("<p>UI</p>");
});

test("the mockup route serves only files in a mockups folder", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/mockups/assets"), { recursive: true });
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/mockups/ui.html"), "<p>UI</p>");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/mockups/assets/ui.css"), "p {}");
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/page.html"), "<p>Page</p>");
  const { app, frames, name } = await testApp(repo);
  const status = async (path: string) =>
    (await app.request(`http://127.0.0.1:${port}/r/${name}/mockups/${frames.current()}/${path}`))
      .status;

  for (const path of [
    "specs/PRIORITIES.md",
    "specs/2026-10-11-web-ui/page.html",
    "specs/2026-10-11-web-ui/mockups",
    "specs/2026-10-11-web-ui/mockups/..%2F..%2FPRIORITIES.md",
    "specs%2F2026-10-11-web-ui%2Fmockups%2F..%2F..%2FPRIORITIES.md",
    "mockups/..%2Fspecs%2FPRIORITIES.md",
  ]) {
    expect(await status(path), path).toBe(404);
  }
  expect(await status("specs/2026-10-11-web-ui/mockups/ui.html")).toBe(200);
  expect(await status("specs/2026-10-11-web-ui/mockups/assets/ui.css")).toBe(200);
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
  const frames = new FrameSecret();
  const app = createApp({
    allowOrigins: [],
    binding: failing,
    dataDir,
    frames,
    hosts,
    port,
    previews: testPreviews(),
    sessions,
    settings: (await appSettings()).settings,
  });
  const log = vi.spyOn(process.stderr, "write").mockImplementation(() => true);

  const raw = await app.request(`http://127.0.0.1:${port}/r/${names[0]}/raw/specs/README.md`);
  const mockup = await app.request(
    `http://127.0.0.1:${port}/r/${names[0]}/mockups/${frames.current()}/specs/x/mockups/ui.html`,
  );

  expect([raw.status, mockup.status]).toEqual([500, 500]);
  expect(log).toHaveBeenCalledTimes(2);
  log.mockRestore();
});

test("serves an image with its type, nosniff, and default-src 'none'", async () => {
  const repo = fixtureRepo();
  const { path } = await attachImage(
    repo,
    "specs/2026-10-12-cli-tuis/proposal.md",
    readFileSync(fixture("images/desktop.png")),
    "desktop.png",
  );

  const { app, name } = await testApp(repo);
  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/images/${path}`);

  expect(response.status).toBe(200);
  expect(response.headers.get("content-type")).toBe("image/webp");
  expect(response.headers.get("x-content-type-options")).toBe("nosniff");
  expect(response.headers.get("content-security-policy")).toBe("default-src 'none'");
  expect(response.headers.get("cross-origin-resource-policy")).toBe("same-origin");
  // A path may get another image later: never cached.
  expect(response.headers.get("cache-control")).toBeNull();
  expect(
    Buffer.from(await response.arrayBuffer())
      .subarray(8, 12)
      .toString("latin1"),
  ).toBe("WEBP");
});

test("does not serve a markdown file or a path outside specs as an image", async () => {
  const repo = fixtureRepo();
  // HTML named as a PNG, in a feature's images: refused by its first bytes.
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  mkdirSync(join(repo, "specs/2026-10-11-web-ui/images"));
  writeFileSync(join(repo, "specs/2026-10-11-web-ui/images/page.png"), "<html><script></script>");
  const { app, name } = await testApp(repo);

  for (const path of [
    "specs/drafts/git-listener.md",
    "specs/2026-10-11-web-ui/images/page.png",
    "..%2F..%2Fetc%2Fpasswd",
    "specs/..%2F..%2Fetc%2Fpasswd",
    "fixtures/images/desktop.png",
  ]) {
    const response = await app.request(`http://127.0.0.1:${port}/r/${name}/images/${path}`);
    expect(response.status, path).toBe(404);
  }
});
