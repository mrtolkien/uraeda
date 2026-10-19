import { expect, test } from "vite-plus/test";
import { type Check, runProbe } from "../probe.ts";

const failing = (name: string): Check => ({
  name,
  run: async () => {
    throw new Error("broken");
  },
});
const needsToken = (name: string): Check => ({ name, run: async () => {}, token: true });

test("a failed check exits non-zero and names the check", async () => {
  const result = await runProbe({ checks: [failing("not logged in")], env: {} });

  expect(result.exitCode).toBe(1);
  expect(result.lines).toContain("FAIL not logged in: broken");
});

test("a check that needs the token is skipped, not passed, without it", async () => {
  const result = await runProbe({ checks: [needsToken("auto mode")], env: {} });

  expect(result.lines).toContain("SKIPPED auto mode: CLAUDE_CODE_OAUTH_TOKEN is not set");
  expect(result.exitCode).toBe(2);
});

test("every check passing exits zero, and the token runs its checks", async () => {
  const result = await runProbe({
    checks: [needsToken("auto mode")],
    env: { CLAUDE_CODE_OAUTH_TOKEN: "x" },
  });

  expect(result).toEqual({ exitCode: 0, lines: ["ok auto mode"] });
});
