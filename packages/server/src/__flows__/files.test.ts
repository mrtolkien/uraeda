// A repository's files over HTTP: a mockup is a page run apart from Uraeda's origin, and a link to
// a file reads that repository's files and nothing outside it.
import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { git, fixtureRepo, port, testApp } from "../__tests__/helpers.ts";

const FEATURE = "2026-10-11-web-ui";

/** An app on a repository whose feature branch, checked out, holds a mockup and a page beside it. */
async function withMockup() {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", FEATURE);
  mkdirSync(join(repo, "specs", FEATURE, "mockups", "assets"), { recursive: true });
  writeFileSync(join(repo, "specs", FEATURE, "mockups", "ui.html"), "<p>UI</p>");
  writeFileSync(join(repo, "specs", FEATURE, "mockups", "assets", "ui.css"), "p {}");
  writeFileSync(join(repo, "specs", FEATURE, "page.html"), "<p>Page</p>");
  const served = await testApp(repo);
  const get = (path: string, headers: Record<string, string> = {}) =>
    served.app.request(`http://127.0.0.1:${port}/r/${served.name}${path}`, { headers });
  return { ...served, get, secret: served.frames.current() };
}

test("a mockup is served under the secret, sandboxed from Uraeda's origin, and sends no referrer", async () => {
  const { get, secret } = await withMockup();

  const page = await get(`/mockups/${secret}/specs/${FEATURE}/mockups/ui.html`);
  const style = await get(`/mockups/${secret}/specs/${FEATURE}/mockups/assets/ui.css`);

  expect(page.status).toBe(200);
  expect(await page.text()).toBe("<p>UI</p>");
  expect(page.headers.get("content-type")).toMatch(/text\/html/);
  const policy = page.headers.get("content-security-policy") ?? "";
  expect(policy).toMatch(/\bsandbox\b/);
  expect(policy).not.toMatch(/allow-same-origin/);
  expect(page.headers.get("referrer-policy")).toBe("no-referrer");
  expect(style.headers.get("content-type")).toMatch(/text\/css/);
});

test("the mockup route serves no file that is not in a mockups folder, nor outside the repository", async () => {
  const { get, secret } = await withMockup();

  for (const path of [
    "specs/PRIORITIES.md",
    `specs/${FEATURE}/page.html`,
    `specs/${FEATURE}/mockups`,
    `specs/${FEATURE}/mockups/..%2F..%2FPRIORITIES.md`,
    `specs%2F${FEATURE}%2Fmockups%2F..%2F..%2FPRIORITIES.md`,
    "mockups/..%2Fspecs%2FPRIORITIES.md",
    `specs/${FEATURE}/mockups/%2e%2e/page.html`,
  ]) {
    expect((await get(`/mockups/${secret}/${path}`)).status, path).toBe(404);
  }
});

test("a mockup's address without the secret leads, for a signed-in page, to the address with it", async () => {
  const { get, secret } = await withMockup();

  const moved = await get(`/mockups/specs/${FEATURE}/mockups/ui.html`);

  expect(moved.status).toBe(303);
  expect(moved.headers.get("location")).toContain(`/mockups/${secret}/`);
  expect((await get("/mockups/specs/PRIORITIES.md")).headers.get("location")).toContain(secret);
});

test("a link to a file reads that repository's file, and nothing outside it", async () => {
  const { get } = await withMockup();

  const file = await get("/raw/specs/PRIORITIES.md");

  expect(file.status).toBe(200);
  expect(file.headers.get("content-type")).toMatch(/^text\/plain/);
  for (const path of [
    "/raw/../../etc/passwd",
    "/raw/%2e%2e/%2e%2e/etc/passwd",
    "/raw/.git/config",
  ]) {
    expect((await get(path)).status, path).toBe(404);
  }
});

test("an old link without a repository's name goes to the most recent repository", async () => {
  const { app, name } = await withMockup();

  const moved = await app.request(`http://127.0.0.1:${port}/raw/specs/PRIORITIES.md`);

  expect(moved.status).toBe(307);
  expect(moved.headers.get("location")).toBe(`/r/${name}/raw/specs/PRIORITIES.md`);
});
