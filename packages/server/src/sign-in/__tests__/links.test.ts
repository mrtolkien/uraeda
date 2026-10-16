// One-time links' pages: what the browser opens, so a link never shows on a command line.
import { existsSync, readFileSync, statSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { expect, test } from "vite-plus/test";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { browserAddress, linkPages, OneTimeLinks } from "../links.ts";

const ORIGIN = "http://127.0.0.1:4310";
const MINUTE = 60 * 1000;

/** One-time links writing their pages in a new data folder, on a clock the test moves. */
function links() {
  const folder = linkPages(temporaryFolder("uraeda-data"), 4310);
  const clock = { now: Date.parse("2026-10-01T10:00:00Z") };
  return { clock, folder, links: new OneTimeLinks(() => clock.now, folder) };
}

/** The token of a link, `/session/<token>?to=…`. */
const tokenOf = (link: string) => /^\/session\/([\w-]+)\?/.exec(link)![1]!;

/** US4.1 */
test("a link's page is the owner's alone, leads to the link, and its address has no token", () => {
  const { folder, links: made } = links();
  const link = made.make("/r/todo/");

  const address = browserAddress(folder, ORIGIN, link);

  expect(address).toMatch(/^file:\/\//);
  expect(address).not.toContain(tokenOf(link));
  const page = fileURLToPath(address);
  expect(statSync(page).mode & 0o777).toBe(0o600);
  expect(statSync(folder).mode & 0o777).toBe(0o700);
  expect(statSync(join(folder, "..")).mode & 0o777).toBe(0o700);
  const html = readFileSync(page, "utf8");
  expect(html).toContain(`<meta http-equiv="refresh" content="0;url=${ORIGIN}${link}">`);
  expect(html).toContain(`<a href="${ORIGIN}${link}">`);
});

test("a page that is not a one-time link's is opened as it is, with no page", () => {
  const { folder } = links();

  expect(browserAddress(folder, ORIGIN, "/r/todo/")).toBe(`${ORIGIN}/r/todo/`);
  expect(existsSync(folder)).toBe(false);
});

test("a link's page is removed once the link is used", () => {
  const { folder, links: made } = links();
  const link = made.make("/r/todo/");
  const page = fileURLToPath(browserAddress(folder, ORIGIN, link));

  made.use(tokenOf(link));

  expect(existsSync(page)).toBe(false);
});

test("a link's page is removed once the link expires", () => {
  const { clock, folder, links: made } = links();
  const link = made.make("/r/todo/");
  const page = fileURLToPath(browserAddress(folder, ORIGIN, link));

  clock.now += 5 * MINUTE;
  made.sweep();
  expect(existsSync(page)).toBe(true);
  clock.now += 1000;
  made.sweep();

  expect(existsSync(page)).toBe(false);
});

test("every page is removed as the server stops", () => {
  const { folder, links: made } = links();
  const pages = ["/r/todo/", "/r/notes/"].map((to) =>
    fileURLToPath(browserAddress(folder, ORIGIN, made.make(to))),
  );

  made.close();

  expect(pages.map((page) => existsSync(page))).toEqual([false, false]);
});
