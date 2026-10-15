/**
 * `node packages/uraeda/scripts/release.ts prepare <tag>` and `... publish <tag>`: the npm side of a
 * release, run by `.github/workflows/npm.yml` once `napi artifacts` has put the four binaries in
 * their `packages/binding/npm/` folders.
 *
 * `prepare` checks the tag is the Cargo workspace's version, writes that version into the four
 * platform packages and `@uraeda/ui`, lists the platform packages in its `optionalDependencies`
 * at exactly that version, checks each platform package holds its binary, and prints the size of
 * each package, which is never a gate.
 *
 * `publish` publishes the platform packages, then `@uraeda/ui`, skipping each one npm already has at
 * that version, so a release that stopped part way is completed by running it again with the same
 * tag. A version with a prerelease suffix goes to the `next` dist-tag, never `latest`.
 */
import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync } from "node:fs";
import { join, resolve } from "node:path";

/** The checkout, for the Cargo workspace's version and the packages' folders. */
const ROOT = resolve(import.meta.dirname, "../../..");
const BINDING = join(ROOT, "packages/binding");
/** The platforms the toolchain decision supports, as napi-rs names them. */
const PLATFORMS = ["linux-x64-gnu", "linux-arm64-gnu", "darwin-x64", "darwin-arm64"];
/** The packages a release publishes, in the order it publishes them. */
const PACKAGES = [
  ...PLATFORMS.map((platform) => ({
    binary: `uraeda-binding.${platform}.node`,
    folder: join(BINDING, "npm", platform),
    name: `@uraeda/binding-${platform}`,
  })),
  { binary: null, folder: join(ROOT, "packages/uraeda"), name: "@uraeda/ui" },
];

/** The version a tag releases, and the dist-tag npm gives it. */
export type Release = { distTag: "latest" | "next"; version: string };

/** `v0.5.0` and `0.5.0` release `0.5.0` as `latest`; `v0.6.0-rc.1` releases `0.6.0-rc.1` as `next`. */
export function releaseOf(tag: string): Release {
  const match = /^v?(\d+\.\d+\.\d+(-[0-9A-Za-z.-]+)?)$/.exec(tag);
  if (!match) {
    throw new Error(`the tag ${tag} is not a version`);
  }
  return { distTag: match[2] ? "next" : "latest", version: match[1] };
}

/** The tag's release, when its version is the workspace's. */
export function checkVersion(tag: string, workspaceVersion: string): Release {
  const release = releaseOf(tag);
  if (release.version !== workspaceVersion) {
    throw new Error(`the tag ${tag} is not the workspace's version ${workspaceVersion}`);
  }
  return release;
}

/** The packages' names in the order they are published: every platform before `@uraeda/ui`. */
export function publishOrder(): Array<string> {
  return PACKAGES.map(({ name }) => name);
}

/** The Cargo workspace's version, which `version()` of the binding and `ura --version` print. */
export function cargoVersion(root = ROOT): string {
  const cargo = readFileSync(join(root, "Cargo.toml"), "utf8");
  const version = /^\[workspace\.package\][^[]*?^version = "([^"]+)"/m.exec(cargo)?.[1];
  if (!version) {
    throw new Error(`no [workspace.package] version in ${join(root, "Cargo.toml")}`);
  }
  return version;
}

/**
 * Runs npm in `cwd`, a package's folder: from the checkout's root, npm refuses to run, as the root's
 * `devEngines` asks for pnpm.
 */
function npm(args: Array<string>, cwd: string): string {
  return execFileSync("npm", args, { cwd, encoding: "utf8", stdio: ["ignore", "pipe", "inherit"] });
}

/** Checks the binaries, writes the version into the packages, and prints their sizes. */
function prepare(tag: string) {
  const { version } = checkVersion(tag, cargoVersion());
  for (const { binary, folder, name } of PACKAGES) {
    if (binary && !existsSync(join(folder, binary))) {
      throw new Error(`${name} has no ${binary}: run napi artifacts first`);
    }
  }
  // `napi version` copies the binding's version into the folders napi-rs generated.
  npm(["pkg", "set", `version=${version}`], BINDING);
  execFileSync(join(BINDING, "node_modules/.bin/napi"), ["version"], {
    cwd: BINDING,
    stdio: "inherit",
  });
  const optional = PACKAGES.filter(({ binary }) => binary).map(
    ({ name }) => `optionalDependencies.${name}=${version}`,
  );
  npm(["pkg", "set", `version=${version}`, ...optional], join(ROOT, "packages/uraeda"));
  for (const { folder, name } of PACKAGES) {
    const [packed] = JSON.parse(npm(["pack", "--dry-run", "--json"], folder)) as Array<{
      size: number;
      unpackedSize: number;
      version: string;
    }>;
    if (packed.version !== version) {
      throw new Error(`${name} holds version ${packed.version}, not ${version}`);
    }
    process.stdout.write(
      `${name}@${version}: ${packed.size} bytes packed, ${packed.unpackedSize} unpacked\n`,
    );
  }
}

/** Whether npm already has `name` at `version`: npm answers E404 for a version it does not have. */
function published(name: string, version: string, folder: string): boolean {
  const view = spawnSync("npm", ["view", `${name}@${version}`, "version"], {
    cwd: folder,
    encoding: "utf8",
  });
  if (view.status === 0) {
    return view.stdout.trim() !== "";
  }
  if (view.stderr.includes("E404")) {
    return false;
  }
  throw new Error(`npm view ${name}@${version} failed: ${view.stderr.trim()}`);
}

/** Publishes each package npm does not have at the tag's version, platforms first. */
function publish(tag: string) {
  const { distTag, version } = checkVersion(tag, cargoVersion());
  for (const { folder, name } of PACKAGES) {
    const { version: held } = JSON.parse(readFileSync(join(folder, "package.json"), "utf8")) as {
      version: string;
    };
    if (held !== version) {
      throw new Error(`${name} holds version ${held}, not ${version}: run prepare first`);
    }
    if (published(name, version, folder)) {
      process.stdout.write(`${name}@${version} is already on npm\n`);
      continue;
    }
    npm(["publish", "--provenance", "--access", "public", "--tag", distTag], folder);
    process.stdout.write(`${name}@${version} published as ${distTag}\n`);
  }
}

if (import.meta.main) {
  const [command, tag] = process.argv.slice(2);
  try {
    if (!tag || (command !== "prepare" && command !== "publish")) {
      throw new Error("usage: release.ts prepare|publish <tag>");
    }
    (command === "prepare" ? prepare : publish)(tag);
  } catch (error) {
    process.stderr.write(`release: ${(error as Error).message}\n`);
    process.exitCode = 1;
  }
}
