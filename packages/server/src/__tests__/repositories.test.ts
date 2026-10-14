import { mkdirSync, rmSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test, vi } from "vite-plus/test";
import * as binding from "uraeda-binding";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { Hosts } from "../repositories.ts";
import { fakeSessions } from "../testing.ts";
import { byIdAt, fixtureRepo, git, port, testApp, testHosts } from "./helpers.ts";
import { createApp } from "../app.ts";

const FOLDER = "2026-10-14-dark-mode";

/** A fixture repository whose main branch holds a feature folder, its proposal titled `title`. */
function repoWithFeature(title: string) {
  const repo = fixtureRepo();
  mkdirSync(join(repo, "specs", FOLDER));
  writeFileSync(
    join(repo, "specs", FOLDER, "proposal.md"),
    `# ${title}\n\n## What\n\nDark mode.\n\n## Why\n\nNight.\n`,
  );
  git(repo, "add", "--all");
  git(repo, "commit", "--quiet", "--no-verify", "--message", "proposal: dark mode");
  return repo;
}

/** Two repositories with the same feature folder, under different titles, served by one app. */
async function twoRepositories() {
  const repos = [repoWithFeature("Dark mode in uraeda"), repoWithFeature("Dark mode in todo-app")];
  const opened = await testHosts(repos, { installed: false });
  const app = createApp({
    repo: repos[0],
    port,
    allowedHosts: [],
    allowOrigins: [],
    binding,
    sessions: opened.sessions,
    hosts: opened.hosts,
    dataDir: opened.dataDir,
  });
  return { app, ...opened };
}

/** US6.1 */
test("each repository's feature is read from its own endpoint", async () => {
  const { app, names } = await twoRepositories();

  const [a] = await byIdAt(app, names[0], "Feature", [FOLDER], ["title"]);
  const [b] = await byIdAt(app, names[1], "Feature", [FOLDER], ["title"]);

  expect([a.title, b.title]).toEqual(["Dark mode in uraeda", "Dark mode in todo-app"]);
});

test("an unknown name is a 404", async () => {
  const { app } = await testApp();

  const responses = [];
  for (const path of ["fate", "fate/live", "raw/specs/PRIORITIES.md", "mockups/ui.html"]) {
    responses.push(
      await app.request(`http://127.0.0.1:${port}/r/old-site/${path}`, {
        method: path === "fate" ? "POST" : "GET",
      }),
    );
  }

  for (const response of responses) {
    expect([response.status, await response.text()]).toEqual([
      404,
      "No repository named “old-site”",
    ]);
  }
});

/** Review focus 1: a repository removed while its page is open. */
test("a removed repository's endpoint is a 404", async () => {
  const { app, name, hosts, dataDir } = await testApp();
  await binding.removeRepository(dataDir, name);
  await hosts.reload();

  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/fate`, {
    method: "POST",
  });

  expect([response.status, await response.text()]).toEqual([404, `No repository named “${name}”`]);
});

test("a repository's raw file is served under its name", async () => {
  const { app, name } = await testApp();

  const response = await app.request(`http://127.0.0.1:${port}/r/${name}/raw/specs/PRIORITIES.md`);

  expect(response.status).toBe(200);
  expect(await response.text()).toContain("Web UI for the workflow files");
});

/** Review focus 5 */
test("a missing repository's host starts without a watch", async () => {
  const repo = fixtureRepo();
  const dataDir = temporaryFolder("uraeda-data");
  const { repository } = await binding.addRepository(dataDir, repo);
  rmSync(repo, { recursive: true, force: true });
  const watch = vi.fn(binding.watch);
  const { sessions } = fakeSessions({ installed: false });

  const hosts = await Hosts.open({ binding: { ...binding, watch }, dataDir, sessions });
  const host = hosts.get(repository.name);
  sessions.close();
  hosts.close();

  expect(host?.missing).toBe(true);
  expect(watch).not.toHaveBeenCalled();
});

/** Review focus 5 */
test("a watch that fails to start is logged, and the server goes on", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const repo = fixtureRepo();
  const failing = {
    ...binding,
    watch: () => {
      throw new Error("too many open files");
    },
  };

  const { hosts, names } = await testHosts([repo], { binding: failing, installed: false });

  expect(hosts.get(names[0])?.path).toBe(repo);
  expect(log).toHaveBeenCalledWith(
    "uraeda-server: too many open files; pages refresh when shown again",
  );
  log.mockRestore();
});

test("hosts follow the list as it reloads, and close the watch of a removed one", async () => {
  const [first, second] = [fixtureRepo(), fixtureRepo()];
  let closed = 0;
  const counting = {
    ...binding,
    watch: (...args: Parameters<typeof binding.watch>) => {
      const handle = binding.watch(...args);
      return {
        close: () => {
          closed++;
          handle.close();
        },
      } as binding.WatchHandle;
    },
  };
  const { hosts, dataDir, names } = await testHosts([first], { binding: counting });

  const { repository } = await binding.addRepository(dataDir, second);
  await hosts.reload();
  const listed = await binding.readRepositories(dataDir);
  expect(hosts.rows()).toEqual(listed);
  expect(listed.map((row) => row.name).sort()).toEqual([names[0], repository.name].sort());
  expect(hosts.byPath(second)?.name).toBe(repository.name);
  expect(hosts.mostRecent()?.name).toBe(listed[0].name);

  await binding.removeRepository(dataDir, names[0]);
  await hosts.reload();
  expect([hosts.get(names[0]), closed]).toEqual([undefined, 1]);
});

test("an invalid list keeps the hosts, with its problem", async () => {
  const log = vi.spyOn(console, "error").mockImplementation(() => {});
  const { hosts, dataDir, names } = await testHosts([fixtureRepo()], { installed: false });
  writeFileSync(join(dataDir, "repositories.json"), "{not json");

  await hosts.reload();

  expect(hosts.get(names[0])).toBeDefined();
  expect(hosts.problem).toMatch(/^repositories\.json could not be read: /);
  log.mockRestore();
});
