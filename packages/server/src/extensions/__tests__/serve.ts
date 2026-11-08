// What the server API's tests on a started server share: a server on two repositories, `uraeda`
// and `other`, with extensions written to its config folder, stopped after each test, and the
// readers of its records and states.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { onTestFinished } from "vite-plus/test";
import { commitOnBranch, fixtureRepo, git, temporaryFolder } from "uraeda-binding/test-utils";
import { fateAt, port } from "../../__tests__/helpers.ts";
import type { Adapter } from "../../runner/adapter.ts";
import { FakeAdapter } from "../../runner/fake.ts";
import { type Server, startServer } from "../../server.ts";
import { testSettings } from "../../testing.ts";
import { extensionFolder } from "./helpers.ts";

export const binding = await import("uraeda-binding");

/** The spec waiting for the human on its branch, in the fixture. */
export const FEATURE = "2026-10-06-recurring-tasks";
const SPEC = `specs/${FEATURE}/spec.md`;

/** What extensions under test share with the test: through the module `test/sink`. */
export type Sink = {
  activations: number;
  adapter: FakeAdapter;
  changed?: () => void;
  events: Array<Record<string, unknown>>;
  settings?: (repository: string | null) => Record<string, unknown>;
};

/**
 * A server on two repositories, `uraeda` and `other`, its config folder holding `extensions` (by
 * name, their files) and `config.toml`, on `agents`, the fake agent by default, the real ones for null. `prepare` runs on
 * each repository first.
 */
export async function serve(
  extensions: Record<string, Record<string, string>>,
  config: string,
  {
    agents = { fake: new FakeAdapter() },
    prepare = () => {},
    signIn = false,
  }: {
    /** The agents, by runtime name; null for the real ones. */
    agents?: Record<string, Adapter> | null;
    prepare?: (repo: string) => void;
    signIn?: boolean;
  } = {},
) {
  const configDir = temporaryFolder("uraeda-config");
  for (const [name, files] of Object.entries(extensions)) {
    extensionFolder(configDir, name, files);
  }
  writeFileSync(join(configDir, "config.toml"), config);
  const dataDir = temporaryFolder("uraeda-data");
  const parent = temporaryFolder("uraeda-repos");
  const repos = ["other", "uraeda"].map((name) => fixtureRepo("repo", join(parent, name)));
  repos.forEach(prepare);
  for (const repo of repos) {
    await binding.addRepository(dataDir, repo);
  }
  const sink: Sink = { activations: 0, adapter: new FakeAdapter(), events: [] };
  const server = await startServer({
    agents: agents ?? undefined,
    allowOrigins: [],
    binding,
    dataDir,
    extensionModules: { "test/sink": { sink } },
    given: false,
    port,
    repo: repos[1],
    settings: await testSettings({ dir: configDir }),
    ...(!signIn && { signIn: false as const }),
  });
  onTestFinished(() => server.stop());
  const [other, uraeda] = repos;
  return { configDir, dataDir, other, server, sink, uraeda };
}

/** The spec of the fixture's feature, waiting for the human or a draft. */
export function setSpec(repo: string, status: "awaiting-human" | "draft") {
  const spec = git(repo, "show", `${FEATURE}:${SPEC}`).replace(
    /^status: .*$/m,
    `status: ${status}`,
  );
  commitOnBranch(repo, FEATURE, { [SPEC]: spec });
}

/** Reads `ExtensionRecord`s on a repository's endpoint. */
export async function records(server: Server, repository: string, ids: Array<string>) {
  const [result] = await fateAt(server.app, repository, [
    { ids, kind: "byId", select: ["error", "value"], type: "ExtensionRecord" },
  ]);
  return result.data as Array<{ error: string | null; id: string; value: string }>;
}

/** Runs a fate mutation of the extensions on the global endpoint. */
export const mutate = (server: Server, name: string, input: unknown) =>
  fateAt(server.app, null, [{ input, kind: "mutation", name, select: ["extensions"] }]);

/** The extension's row in the `Extensions` record, as the host gives it. */
export const stateOf = (server: Server, name: string) =>
  server.extensions.states().extensions.find((one) => one.extension.name === name);

/** A runtime extension's files, at `version`: it counts its activations. */
export const runtime = (version: number) => ({
  "server.ts": `import { sink } from "test/sink";
export default function activate(api) {
sink.activations += 1;
api.runtime(sink.adapter);
}
// version ${version}
`,
});

/** The address of a path on the test's server. */
export const url = (path: string) => `http://127.0.0.1:${port}${path}`;
