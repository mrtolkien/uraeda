import { FateRequestError } from "@nkzw/fate/server";

/**
 * The binding's refusal as an error the client handles where it called: its message keeps the
 * core's code, `refused: `, `conflict: `, or `hook: ` with the hook's output after a blank line.
 */
export function callSiteError(error: unknown): FateRequestError {
  const message = error instanceof Error ? error.message : String(error);
  return new FateRequestError("BAD_REQUEST", message);
}

/** Runs a binding call, turning its refusals into call-site errors. */
export async function refusable<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    throw callSiteError(error);
  }
}
