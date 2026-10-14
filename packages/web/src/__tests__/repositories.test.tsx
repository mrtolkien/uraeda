// US6: every page is in its repository, named in its URL; a URL without one opens the most recently
// opened repository, and an unknown or missing one says so (US5.5).
import { rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { click, fixtureRepo, git, listOf, refreshUntil, renderPage } from "./helpers.tsx";

/** A list of uraeda, opened at 10:59, then todo-app, at 10:58, on two copies of the fixture. */
function twoRepositories() {
  return listOf([
    ["uraeda", fixtureRepo()],
    ["todo-app", fixtureRepo()],
  ]);
}

/** US6.3 */
test("a path without a repository opens it in the most recent", async () => {
  const dataDir = twoRepositories();
  await renderPage("/f/2026-10-11-web-ui?tab=files#top", undefined, { dataDir, raw: true });

  await waitFor(() => expect(window.location.pathname).toBe("/r/uraeda/f/2026-10-11-web-ui"));
  expect(window.location.search + window.location.hash).toBe("?tab=files#top");
  expect(await screen.findByRole("list", { name: "Files" })).toBeTruthy();
});

/** US3.1, US3.2 */
test("the root opens the most recent repository's home", async () => {
  await renderPage("/", undefined, { dataDir: twoRepositories(), raw: true });

  await waitFor(() => expect(window.location.pathname).toBe("/r/uraeda/"));
  expect((await screen.findAllByRole("link", { name: /Git listener process/ })).length).toBe(1);
});

/** US6.4 */
test("an unknown name says so, with a link to the most recent", async () => {
  await renderPage("/r/old-site/", undefined, { dataDir: twoRepositories(), raw: true });

  expect(
    await screen.findByRole("heading", { name: "No repository named “old-site”" }),
  ).toBeTruthy();
  const link = screen.getByRole("link", { name: "Open uraeda" });
  expect(link.getAttribute("href")).toBe("/r/uraeda/");
  await click(link);
  expect(window.location.pathname).toBe("/r/uraeda/");
});

/** US5.5 */
test("a missing folder shows where it was, with Remove", async () => {
  const path = fixtureRepo();
  const dataDir = listOf([["client-site", path]]);
  rmSync(path, { recursive: true, force: true });
  await renderPage("/r/client-site/", undefined, { dataDir, raw: true });

  expect(await screen.findByRole("heading", { name: "Folder not found" })).toBeTruthy();
  expect(screen.getByText(path)).toBeTruthy();
  // Its fate requests are not sent: the page has no navigation.
  expect(screen.queryByRole("navigation", { name: "Features" })).toBeNull();

  await click(screen.getByRole("button", { name: "Remove from Uraeda" }));

  // The last one gone, the first run shows.
  expect(await screen.findByRole("heading", { name: "Add your first repository" })).toBeTruthy();
  expect(window.location.pathname).toBe("/");
  expect(await binding.readRepositories(dataDir)).toEqual([]);
});

/** Review focus 1 */
test("a removed repository's open page says it is unknown", async () => {
  const dataDir = listOf([["uraeda", fixtureRepo()]]);
  await renderPage("/r/uraeda/", undefined, { dataDir, raw: true });
  expect((await screen.findAllByRole("link", { name: /Git listener process/ })).length).toBe(1);

  await binding.removeRepository(dataDir, "uraeda");

  await refreshUntil(() =>
    expect(screen.getByRole("heading", { name: "No repository named “uraeda”" })).toBeTruthy(),
  );
  expect(screen.queryByText("Could not reach the Uraeda server.")).toBeNull();
});

/** US3.3: the add form's own tests are in `add-repository.test.tsx` */
test("an empty list shows the first run on every page", async () => {
  await renderPage("/priorities", undefined, { dataDir: listOf([]), raw: true });

  expect(await screen.findByRole("heading", { name: "Add your first repository" })).toBeTruthy();
  expect(screen.queryByRole("navigation")).toBeNull();
});

/** US6.5 */
test("a code link opens the repository's raw file", async () => {
  const repo = fixtureRepo();
  git(repo, "switch", "--quiet", "2026-10-11-web-ui");
  writeFileSync(
    join(repo, "specs/2026-10-11-web-ui/proposal.md"),
    "# Web UI\n\nSee [the server](/packages/server/src/app.ts).\n",
  );
  const { name } = await renderPage("/f/2026-10-11-web-ui/proposal.md", repo);

  const code = await screen.findByRole("link", { name: "the server" });
  expect(code.getAttribute("href")).toBe(`/r/${name}/raw/packages/server/src/app.ts`);
  expect(code.getAttribute("target")).toBe("_blank");
});
