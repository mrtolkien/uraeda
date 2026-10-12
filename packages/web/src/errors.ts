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
