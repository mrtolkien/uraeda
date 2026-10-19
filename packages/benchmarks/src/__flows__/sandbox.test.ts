import { execFileSync } from "node:child_process";
import { chmodSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { makeConfigDir, upstreamHosts } from "../config-dir.ts";
import { writeWrapper } from "../docker-wrapper.ts";
import { temporary, write } from "./harness.ts";

/** The arguments the wrapper gives docker, which a fake `docker` writes one per line. */
function wrapperArguments(env: Record<string, string>): Array<string> {
  const bin = temporary("flow-docker-");
  const log = join(bin, "args");
  write(join(bin, "docker"), `#!/bin/sh\nprintf '%s\\n' "$@" > '${log}'\n`);
  chmodSync(join(bin, "docker"), 0o755);
  const wrapper = writeWrapper({
    bareOrigin: "/bare/origin.git",
    claude: "/host/claude",
    configDir: "/cfg",
    image: "image:tag",
    label: "run-1",
    path: join(bin, "wrapper"),
    repository: "/host/repo",
  });
  execFileSync(wrapper, ["-p", "--plugin-dir", "/plugin"], {
    env: { ...process.env, ...env, PATH: `${bin}:${process.env.PATH}` },
  });
  return readFileSync(log, "utf8").split("\n").filter(Boolean);
}

test("the container gets the token by name, and neither its value nor the host's credentials", () => {
  const args = wrapperArguments({ CLAUDE_CODE_OAUTH_TOKEN: "secret-value" });

  expect(args).toContain("CLAUDE_CODE_OAUTH_TOKEN");
  expect(args.join(" ")).not.toContain("secret-value");
  expect(args.join(" ")).not.toContain(".claude");
});

test("the run's settings pin every role to the model asked for, with no fallback, and deny the upstream's hosts", () => {
  const folder = makeConfigDir({
    deniedHosts: upstreamHosts("https://github.com/ansible/ansible"),
    effort: "medium",
    folder: join(temporary(), "config"),
    model: "claude-sonnet-5-5",
  });

  const settings = JSON.parse(readFileSync(join(folder, "settings.json"), "utf8"));

  expect(settings).toMatchObject({
    effort: "medium",
    env: {
      ANTHROPIC_SMALL_FAST_MODEL: "claude-sonnet-5-5",
      CLAUDE_CODE_SUBAGENT_MODEL: "claude-sonnet-5-5",
    },
    model: "claude-sonnet-5-5",
    switchModelsOnFlag: false,
  });
  expect(settings.permissions.deny).toContain("WebFetch(domain:github.com)");
  expect(settings.permissions.deny).toContain("WebFetch(domain:raw.githubusercontent.com)");
});
