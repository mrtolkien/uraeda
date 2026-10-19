// Flow: a feature whose build is done and whose pull request is open. Its one primary action is the
// pull request, which opens in a new tab and not in the app, from there and from the page's links.
import { chmodSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { screen, waitFor } from "@testing-library/react";
import { refreshPullRequests } from "uraeda-binding";
import { addPlan, ELEVEN, temporaryFolder } from "uraeda-binding/test-utils";
import { afterAll, beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, startApp } from "./harness.tsx";

const CLI = "2026-10-12-cli-tuis";
const URL = "https://github.com/o/r/pull/31";

/** The CLI TUIs' plan, every task done: the pull request is what comes next. */
function repository() {
  const repo = fixtureRepo();
  addPlan(
    repo,
    CLI,
    ELEVEN.map(([title]) => [title, 5, 5]),
  );
  return repo;
}

const app = startApp({ agent: true, repo: repository });

const path = process.env.PATH;

beforeAll(async () => {
  // A `gh` on the PATH that lists the open pull requests, read once into the binding's snapshot.
  const bin = temporaryFolder("uraeda-gh");
  const pulls = [{ headRefName: CLI, isDraft: false, number: 31, reviewDecision: "", url: URL }];
  writeFileSync(join(bin, "gh"), `#!/bin/sh\necho '${JSON.stringify(pulls)}'\n`);
  chmodSync(join(bin, "gh"), 0o755);
  process.env.PATH = `${bin}:${path ?? ""}`;
  await refreshPullRequests(app.repo);
});

afterAll(() => {
  process.env.PATH = path;
});

test("an open pull request is the one primary action, and it opens outside the app", async () => {
  await app.open(`/f/${CLI}`);
  await screen.findByRole("heading", { level: 1 });

  await waitFor(() =>
    expect(
      screen.getByRole("main").querySelectorAll<HTMLElement>('[data-variant="primary"]'),
    ).toHaveLength(1),
  );
  const links = screen.getAllByRole("link").filter((link) => link.getAttribute("href") === URL);

  // From the action and from the page's list of links.
  expect(links.length).toBeGreaterThan(1);
  for (const link of links) {
    expect(link.getAttribute("target")).toBe("_blank");
    expect(link.getAttribute("rel")).toContain("noopener");
  }
});
