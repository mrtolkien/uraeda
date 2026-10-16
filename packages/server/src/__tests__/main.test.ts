import { type ChildProcessWithoutNullStreams, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  realpathSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { createServer as createHttpServer } from "node:http";
import { createServer, type Server } from "node:net";
import { dirname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vite-plus/test";
import { checkBinding, loadBinding } from "../binding.ts";
import { handOff } from "../open-client.ts";
import { HELP } from "../options.ts";
import { linkPages } from "../sign-in/links.ts";
import { hash } from "../sign-in/tokens.ts";
import { SessionCache } from "../runner/cache.ts";
import { readRepositories, settingsFile, version } from "uraeda-binding";
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

/**
 * Spawns `main.ts` in `cwd`, with `env` over the test's environment: with `--no-open`, or with
 * `opener`'s faked browser launcher, on a desktop.
 */
function start(
  args: Array<string>,
  { cwd, env = {}, opener }: { cwd?: string; env?: Record<string, string>; opener?: Opener } = {},
): Started {
  const child = spawn(process.execPath, [main, ...(opener ? [] : ["--no-open"]), ...args], {
    cwd,
    env: { ...process.env, ...opener?.env, ...env },
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

/**
 * A faked browser launcher: `xdg-open` and `open` first in the `PATH`, on a desktop, writing each
 * address they are given to `log`.
 */
type Opener = { env: Record<string, string>; log: string };

function fakeOpener(): Opener {
  const bin = temporaryFolder("uraeda-opener");
  const log = join(bin, "opened.log");
  for (const name of ["xdg-open", "open"]) {
    writeFileSync(join(bin, name), `#!/bin/sh\nprintf '%s\\n' "$1" >> '${log}'\n`, { mode: 0o755 });
  }
  return {
    env: { DISPLAY: ":0", PATH: `${bin}:${process.env.PATH}`, SSH_CONNECTION: "", SSH_TTY: "" },
    log,
  };
}

/** The addresses the faked launcher opened, once it opened `count`. */
async function opened({ log }: Opener, count = 1): Promise<Array<string>> {
  const lines = () =>
    existsSync(log) ? readFileSync(log, "utf8").split("\n").filter(Boolean) : [];
  await expect.poll(() => lines().length, { interval: 20, timeout: 10_000 }).toBe(count);
  return lines();
}

/**
 * The link a page the faked launcher opened leads to: the page is a file only its owner reads, and
 * its address has no token. Returns the page's path and its link.
 */
function linkIn(address: string): { link: string; page: string } {
  expect(address).toMatch(/^file:\/\/\//);
  expect(address).not.toMatch(/\/session\//);
  const page = fileURLToPath(address);
  expect(statSync(page).mode & 0o777).toBe(0o600);
  const link = /<a href="([^"]+)">/.exec(readFileSync(page, "utf8"))![1]!;
  return { link: link.replaceAll("&amp;", "&"), page };
}

/** The host token file of the server on `port` with the data folder `data`, in its `run/`. */
const tokenFile = (data: string, port: number) => join(data, "run", `server-${port}.token`);

/** The access key a start printed. */
const keyIn = (stdout: string) => /shown once: (ura_[\w-]{43})\n/.exec(stdout)![1];

/** Signs in to the server on `port` with `key`: the `Cookie` header of the new session. */
async function signIn(port: number, key: string): Promise<string> {
  const response = await fetch(`http://127.0.0.1:${port}/session`, {
    body: JSON.stringify({ key }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  expect(response.status).toBe(204);
  return response.headers.get("set-cookie")!.split(";")[0];
}

/** Whether a `Cookie` header is signed in on the server on `port`. */
async function signedIn(port: number, cookie: string): Promise<boolean> {
  const response = await fetch(`http://127.0.0.1:${port}/session`, { headers: { cookie } });
  return response.status === 204;
}

/** A first start on a fresh data folder, ready: its data folder, port, and printed key. */
async function firstStart(options: { opener?: Opener; repo?: string } = {}) {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const repo = options.repo ?? fixtureRepo();
  const server = start(["--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
    opener: options.opener,
  });
  await ready(server);
  return { data, key: keyIn(server.output.stdout), port, repo, server };
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
    env: { URAEDA_DATA_DIR: data },
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

/**
 * Reads the feature's `Preview` record on the server at `port`, as a view signed in with `cookie`,
 * until it is ready.
 */
async function viewUntilReady(
  port: number,
  name: string,
  folder: string,
  cookie: string,
): Promise<void> {
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
          headers: { "content-type": "application/json", cookie, origin },
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
  const cookie = await signIn(port, keyIn(server.output.stdout));
  await viewUntilReady(port, (await listedName(data, repo))!, STORY_FEATURE, cookie);
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

/** A second start opens only a page of the server on the port, whatever that server answers. */
test.each([
  { url: "//evil.com/" },
  { url: String.raw`/\evil.com/` },
  { url: "@evil.com/" },
  { url: "https://evil.com/" },
  { signIn: "//evil.com/", url: "/r/todo/" },
  { signIn: String.raw`/\evil.com/`, url: "/r/todo/" },
  { signIn: "@evil.com/", url: "/r/todo/" },
])("an answer whose page is not on the server is another program's: %o", async (answer) => {
  const port = await httpServer(200, { uraeda: "0.0.0", ...answer });

  expect(await handOff(port, { folder: fixtureRepo(), given: false, signIn: true })).toEqual({
    kind: "other",
  });
});

test("a second start during the first's start waits for it", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const [first, notes, todo] = [fixtureRepo(), fixtureRepo(), fixtureRepo()];
  start(["--repo", first, "--port", String(port)], { env: { URAEDA_DATA_DIR: data } });
  // The host token is written as soon as the port is taken, before the server starts.
  await expect.poll(() => existsSync(tokenFile(data, port)), { interval: 5 }).toBe(true);
  const token = readFileSync(tokenFile(data, port), "utf8");

  // A request as soon as the port is taken, while the server may still start, and a second start.
  const [early, second] = await Promise.all([
    handOff(port, { folder: notes, given: true }, token),
    run(["--repo", todo, "--port", String(port)], { env: { URAEDA_DATA_DIR: data } }),
  ]);

  expect(early).toMatchObject({ kind: "opened", url: `/r/${await listedName(data, notes)}/` });
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

/** The lines of a start that made the key. */
const KEY_LINES =
  /^Access key, shown once: ura_[\w-]{43}\nKeep it in a password manager: every new device signs in with it\.\n$/;

/** The lines of a new key. */
const NEW_KEY_LINES = /^New access key, shown once: ura_[\w-]{43}\nEvery device is signed out\.\n/;

/** US1.1, SC-003 */
test("the first start prints the key once", async () => {
  const { data, port, repo, server } = await firstStart();
  const address = `Uraeda server on http://127.0.0.1:${port}\n`;
  await expect.poll(() => server.output.stdout.length).toBeGreaterThan(address.length);
  server.child.kill("SIGTERM");
  await server.exited;

  const next = start(["--repo", repo, "--port", String(port)], { env: { URAEDA_DATA_DIR: data } });
  await ready(next);

  expect(server.output.stdout.slice(0, address.length)).toBe(address);
  expect(server.output.stdout.slice(address.length)).toMatch(KEY_LINES);
  expect(next.output.stdout).toBe(address);
  const file = readFileSync(join(data, "sign-in.json"), "utf8");
  expect(file).not.toContain(keyIn(server.output.stdout));
  expect(file).toContain(hash(keyIn(server.output.stdout)));
});

/** A first start that fails shows no key: the next start makes one and shows it. */
test("a first start that fails leaves no key, and the next start shows one", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();
  const folder = temporaryFolder("uraeda-none");
  const env = { URAEDA_DATA_DIR: data };

  const failed = await run(["--repo", folder, "--port", String(port)], { env });
  expect(failed.code).toBe(1);
  expect(failed.stdout).toBe("");
  expect(existsSync(join(data, "sign-in.json"))).toBe(false);

  const next = start(["--repo", fixtureRepo(), "--port", String(port)], { env });
  await ready(next);
  await expect.poll(() => next.output.stdout).toMatch(/Access key, shown once: ura_/);
  const key = keyIn(next.output.stdout);
  expect(readFileSync(join(data, "sign-in.json"), "utf8")).toContain(hash(key));
});

/** The host token file: written with the port taken, `0600`, removed at exit. */
test("the host token lives as long as the server", async () => {
  const { data, port, server } = await firstStart();

  expect(statSync(tokenFile(data, port)).mode & 0o777).toBe(0o600);
  expect(readFileSync(tokenFile(data, port), "utf8")).toMatch(/^[\w-]{43}$/);
  server.child.kill("SIGTERM");
  expect(await server.exited).toBe(0);
  expect(existsSync(tokenFile(data, port))).toBe(false);
});

/** US4.1 */
test("the start opens the browser through a one-time link", async () => {
  const opener = fakeOpener();
  const { data, port, repo } = await firstStart({ opener });
  const name = await listedName(data, repo);

  const [address] = await opened(opener);

  const { link, page } = linkIn(address!);
  const path = new RegExp(`^http://127\\.0\\.0\\.1:${port}/session/[\\w-]{43}\\?to=/r/${name}/$`);
  expect(link).toMatch(path);
  const used = await fetch(link, { redirect: "manual" });
  expect(used.status).toBe(303);
  expect(used.headers.get("location")).toBe(`/r/${name}/`);
  expect(await signedIn(port, used.headers.get("set-cookie")!.split(";")[0])).toBe(true);
  expect(existsSync(page)).toBe(false);
  const again = await fetch(link, { redirect: "manual" });
  expect(again.headers.get("set-cookie")).toBeNull();
});

test("a link's page left unused is removed as the server stops", async () => {
  const opener = fakeOpener();
  const { server } = await firstStart({ opener });
  const [address] = await opened(opener);
  const { page } = linkIn(address!);

  server.child.kill("SIGTERM");

  expect(await server.exited).toBe(0);
  expect(existsSync(page)).toBe(false);
});

/** US4.2 */
test("a second start hands over with the host token, and signs its browser in", async () => {
  const { data, port } = await firstStart();
  const notes = fixtureRepo();
  const opener = fakeOpener();

  const second = await run(["--repo", notes, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
    opener,
  });

  const name = await listedName(data, notes);
  expect(second.stdout).toBe(`Uraeda already runs at http://127.0.0.1:${port}/r/${name}/\n`);
  expect(second.code).toBe(0);
  const [address] = await opened(opener);
  const { link, page } = linkIn(address!);
  expect(link).toMatch(
    new RegExp(`^http://127\\.0\\.0\\.1:${port}/session/[\\w-]{43}\\?to=/r/${name}/$`),
  );
  const used = await fetch(link, { redirect: "manual" });
  expect(await signedIn(port, used.headers.get("set-cookie")!.split(";")[0])).toBe(true);
  expect(existsSync(page)).toBe(false);
});

/** Edge case: a second start with another data folder. */
test("a second start with another data folder names it and exits 1", async () => {
  const { data, port } = await firstStart();
  const notes = fixtureRepo();

  const second = await run(["--repo", notes, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: temporaryFolder("uraeda-other-data") },
  });

  expect(second.stderr).toBe(
    `uraeda: port ${port} is used by an Uraeda server with another data folder.\n`,
  );
  expect(second.code).toBe(1);
  expect(await listedName(data, notes)).toBeUndefined();
});

/** US3.4 */
test("a new key on a running server", async () => {
  const { data, key, port, repo } = await firstStart();
  const cookie = await signIn(port, key);

  const second = await run(["--new-key", "--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });

  const name = await listedName(data, repo);
  expect(second.stdout).toMatch(NEW_KEY_LINES);
  expect(second.stdout.replace(NEW_KEY_LINES, "")).toBe(
    `Uraeda already runs at http://127.0.0.1:${port}/r/${name}/\n`,
  );
  expect(second.code).toBe(0);
  expect(await signedIn(port, cookie)).toBe(false);
  const file = readFileSync(join(data, "sign-in.json"), "utf8");
  expect(file).not.toContain(hash(key));
  expect(file).toContain(hash(keyIn(second.stdout)));
  expect(await signedIn(port, await signIn(port, keyIn(second.stdout)))).toBe(true);
});

/** US3.5 */
test("a new key without a server prints the two lines, then starts", async () => {
  const { data, key, port, repo, server } = await firstStart();
  server.child.kill("SIGTERM");
  await server.exited;

  const next = start(["--new-key", "--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(next);
  const address = `Uraeda server on http://127.0.0.1:${port}\n`;
  await expect.poll(() => next.output.stdout.length).toBeGreaterThan(address.length);

  expect(next.output.stdout.slice(0, address.length)).toBe(address);
  expect(next.output.stdout.slice(address.length)).toMatch(NEW_KEY_LINES);
  const file = readFileSync(join(data, "sign-in.json"), "utf8");
  expect(file).not.toContain(hash(key));
  expect(file).toContain(hash(keyIn(next.output.stdout)));
});

/** US3.5, on a fresh data folder: the key the start made is the new one, made once. */
test("a new key at the first start makes one key", async () => {
  const data = temporaryFolder("uraeda-data");
  const port = await freePort();

  const server = start(["--new-key", "--repo", fixtureRepo(), "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });
  await ready(server);
  const address = `Uraeda server on http://127.0.0.1:${port}\n`;
  await expect.poll(() => server.output.stdout.length).toBeGreaterThan(address.length);

  expect(server.output.stdout.slice(address.length)).toMatch(NEW_KEY_LINES);
  expect(server.output.stdout.match(/ura_/g)).toHaveLength(1);
  const file = readFileSync(join(data, "sign-in.json"), "utf8");
  expect(file).toContain(hash(keyIn(server.output.stdout)));
});

/** Error handling: `--new-key` refused by a running server. */
test("a new key the server refuses changes nothing and exits 1", async () => {
  const { data, key, port, repo } = await firstStart();
  const cookie = await signIn(port, key);
  writeFileSync(tokenFile(data, port), "a-wrong-token");

  const second = await run(["--new-key", "--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });

  expect(second.stderr).toBe(`uraeda: the server on port ${port} refused the new key.\n`);
  expect(second.stdout).toBe("");
  expect(second.code).toBe(1);
  expect(readFileSync(join(data, "sign-in.json"), "utf8")).toContain(hash(key));
  expect(await signedIn(port, cookie)).toBe(true);
});

test("the help names --new-key", () => {
  expect(HELP).toContain(
    "  --new-key                make a new access key and sign every device out\n",
  );
});

/** SC-003 */
test("the sign-in file and the output never hold a session token", async () => {
  const { data, key, port, repo, server } = await firstStart();
  const read = () => readFileSync(join(data, "sign-in.json"), "utf8");
  const cookies = [await signIn(port, key), await signIn(port, key)];
  const files = [read()];
  await fetch(`http://127.0.0.1:${port}/session`, {
    headers: { cookie: cookies[0]! },
    method: "DELETE",
  });
  files.push(read());

  const second = await run(["--new-key", "--repo", repo, "--port", String(port)], {
    env: { URAEDA_DATA_DIR: data },
  });

  const file = [...files, read()].join("\n");
  const output = [server.output.stdout, server.output.stderr, second.stdout, second.stderr];
  for (const cookie of cookies) {
    const secret = cookie.split("=")[1]!.split(".")[1]!;
    expect(file).not.toContain(secret);
    expect(output.join("")).not.toContain(secret);
  }
  expect(output.join("").split(key)).toHaveLength(2);
  expect(output.join("").split(keyIn(second.stdout))).toHaveLength(2);
  expect(file).not.toContain(key);
  expect(file).not.toContain(keyIn(second.stdout));
});

/** A config folder whose `config.toml` holds `text`: its folder and how to read the file again. */
function configWith(text: string) {
  const dir = temporaryFolder("uraeda-config");
  writeFileSync(join(dir, "config.toml"), text);
  return { dir, read: () => readFileSync(join(dir, "config.toml"), "utf8") };
}

/**
 * Starts `main.ts` on the settings of `config` and the variables of `env`, in a fresh data folder,
 * without `.env`'s port: once ready, the address it printed.
 */
async function startOn(
  config: string,
  {
    args = [],
    env = {},
    opener,
  }: { args?: Array<string>; env?: Record<string, string>; opener?: Opener } = {},
) {
  const data = temporaryFolder("uraeda-data");
  const server = start(["--repo", fixtureRepo(), ...args], {
    env: { URAEDA_CONFIG_DIR: config, URAEDA_DATA_DIR: data, URAEDA_PORT: "", ...env },
    opener,
  });
  await ready(server);
  return { address: /Uraeda server on (\S+)\n/.exec(server.output.stdout)![1], data, server };
}

/** US3.1, US2.2, US2.3, SC-003: the port, from the flag, the variable, then the file. */
test("the port comes from --port, then URAEDA_PORT, then the file, which no start changes", async () => {
  const [file, variable, flag] = [await freePort(), await freePort(), await freePort()];
  const config = configWith(`# mine\n[server]\nport = ${file}\n`);

  const fromFile = await startOn(config.dir);
  const fromVariable = await startOn(config.dir, { env: { URAEDA_PORT: String(variable) } });
  const fromFlag = await startOn(config.dir, {
    args: ["--port", String(flag)],
    env: { URAEDA_PORT: String(variable) },
  });

  expect(fromFile.address).toBe(`http://127.0.0.1:${file}`);
  expect(fromVariable.address).toBe(`http://127.0.0.1:${variable}`);
  expect(fromFlag.address).toBe(`http://127.0.0.1:${flag}`);
  expect(config.read()).toBe(`# mine\n[server]\nport = ${file}\n`);
});

/** SC-003, edge case: no config folder. A start never makes the folder, nor writes in it. */
test("a start leaves an empty config folder empty, and an absent one absent", async () => {
  const empty = temporaryFolder("uraeda-config");
  const absent = join(temporaryFolder("uraeda-config"), "uraeda");

  await startOn(empty, { args: ["--port", String(await freePort())] });
  await startOn(absent, { args: ["--port", String(await freePort())] });

  expect(readdirSync(empty)).toEqual([]);
  expect(existsSync(absent)).toBe(false);
});

/** A port given by a flag or a variable follows the core's rule, as the file's does. */
test.each<{ args: Array<string>; env: Record<string, string> }>([
  { args: ["--port", "abc"], env: {} },
  { args: [], env: { URAEDA_PORT: "0" } },
  { args: [], env: { URAEDA_PORT: "70000" } },
])("a port that is not one refuses the start: $args $env", async ({ args, env }) => {
  const data = temporaryFolder("uraeda-data");

  const refused = await run(["--repo", fixtureRepo(), ...args], {
    env: { URAEDA_CONFIG_DIR: temporaryFolder("uraeda-config"), URAEDA_DATA_DIR: data, ...env },
  });

  expect(refused.code).toBe(1);
  expect(refused.stdout).toBe("");
  expect(refused.stderr).toBe("uraeda: The port is a number from 1 to 65535.\n");
  expect(readdirSync(data)).toEqual([]);
});

/** US3.3 */
test("open_browser = false in the file opens no browser", async () => {
  const opener = fakeOpener();
  const port = await freePort();
  const config = configWith("[server]\nopen_browser = false\n");

  const { data } = await startOn(config.dir, { args: ["--port", String(port)], opener });
  // A round trip: the start's code after its address has run, and a browser that opens would
  // have its one-time link's page.
  await fetch(`http://127.0.0.1:${port}/session`);

  const pages = linkPages(data, port);
  expect(existsSync(pages) ? readdirSync(pages) : []).toEqual([]);
  expect(existsSync(opener.log)).toBe(false);
  expect(config.read()).toBe("[server]\nopen_browser = false\n");
});

/** Edge case: a file that cannot be read. */
test("a broken file starts on the defaults, its problem printed, the file kept", async () => {
  const port = await freePort();
  const config = configWith("[server]\nport = 0\n");

  const { server } = await startOn(config.dir, { env: { URAEDA_PORT: String(port) } });

  expect(server.output.stdout).toContain(`Uraeda server on http://127.0.0.1:${port}\n`);
  expect(server.output.stderr).toContain(
    `uraeda: Cannot read ${settingsFile(config.dir)}: line 2, port: The port is a number from 1 to 65535. The server uses its defaults until the file is fixed.\n`,
  );
  expect(config.read()).toBe("[server]\nport = 0\n");
});
