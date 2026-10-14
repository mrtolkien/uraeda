// A second start's side of the handoff: it asks the server already on the port to open its folder,
// and never touches the list or the session cache itself (R3).
import type { OpenAnswer, OpenRequest } from "./open.ts";

/** What the server on the port did: opened the folder, refused it, or is another program. */
export type HandOff =
  | { kind: "opened"; url: string }
  | { error: string; kind: "refused" }
  | { kind: "other" };

/**
 * Asks the server on 127.0.0.1:`port` to open `request.folder`, within `timeoutMs`, 2000 by
 * default. "refused" for a 400 with an `error`; "other" for a refused connection, a timeout, or an
 * answer without `uraeda`.
 */
export async function handOff(
  port: number,
  request: OpenRequest,
  timeoutMs = 2000,
): Promise<HandOff> {
  try {
    const response = await fetch(`http://127.0.0.1:${port}/open`, {
      body: JSON.stringify(request),
      headers: { "content-type": "application/json" },
      method: "POST",
      signal: AbortSignal.timeout(timeoutMs),
    });
    const body = (await response.json().catch(() => null)) as Partial<
      OpenAnswer & { error: string }
    > | null;
    if (response.status === 400 && typeof body?.error === "string") {
      return { error: body.error, kind: "refused" };
    }
    if (response.ok && typeof body?.uraeda === "string" && typeof body.url === "string") {
      return { kind: "opened", url: body.url };
    }
  } catch {
    // A refused connection or a timeout: not a server that answers.
  }
  return { kind: "other" };
}
