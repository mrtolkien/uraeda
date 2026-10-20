// The sandbox's tests' helpers: its Vite server, served as `vp run sandbox` serves it, fate's
// requests to it without a cookie, and the environment the sandbox's command sets.
import { createLogger, createServer } from "vite-plus";
import { expect, vi } from "vite-plus/test";
import { SAMPLE_FOLDERS } from "../../samples/index.ts";
import { sandboxConfig } from "../../vite.sandbox.config.ts";

/** A sandbox served on a free port, the lines it logged, and its address. */
export type Served = {
  close: () => Promise<void>;
  lines: Array<string>;
  port: number;
  url: string;
};

/**
 * The sandbox's Vite server for the checkout `checkout`, whose `.env` it must not read, on a port
 * the system picks: the tests of several checkouts run at once.
 */
export async function serveSandbox(checkout: string): Promise<Served> {
  const lines: Array<string> = [];
  const logger = createLogger("silent");
  logger.info = (message) => void lines.push(message);
  const server = await createServer({
    ...sandboxConfig({ checkout, port: 0 }),
    configFile: false,
    customLogger: logger,
  });
  await server.listen();
  const address = server.httpServer?.address();
  const port = typeof address === "object" && address !== null ? address.port : 0;
  return { close: () => server.close(), lines, port, url: `http://127.0.0.1:${port}/` };
}

/** A fate operation's result, as the endpoint answers it. */
export type FateResult = {
  data?: Array<unknown>;
  error?: { code: string; message: string };
  ok: boolean;
};

/** The list of repositories, as fate reads it. */
export type RepositoryRows = { rows: Array<{ name: string }> };

/** The first record a read returned, of the shape the test selected. */
export function first<T>(result: FateResult | undefined): T {
  return result?.data?.[0] as T;
}

/**
 * Sends fate operations to a repository's endpoint, or the global one for a null name, as the
 * page does but without a cookie: returns the response's status and the results in order.
 */
export async function fateAt(
  url: string,
  name: string | null,
  operations: Array<Record<string, unknown>>,
): Promise<{ results: Array<FateResult>; status: number }> {
  const response = await fetch(new URL(name === null ? "fate" : `r/${name}/fate`, url), {
    body: JSON.stringify({
      operations: operations.map((operation, index) => ({ id: String(index), ...operation })),
      version: 1,
    }),
    headers: { "content-type": "application/json", origin: new URL(url).origin },
    method: "POST",
  });
  const { results } = (await response.json()) as { results: Array<FateResult> };
  return { results, status: response.status };
}

/** The sample's sessions, as the sessions page lists them. */
async function sessions(served: Served): Promise<Array<{ folder: string | null; status: string }>> {
  const { results } = await fateAt(served.url, "sample", [
    { ids: ["all"], kind: "byId", select: ["id", "rows"], type: "SessionList" },
  ]);
  return first<{ rows?: Array<{ folder: string | null; status: string }> }>(results[0])?.rows ?? [];
}

/**
 * Waits for the implementation feature's session to be at work, as the sandbox starts it: its
 * workflow message reads the feature while Home's first reads run, which takes seconds.
 */
export async function waitAtWork(served: Served) {
  await vi.waitFor(
    async () => {
      const rows = await sessions(served);
      const implementation = rows.find(
        (row) => row.folder === SAMPLE_FOLDERS.features.implementation,
      );
      expect(implementation?.status).toBe("working");
    },
    { interval: 200, timeout: 60_000 },
  );
}

/** Sets each of `values` in this process's environment, an undefined one unset. */
function applyEnv(values: Record<string, string | undefined>) {
  for (const [name, value] of Object.entries(values)) {
    if (value === undefined) {
      delete process.env[name];
    } else {
      process.env[name] = value;
    }
  }
}

/** Sets `variables` in this process's environment, an undefined one unset: returns the undo. */
export function setEnv(variables: Record<string, string | undefined>): () => void {
  const before = Object.fromEntries(
    Object.keys(variables).map((name) => [name, process.env[name]]),
  );
  applyEnv(variables);
  return () => applyEnv(before);
}
