import * as binding from "uraeda-binding";
import { fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { createApp } from "../app.ts";
import { fakeRunner } from "../testing.ts";

export { fixture, fixtureRepo, git };

export const port = 4310;

/** The server's app, called in process, on a repository, with a runner that has no agent. */
export function testApp(repo = fixtureRepo(), allowedHosts: Array<string> = []) {
  return app(repo, allowedHosts, fakeRunner({ installed: false }).runner);
}

function app(
  repo: string,
  allowedHosts: Array<string>,
  runner: ReturnType<typeof fakeRunner>["runner"],
) {
  return createApp({
    repo,
    port,
    allowedHosts,
    allowOrigins: ["http://localhost:5173"],
    binding,
    runner,
  });
}

/** The server's app with a runner on the fake adapter, checked once. */
export async function testServer(repo = fixtureRepo(), { installed = true } = {}) {
  const { runner, adapter } = fakeRunner({ installed });
  await runner.check();
  return { app: app(repo, [], runner), adapter, runner, repo };
}

type App = ReturnType<typeof testApp>;

/** Sends native fate operations, and returns their results in order. */
export async function fate(app: App, operations: Array<Record<string, unknown>>) {
  const response = await app.request(`http://127.0.0.1:${port}/fate`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({
      operations: operations.map((operation, index) => ({ id: String(index), ...operation })),
      version: 1,
    }),
  });
  const body = (await response.json()) as {
    results: Array<{ ok: boolean; data?: any; error?: { code: string; message: string } }>;
  };
  return body.results;
}

/** Reads records of a type by id, with the given fields. */
export async function byId(app: App, type: string, ids: Array<string>, select: Array<string>) {
  const [result] = await fate(app, [{ kind: "byId", type, ids, select }]);
  if (!result.ok) {
    throw new Error(result.error?.message);
  }
  return result.data as Array<Record<string, any>>;
}

/** Runs a mutation, and returns its result. */
export async function mutate(app: App, name: string, input: unknown, select: Array<string>) {
  const [result] = await fate(app, [{ kind: "mutation", name, input, select }]);
  return result;
}

/** A repository with `count` feature branches besides the fixture's, for timing. */
export function repoWithBranches(count: number) {
  const repo = fixtureRepo();
  for (let n = 0; n < count; n++) {
    git(
      repo,
      "branch",
      `2026-11-${String(n + 1).padStart(2, "0")}-feature-${n}`,
      "2026-10-11-web-ui",
    );
  }
  return repo;
}
