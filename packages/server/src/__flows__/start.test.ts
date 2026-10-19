// The server as a user starts it, `main.ts` in its own process: the stack decision's rule that it
// listens on the loopback interface only, the sign-in decision's rule that the key is shown once,
// and a second start that hands its repository to the one running.
import { type ChildProcessWithoutNullStreams, spawn } from "node:child_process";
import { existsSync, readdirSync, readFileSync, realpathSync } from "node:fs";
import { connect } from "node:net";
import { networkInterfaces } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vite-plus/test";
import { readRepositories } from "uraeda-binding";
import { fixtureRepo, temporaryFolder } from "uraeda-binding/test-utils";
import { devServer } from "../dev.ts";
import { loadEnv } from "../env.ts";
import { freePort } from "../free-port.ts";

const MAIN = fileURLToPath(new URL("../main.ts", import.meta.url));
const KEY = /ura_[\w-]+/;

type Started = {
  child: ChildProcessWithoutNullStreams;
  exited: Promise<number | null>;
  output: { stderr: string; stdout: string };
};

const children: Array<Started> = [];

afterEach(async () => {
  for (const { child, exited } of children.splice(0)) {
    child.kill("SIGTERM");
    await exited;
  }
});

/** `main.ts` in its own process, no browser opened, on a data and config folder of its own. */
function start(args: Array<string>, folders: { config: string; data: string }): Started {
  const child = spawn(process.execPath, [MAIN, "--no-open", ...args], {
    env: { ...process.env, URAEDA_CONFIG_DIR: folders.config, URAEDA_DATA_DIR: folders.data },
  });
  const output = { stderr: "", stdout: "" };
  child.stdout.on("data", (chunk) => (output.stdout += chunk));
  child.stderr.on("data", (chunk) => (output.stderr += chunk));
  const started = {
    child,
    exited: new Promise<number | null>((resolve) => child.on("exit", resolve)),
    output,
  };
  children.push(started);
  return started;
}

/** Resolves once the process says it serves, rejects if it exits first. */
function serving({ child, output }: Started): Promise<void> {
  return new Promise((resolve, reject) => {
    const check = () => KEY.test(output.stdout) && resolve();
    child.stdout.on("data", check);
    child.on("exit", (code) => reject(new Error(`exited ${code}: ${output.stderr}`)));
    check();
  });
}

/** A first start on a repository, a free port, and new folders. */
async function firstStart() {
  const folders = {
    config: temporaryFolder("uraeda-config"),
    data: temporaryFolder("uraeda-data"),
  };
  const port = await freePort();
  const repo = fixtureRepo();
  const server = start(["--repo", repo, "--port", String(port)], folders);
  await serving(server);
  return { folders, port, repo, server };
}

/** Whether a connection to `host:port` opens. */
const opens = (host: string, port: number) =>
  new Promise<boolean>((resolve) => {
    const socket = connect({ host, port }, () => {
      socket.destroy();
      resolve(true);
    });
    socket.on("error", () => resolve(false));
  });

const external = Object.values(networkInterfaces())
  .flat()
  .find((address) => address && !address.internal && address.family === "IPv4")?.address;

test("the server listens on the loopback interface only", async () => {
  const { port } = await firstStart();

  expect(await opens("127.0.0.1", port)).toBe(true);
  // Another address of this machine is refused, which a listener on every interface would not.
  if (external !== undefined) {
    expect(await opens(external, port)).toBe(false);
  }
});

test("the dev server listens on the loopback interface only, whatever the variables say", () => {
  const given = loadEnv(null, { URAEDA_ALLOWED_HOSTS: "mac.example", URAEDA_PORT: "4400" });

  expect(devServer(given).host).toBe("127.0.0.1");
  expect(devServer(loadEnv(null, {})).host).toBe("127.0.0.1");
});

test("the key is shown once, signs in, and a second start shows none and hands over", async () => {
  const { folders, port, repo, server } = await firstStart();
  const key = KEY.exec(server.output.stdout)![0];

  const signIn = await fetch(`http://127.0.0.1:${port}/session`, {
    body: JSON.stringify({ key }),
    headers: { "content-type": "application/json" },
    method: "POST",
  });
  const second = start(["--repo", repo, "--port", String(port)], folders);

  expect(signIn.status).toBe(204);
  expect(await second.exited).toBe(0);
  expect(second.output.stdout).not.toMatch(KEY);
  // The key is stored as a hash, never as it was shown.
  for (const file of readdirSync(folders.data, { recursive: true, withFileTypes: true })) {
    if (file.isFile()) {
      expect(readFileSync(join(file.parentPath, file.name), "utf8")).not.toContain(key);
    }
  }
});

test("a start in a repository lists it, and a start of the same one lists it once", async () => {
  const { folders, port, repo } = await firstStart();

  const second = start(["--repo", repo, "--port", String(port)], folders);
  await second.exited;

  const listed = (await readRepositories(folders.data)).map((row) => row.path);
  expect(listed).toEqual([realpathSync(repo)]);
});

test("a start that fails shows no key and leaves none, and the next start shows one", async () => {
  const folders = {
    config: temporaryFolder("uraeda-config"),
    data: temporaryFolder("uraeda-data"),
  };
  const port = await freePort();

  const failed = start(
    ["--repo", temporaryFolder("uraeda-not-git"), "--port", String(port)],
    folders,
  );

  expect(await failed.exited).toBe(1);
  expect(failed.output.stdout).not.toMatch(KEY);
  expect(existsSync(join(folders.data, "sign-in.json"))).toBe(false);
  const next = start(["--repo", fixtureRepo(), "--port", String(port)], folders);
  await serving(next);
  expect(next.output.stdout).toMatch(KEY);
});

test("a second start with another data folder is refused: it holds no token of the running one", async () => {
  const { port, repo } = await firstStart();
  const strange = {
    config: temporaryFolder("uraeda-config"),
    data: temporaryFolder("uraeda-data"),
  };

  const second = start(["--repo", repo, "--port", String(port)], strange);

  expect(await second.exited).toBe(1);
});

test("stopping the server ends it and frees its port", async () => {
  const { folders, port, server } = await firstStart();
  const run = join(folders.data, "run");
  expect(existsSync(run)).toBe(true);

  server.child.kill("SIGTERM");

  expect(await server.exited).toBe(0);
  expect(await opens("127.0.0.1", port)).toBe(false);
  // The token that let a second start in goes with it.
  expect(existsSync(run) ? readdirSync(run).filter((name) => name.endsWith(".token")) : []).toEqual(
    [],
  );
});
