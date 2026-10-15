import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import { mkdirSync, realpathSync, utimesSync, writeFileSync } from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { connect, createServer, type Server } from "node:net";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vite-plus/test";
import { checkBinding, loadBinding } from "../binding.ts";
import { handOff } from "../open-client.ts";
import { HELP } from "../options.ts";
import { SessionCache } from "../runner/cache.ts";
import { readRepositories, version } from "uraeda-binding";
import {
  addStoryFeature,
  fixtureRepo,
  previewStarts,
  STORY_FEATURE,
  temporaryFolder,
} from "uraeda-binding/test-utils";

const main = fileURLToPath(new URL("../main.ts", import.meta.url));

/** A started `main.ts`, its output so far, and its exit code once it exits. */
type Started = {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<number | null>;
  output: { stderr: string; stdout: string };
};

/** The processes and listeners a test started, ended after it. */
const children: Array<Started> = [];
const listeners: Array<Server | ReturnType<typeof createHttpServer>> = [];

afterEach(async () => {
  for (const started of children.splice(0)) {
    started.child.kill("SIGTERM");
    await started.exited;
  }
  for (const listener of listeners.splice(0)) {
    listener.close();
  }
});

/** Spawns `main.ts` with `--no-open`, in `cwd`, with `env` over the test's environment. */
function start(
  args: Array<string>,
  { cwd, env = {} }: { cwd?: string; env?: Record<string, string> } = {},
): Started {
  const child = spawn(process.execPath, [main, "--no-open", ...args], {
    cwd,
    env: { ...process.env, ...env },
  });
  const output = { stderr: "", stdout: "" };
  child.stdout.on("data", (chunk) => (output.stdout += chunk));
  child.stderr.on("data", (chunk) => (output.stderr += chunk));
  const exited = new Promise<number | null>((resolve) => child.on("exit", resolve));
  const started = { child, exited, output };
  children.push(started);
  return started;
}

/** Runs `main.ts` to its end: its output and exit code. */
async function run(args: Array<string>, options: Parameters<typeof start>[1] = {}) {
  const started = start(args, options);
  const code = await started.exited;
  return { code, ...started.output };
}

/** Resolves once the server prints its address; rejects when it exits first. */
function ready({ child, output }: Started): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => {
      if (output.stdout.includes("Uraeda server on")) {
        resolve();
      }
    };
    child.stdout.on("data", check);
    child.on("exit", (code) =>
      reject(new Error(`exited ${code} before it was ready: ${output.stderr}`)),
    );
    check();
  });
}

/** A port free on 127.0.0.1 when it returns. */
async function freePort(): Promise<number> {
  const listener = createServer();
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  const { port } = listener.address() as { port: number };
  await new Promise((resolve) => listener.close(resolve));
  return port;
}

/** Resolves once something accepts connections on 127.0.0.1:`port`, retrying as soon as refused. */
async function bound(port: number): Promise<void> {
  for (;;) {
    const accepted = await new Promise<boolean>((resolve) => {
      const socket = connect(port, "127.0.0.1");
      socket.once("connect", () => {
        socket.destroy();
        resolve(true);
      });
      socket.once("error", () => resolve(false));
    });
    if (accepted) {
      return;
    }
  }
}

/** Another program's listener on a free port, plain TCP, which never answers. */
async function otherProgram(): Promise<number> {
  const listener = createServer();
  listeners.push(listener);
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  return (listener.address() as { port: number }).port;
}

/** An HTTP server on a free port, answering every request with `status` and `body`. */
async function httpServer(status: number, body: unknown): Promise<number> {
  const listener = createHttpServer((_, response) => {
    response.writeHead(status, { "content-type": "application/json" });
    response.end(JSON.stringify(body));
  });
  listeners.push(listener);
  await new Promise<void>((resolve) => listener.listen(0, "127.0.0.1", resolve));
  return (listener.address() as { port: number }).port;
}

/** The session cache of the data folder, with a session whose turn is in progress: its ID. */
function seedTurnInProgress(data: string): number {
  const cache = SessionCache.open(join(data, "runner.sqlite"));
  const session = cache.createSession({
    agent: "fake",
    folder: null,
    nativeId: "native",
    repo: "/repo",
    title: null,
  });
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: session.id,
    state: "running",
    step: null,
    trigger: null,
  });
  cache.db.close();
  return turn;
}

/** The name the core gave the repository at `folder` in the data folder's list. */
async function listedName(data: string, folder: string): Promise<string | undefined> {
  const real = realpathSync(folder);
  const listed = await readRepositories(data);
  return listed.find((repository) => realpathSync(repository.path) === real)?.name;
}

/** A binding import that fails, as when it is not built. */
const missingBinding = () => Promise.reject(new Error("Cannot find native binding."));

test("refuses to start on a folder that is not a repository", async () => {
  const folder = temporaryFolder("uraeda-none");

  const result = await run(["--repo", folder, "--port", String(await freePort())]);

  expect(result.stderr).toBe(`uraeda: ${folder} is not a git repository\n`);
  expect(result.code).toBe(1);
});

test("--help prints the options and exits 0", () => {
  const result = spawnSync(process.execPath, [main, "--help"], { encoding: "utf8" });

  expect(result.stdout).toBe(HELP);
  expect(result.status).toBe(0);
});

test("--version prints the workspace's version", () => {
  const result = spawnSync(process.execPath, [main, "--version"], { encoding: "utf8" });

  expect(result.stdout).toBe(`${version()}\n`);
  expect(result.status).toBe(0);
});

test("an unknown option names --help and exits 1", () => {
  const result = spawnSync(process.execPath, [main, "--colour"], { encoding: "utf8" });

  expect(result.stderr).toBe("uraeda: unknown option --colour; see uraeda --help\n");
  expect(result.status).toBe(1);
});

test("a second start hands its repository to the running server and exits 0", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const first = start(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(first);
  const notes = fixtureRepo();

  const second = await run(["--repo", notes, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: temporaryFolder("uraeda-other-data") },
  });

  const name = await listedName(data, notes);
  expect(name).toBeDefined();
  expect(second.stdout).toBe(`Uraeda already runs at http://127.0.0.1:${port}/r/${name}/\n`);
  expect(second.code).toBe(0);
});

test("a relative --repo is resolved where the second start runs", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const first = start(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(first);
  const notes = fixtureRepo();
  const parent = dirname(notes);

  const second = await run(["--repo", relative(parent, notes), "--port", String(port)], {
    cwd: parent,
    env: { URAEDA_DATA_DIR: data },
  });

  const name = await listedName(data, notes);
  expect(name).toBeDefined();
  expect(second.stdout).toBe(`Uraeda already runs at http://127.0.0.1:${port}/r/${name}/\n`);
  expect(second.code).toBe(0);
});

test("a given folder outside git is refused by the running server", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const first = start(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(first);
  const folder = temporaryFolder("uraeda-none");

  const second = await run(["--repo", folder, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });

  expect(second.stderr).toBe(`uraeda: ${folder} is not a git repository\n`);
  expect(second.code).toBe(1);
});

test("a handoff leaves the running server's turns in progress", async () => {
  const data = temporaryFolder("uraeda-data");
  const turn = seedTurnInProgress(data);
  const port = await httpServer(200, { uraeda: "0.0.0", url: "/" });

  const second = await run(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });

  expect(second.stdout).toBe(`Uraeda already runs at http://127.0.0.1:${port}/\n`);
  expect(second.code).toBe(0);
  const cache = SessionCache.open(join(data, "runner.sqlite"));
  expect(cache.turn(turn)?.state).toBe("running");
  cache.db.close();
});

/** Reads the feature's `Preview` record on the server at `port`, as a view, until it is ready. */
async function viewUntilReady(port: number, name: string, folder: string): Promise<void> {
  const origin = `http://127.0.0.1:${port}`;
  await expect
    .poll(
      async () => {
        const response = await fetch(`${origin}/r/${name}/fate`, {
          body: JSON.stringify({
            operations: [
              { id: "1", ids: [folder], kind: "byId", select: ["state"], type: "Preview" },
            ],
            version: 1,
          }),
          headers: { "content-type": "application/json", origin },
          method: "POST",
        });
        const payload = (await response.json()) as {
          results: Array<{ data?: Array<{ state: string }> }>;
        };
        return payload.results[0]?.data?.[0]?.state;
      },
      { interval: 200, timeout: 10_000 },
    )
    .toBe("ready");
}

/** Whether the process is running. */
function alive(pid: number): boolean {
  try {
    process.kill(pid, 0);
    return true;
  } catch {
    return false;
  }
}

test("SIGHUP stops the server and its Storybooks", async () => {
  const data = temporaryFolder("uraeda-data");
  const repo = fixtureRepo();
  const { log } = addStoryFeature(repo);
  const port = await freePort();
  const server = start(["--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(server);
  await viewUntilReady(port, (await listedName(data, repo))!, STORY_FEATURE);
  const [storybook] = previewStarts(log!);

  server.child.kill("SIGHUP");

  expect(await server.exited).toBe(0);
  await expect.poll(() => alive(storybook!.pid), { timeout: 10_000 }).toBe(false);
});

test("another program on the port names --port and exits 1", async () => {
  const port = await otherProgram();

  const second = await run(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: temporaryFolder("uraeda-data") },
  });

  expect(second.stderr).toBe(
    `uraeda: port ${port} is used by another program: pass --port to use another one\n`,
  );
  expect(second.code).toBe(1);
});

test("a server that answers 404, like an older Uraeda, is another program", async () => {
  const port = await httpServer(404, { error: "not found" });

  const second = await run(["--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: temporaryFolder("uraeda-data") },
  });

  expect(second.stderr).toBe(
    `uraeda: port ${port} is used by another program: pass --port to use another one\n`,
  );
  expect(second.code).toBe(1);
});

test("a second start during the first's start waits for it", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const [first, notes, todo] = [fixtureRepo(), fixtureRepo(), fixtureRepo()];
  start(["--repo", first, "--port", String(port)], { env: { URAEDA_DATA_DIR: data } });
  await bound(port);

  // A request as soon as the port is taken, while the server may still start, and a second start.
  const [early, second] = await Promise.all([
    handOff(port, { folder: notes, given: true }),
    run(["--repo", todo, "--port", String(port)], { env: { URAEDA_DATA_DIR: data } }),
  ]);

  expect(early).toEqual({ kind: "opened", url: `/r/${await listedName(data, notes)}/` });
  expect(second.stdout).toBe(
    `Uraeda already runs at http://127.0.0.1:${port}/r/${await listedName(data, todo)}/\n`,
  );
  expect(second.code).toBe(0);
});

test("explains a binding that is not built, in a checkout", async () => {
  await expect(loadBinding(missingBinding, temporaryFolder("uraeda-checkout"))).rejects.toThrow(
    "the native binding is not built; run vp run ready",
  );
});

test("shows the loader's error when the package has no binding", async () => {
  const loader = "Cannot find native binding. npm has a bug related to optional dependencies.";
  const error = await loadBinding(() => Promise.reject(new Error(loader)), null).catch(
    (error: unknown) => error,
  );
  expect(error).toBeInstanceOf(Error);
  expect((error as Error).message).toBe(loader);
});

/** A checkout with a binding built at `built` and a core changed at `changed`, in seconds. */
function checkout(built: number, changed: number) {
  const root = temporaryFolder("uraeda-binding");
  mkdirSync(join(root, "packages/binding"), { recursive: true });
  mkdirSync(join(root, "crates/core/src"), { recursive: true });
  const binding = join(root, "packages/binding/uraeda-binding.linux-x64-gnu.node");
  const source = join(root, "crates/core/src/lib.rs");
  writeFileSync(binding, "");
  writeFileSync(source, "");
  utimesSync(join(root, "crates/core/src"), 1, 1);
  utimesSync(join(root, "crates/core"), 1, 1);
  utimesSync(binding, built, built);
  utimesSync(source, changed, changed);
  return root;
}

test("refuses a binding older than the Rust core, as after a pull", () => {
  expect(() => checkBinding(checkout(100, 200))).toThrow(
    "the native binding is older than the Rust core; run vp run --filter uraeda-binding build",
  );
});

test("takes a binding built after the Rust core changed", () => {
  expect(() => checkBinding(checkout(200, 100))).not.toThrow();
});

test("takes any binding outside a checkout of the repository", () => {
  const root = temporaryFolder("uraeda-binding");
  mkdirSync(join(root, "packages/binding"), { recursive: true });
  writeFileSync(join(root, "packages/binding/uraeda-binding.linux-x64-gnu.node"), "");

  expect(() => checkBinding(root)).not.toThrow();
});
