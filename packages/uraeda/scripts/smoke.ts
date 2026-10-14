/**
 * `node packages/uraeda/scripts/smoke.ts [--binding <.node or folder> | --platform <tarball>]`: packs
 * `uraeda`, installs it with npm in a new temporary folder outside the repository, and runs it as a
 * user would: its version, help, an unknown option, a start in a new git repository whose `.env`
 * must be ignored, a start outside git, and the package's contents.
 *
 * `--binding` gives the native binding through `NAPI_RS_NATIVE_LIBRARY_PATH`, as `vp run ready`
 * does with the checkout's build: a `.node` file, or a folder holding one `uraeda-binding.*.node`,
 * as `vp run` expands no glob; `--platform` installs a platform package's tarball next to the
 * package, as the release does. With neither, only the checks that need no binding run, and the
 * command must fail with its own message.
 *
 * It prints one line per check, `ok <name>` or `failed <name>: <why>`, and exits 1 on the first
 * failure. Every server it starts is stopped, whatever happens, and the temporary folder removed.
 */
import { type ChildProcess, execFileSync, spawn, spawnSync } from "node:child_process";
import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { request } from "node:http";
import { connect, createServer } from "node:net";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { setTimeout as delay } from "node:timers/promises";
import { parseArgs } from "node:util";

/** `packages/uraeda`, which is packed. */
const PACKAGE = resolve(import.meta.dirname, "..");
/** The checkout, for the Cargo workspace's version and the loader napi-rs generated. */
const ROOT = resolve(PACKAGE, "../..");
/** SC-002: the repository's page answers within this long of the start. */
const START_MS = 2000;
/** How long a server may take to print its line, or to exit once stopped. */
const WAIT_MS = 10_000;
/** The port the project's `.env` asks for, which the package must not read. */
const ENV_PORT = 5000;

/** A failed check: its name, and why. */
class Failure extends Error {
  readonly check: string;

  constructor(check: string, why: string) {
    super(why);
    this.check = check;
  }
}

/** A server started by a check, with its output so far. */
type Started = {
  child: ChildProcess;
  exited: Promise<void>;
  stderr: () => string;
  stdout: () => string;
};

/** The installed package, and how its commands are run. */
type Install = {
  bin: string;
  binding: boolean;
  env: NodeJS.ProcessEnv;
  folder: string;
  root: string;
};

const children = new Set<ChildProcess>();

function pass(check: string, detail?: string) {
  process.stdout.write(`ok ${check}${detail ? ` (${detail})` : ""}\n`);
}

function expect(check: string, condition: boolean, why: string) {
  if (!condition) {
    throw new Failure(check, why);
  }
  pass(check);
}

/** Polls until `ready` returns true, or fails with `why` once `deadline` (from `Date.now()`) passes. */
async function waitFor(ready: () => boolean | Promise<boolean>, deadline: number, why: string) {
  while (!(await ready())) {
    if (Date.now() > deadline) {
      throw new Error(why);
    }
    await delay(25);
  }
}

/** A port nothing listens on, from the system. */
function freePort(): Promise<number> {
  return new Promise((resolvePort, reject) => {
    const server = createServer();
    server.once("error", reject);
    server.listen(0, "127.0.0.1", () => {
      const address = server.address();
      server.close(() => resolvePort(typeof address === "object" && address ? address.port : 0));
    });
  });
}

/** Whether something accepts connections on 127.0.0.1:`port`. */
function listening(port: number): Promise<boolean> {
  return new Promise((done) => {
    const socket = connect(port, "127.0.0.1");
    socket.once("connect", () => {
      socket.destroy();
      done(true);
    });
    socket.once("error", () => done(false));
  });
}

/** The status of `GET path` on the port, with the given `Host`; null when nothing answers. */
function status(port: number, path: string, host = `127.0.0.1:${port}`): Promise<number | null> {
  return new Promise((done) => {
    const sent = request({ headers: { host }, host: "127.0.0.1", path, port }, (response) => {
      response.resume();
      done(response.statusCode ?? null);
    });
    sent.once("error", () => done(null));
    sent.end();
  });
}

/** Starts `uraeda` with `args` in `cwd`, as a server that keeps running. */
function start(install: Install, args: Array<string>, cwd: string): Started {
  const child = spawn(install.bin, args, { cwd, env: install.env, stdio: "pipe" });
  children.add(child);
  let stdout = "";
  let stderr = "";
  child.stdout.on("data", (chunk: Buffer) => (stdout += chunk));
  child.stderr.on("data", (chunk: Buffer) => (stderr += chunk));
  const exited = new Promise<void>((done) => {
    child.once("exit", () => {
      children.delete(child);
      done();
    });
  });
  return { child, exited, stderr: () => stderr, stdout: () => stdout };
}

/** Stops a started server, and waits for it to exit. */
async function stop(started: Started) {
  started.child.kill("SIGTERM");
  const timeout = delay(WAIT_MS).then(() => started.child.kill("SIGKILL"));
  await Promise.race([started.exited, timeout]);
}

/** Waits for the server's line on stdout, failing at once when it exits first. */
async function line(check: string, started: Started, port: number) {
  const expected = `Uraeda server on http://127.0.0.1:${port}\n`;
  try {
    await waitFor(
      () => {
        if (started.child.exitCode !== null) {
          throw new Error(`exited ${started.child.exitCode}: ${started.stderr().trim()}`);
        }
        return started.stdout().includes(expected);
      },
      Date.now() + WAIT_MS,
      `no "${expected.trim()}" on stdout: ${started.stdout().trim()} ${started.stderr().trim()}`,
    );
  } catch (error) {
    throw new Failure(check, (error as Error).message);
  }
}

/** Runs `uraeda` with `args` to its exit, with the given environment. */
function run(install: Install, args: Array<string>, env = install.env) {
  const result = spawnSync(install.bin, args, { encoding: "utf8", env, timeout: WAIT_MS });
  return { code: result.status, stderr: result.stderr ?? "", stdout: result.stdout ?? "" };
}

/** The `.node` file `--binding` names, or the one `uraeda-binding.*.node` in the folder it names. */
function nodeFile(binding: string): string {
  if (!statSync(binding).isDirectory()) {
    return resolve(binding);
  }
  const found = readdirSync(binding).filter((name) => /^uraeda-binding\..+\.node$/.test(name));
  if (found.length !== 1) {
    throw new Error(`expected one uraeda-binding.*.node in ${binding}, found ${found.length}`);
  }
  return resolve(binding, found[0]);
}

/** Packs the package and installs it, with the platform package when given, in `folder`. */
function install(folder: string, binding?: string, platform?: string): Install {
  const packed = JSON.parse(
    execFileSync("npm", ["pack", "--json", "--pack-destination", folder], {
      cwd: PACKAGE,
      encoding: "utf8",
      stdio: ["ignore", "pipe", "pipe"],
    }),
  ) as Array<{ filename: string }>;
  const tarball = join(folder, packed[0].filename);
  pass("size", `${statSync(tarball).size} bytes`);
  const root = join(folder, "install");
  mkdirSync(root);
  writeFileSync(join(root, "package.json"), '{ "name": "smoke", "private": true }\n');
  const tarballs = [tarball, ...(platform ? [resolve(platform)] : [])];
  execFileSync("npm", ["install", "--omit=optional", "--no-audit", "--no-fund", ...tarballs], {
    cwd: root,
    stdio: ["ignore", "pipe", "pipe"],
  });
  // The settings come from the checks alone, as a project's `.env` must not add any.
  const cleared = new Set([
    "NAPI_RS_NATIVE_LIBRARY_PATH",
    "URAEDA_ALLOWED_HOSTS",
    "URAEDA_PORT",
    "URAEDA_REPO",
  ]);
  const env: NodeJS.ProcessEnv = {
    ...Object.fromEntries(Object.entries(process.env).filter(([name]) => !cleared.has(name))),
    URAEDA_DATA_DIR: join(folder, "data"),
    ...(binding && { NAPI_RS_NATIVE_LIBRARY_PATH: nodeFile(binding) }),
  };
  pass("install");
  return {
    bin: join(root, "node_modules/.bin/uraeda"),
    binding: Boolean(binding || platform),
    env,
    folder,
    root: join(root, "node_modules/uraeda"),
  };
}

/** The version `--version` must print: the package's, or the Cargo workspace's before a release. */
function expectedVersion(install: Install): string {
  const { version } = JSON.parse(readFileSync(join(install.root, "package.json"), "utf8")) as {
    version: string;
  };
  if (version !== "0.0.0") {
    return version;
  }
  const cargo = readFileSync(join(ROOT, "Cargo.toml"), "utf8");
  return /^\[workspace\.package\][^[]*?^version = "([^"]+)"/m.exec(cargo)?.[1] ?? version;
}

/** The checks that need no server: version, help, an unknown option, and a missing binding. */
function commands(install: Install) {
  if (install.binding) {
    const version = run(install, ["--version"]);
    const expected = expectedVersion(install);
    expect(
      "version",
      version.code === 0 && version.stdout === `${expected}\n`,
      `expected ${expected}, exit ${version.code}: ${version.stdout.trim()} ${version.stderr.trim()}`,
    );
  }
  const help = run(install, ["--help"]);
  expect(
    "help",
    help.code === 0 && help.stdout.includes("--allowed-hosts"),
    `exit ${help.code}: ${help.stdout.trim()} ${help.stderr.trim()}`,
  );
  const unknown = run(install, ["--colour"]);
  expect(
    "unknown option",
    unknown.code === 1 && unknown.stderr === "uraeda: unknown option --colour; see uraeda --help\n",
    `exit ${unknown.code}: ${unknown.stderr.trim()}`,
  );
  if (!install.binding) {
    const missing = run(install, ["--version"]);
    expect(
      "missing binding",
      missing.code === 1 && missing.stderr.startsWith("uraeda: "),
      `exit ${missing.code}: ${missing.stderr.trim()}`,
    );
  }
}

/** A start in a new git repository whose `.env` asks for another port and another host name. */
async function startInRepository(install: Install) {
  const check = "start";
  const repository = join(install.folder, "todo");
  mkdirSync(repository);
  execFileSync("git", ["init", "-q"], { cwd: repository });
  writeFileSync(
    join(repository, ".env"),
    `URAEDA_PORT=${ENV_PORT}\nURAEDA_ALLOWED_HOSTS=evil.test\n`,
  );
  const envPortUsed = await listening(ENV_PORT);
  const port = await freePort();
  const started = start(install, ["--no-open", "--port", String(port)], repository);
  const deadline = Date.now() + START_MS;
  try {
    await line(check, started, port);
    for (const path of ["/", "/r/todo/"]) {
      await waitFor(
        async () => (await status(port, path)) === 200,
        deadline,
        `${path} did not answer 200 within ${START_MS} ms of the start`,
      ).catch((error: Error) => {
        throw new Failure(check, error.message);
      });
    }
    const evil = await status(port, "/", `evil.test:${port}`);
    if (evil !== 403) {
      throw new Failure(check, `Host evil.test answered ${evil}, not 403: the .env was read`);
    }
    if (!envPortUsed && (await listening(ENV_PORT))) {
      throw new Failure(check, `something listens on ${ENV_PORT}: the .env was read`);
    }
    pass(check);
  } finally {
    await stop(started);
  }
}

/** A start in a folder outside git, with `todo` already in the list. */
async function startOutsideGit(install: Install) {
  const check = "outside git";
  const folder = join(install.folder, "notes");
  mkdirSync(folder);
  const port = await freePort();
  const started = start(install, ["--no-open", "--port", String(port)], folder);
  try {
    await line(check, started, port);
    const message = `uraeda: ${realpathSync(folder)} is not in a git repository: add one from the web UI\n`;
    if (!started.stderr().includes(message)) {
      throw new Failure(check, `stderr: ${started.stderr().trim()}`);
    }
    const root = await status(port, "/");
    expect(check, root === 200, `/ answered ${root}`);
  } finally {
    await stop(started);
  }
}

/**
 * The package's contents: the plugin with its copy of the skill, and the loader napi-rs generated,
 * unchanged, which the bundle imports next to it, never from the checkout.
 */
function contents(install: Install) {
  const plugin = ["plugin/skills/uraeda/SKILL.md", "plugin/.claude-plugin/plugin.json"];
  const missing = plugin.filter((file) => !existsSync(join(install.root, file)));
  expect("plugin", missing.length === 0, `missing ${missing.join(", ")}`);
  const loader = join(install.root, "dist/binding.js");
  const bundlePath = join(install.root, "dist/uraeda.mjs");
  const bundle = existsSync(bundlePath) ? readFileSync(bundlePath, "utf8") : "";
  expect(
    "loader",
    existsSync(loader) &&
      readFileSync(loader, "utf8") ===
        readFileSync(join(ROOT, "packages/binding/index.js"), "utf8") &&
      bundle.includes('import("./binding.js")') &&
      !bundle.includes(ROOT),
    "dist/binding.js is not the generated loader, or the bundle does not import it",
  );
}

async function main() {
  const { values } = parseArgs({
    options: { binding: { type: "string" }, platform: { type: "string" } },
  });
  const folder = realpathSync(mkdtempSync(join(tmpdir(), "uraeda-smoke-")));
  try {
    let installed: Install;
    try {
      installed = install(folder, values.binding, values.platform);
    } catch (error) {
      const output = (error as { stderr?: Buffer }).stderr?.toString().trim();
      throw new Failure("install", output || (error as Error).message);
    }
    contents(installed);
    commands(installed);
    if (installed.binding) {
      await startInRepository(installed);
      await startOutsideGit(installed);
    }
  } finally {
    for (const child of children) {
      child.kill("SIGKILL");
    }
    rmSync(folder, { force: true, recursive: true });
  }
}

try {
  await main();
} catch (error) {
  const check = (error as { check?: string }).check ?? "smoke";
  process.stdout.write(`failed ${check}: ${(error as Error).message}\n`);
  process.exitCode = 1;
}
