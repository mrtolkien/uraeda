/** One check of what the benchmark relies on outside this repository. */
export type Check = {
  name: string;
  /** Throws a message when the check fails. */
  run: () => Promise<void>;
  /** The check needs the subscription token, and is skipped without it. */
  token?: boolean;
};

export type ProbeResult = {
  /** 0 when every check passed, 1 when one failed, 2 when none failed and one was skipped. */
  exitCode: 0 | 1 | 2;
  lines: Array<string>;
};

const TOKEN = "CLAUDE_CODE_OAUTH_TOKEN";

/** Runs the checks in order. A skipped check is never a pass: later work must not rely on it. */
export async function runProbe({
  checks,
  env,
}: {
  checks: Array<Check>;
  env: Record<string, string | undefined>;
}): Promise<ProbeResult> {
  const lines: Array<string> = [];
  let failed = false;
  let skipped = false;
  for (const check of checks) {
    if (check.token && !env[TOKEN]) {
      skipped = true;
      lines.push(`SKIPPED ${check.name}: ${TOKEN} is not set`);
      continue;
    }
    try {
      await check.run();
      lines.push(`ok ${check.name}`);
    } catch (error) {
      failed = true;
      lines.push(`FAIL ${check.name}: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  return { exitCode: failed ? 1 : skipped ? 2 : 0, lines };
}
