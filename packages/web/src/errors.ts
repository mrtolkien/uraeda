/**
 * A refusal from the core, as the server sends it: its kind, its message, and a hook's output.
 * The message starts with the core's code (see the server's `fate/errors.ts`).
 */
export type Refusal = {
  kind: "refused" | "conflict" | "hook";
  message: string;
  output?: string;
};

export function refusal(error: unknown): Refusal {
  const text = error instanceof Error ? error.message : String(error);
  const match = /^(refused|conflict|hook): ([\s\S]*)$/.exec(text);
  if (!match) {
    return { kind: "refused", message: text };
  }
  const kind = match[1] as Refusal["kind"];
  const [message, ...output] = match[2].split("\n\n");
  return { kind, message, output: output.length ? output.join("\n\n") : undefined };
}

/**
 * Runs a write that can fail beyond the core's refusals: a server error or a lost connection
 * rejects the request, instead of answering with an `error`. It resolves with that failure as the
 * result's `error`, so the page shows it as it shows a refusal.
 */
export async function guarded<R extends { error?: unknown }>(call: () => Promise<R>): Promise<R> {
  try {
    return await call();
  } catch (error) {
    const text = error instanceof Error ? error.message : String(error);
    return { error: new Error(`Could not write: ${text}`) } as R;
  }
}
