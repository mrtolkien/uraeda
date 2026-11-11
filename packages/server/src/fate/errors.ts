import { FateRequestError } from "@nkzw/fate/server";
import { REFUSAL_CODE as REFUSAL } from "../reason.ts";

/**
 * The binding's refusal as an error the client handles where it called: its message keeps the
 * core's code, `refused: `, `conflict: `, or `hook: ` with the hook's output after a blank line.
 */
export function callSiteError(error: unknown): FateRequestError {
  const message = error instanceof Error ? error.message : String(error);
  return new FateRequestError("BAD_REQUEST", message);
}

/**
 * Runs a binding call, turning its refusals into call-site errors. Any other error is a failure of
 * the server, not a refusal: it is logged, and sent as an internal error.
 */
export async function refusable<T>(call: () => Promise<T>): Promise<T> {
  try {
    return await call();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    if (REFUSAL.test(message)) {
      throw callSiteError(error);
    }
    process.stderr.write(
      `A binding call failed: ${error instanceof Error ? error.stack : message}\n`,
    );
    throw new FateRequestError("INTERNAL_ERROR", message);
  }
}

/**
 * Runs a write of the settings file, a file that cannot be read refused with its problem: the
 * binding's `unreadable: ` is a refusal here, as the page shows it where it wrote.
 */
export function settingsWrite(write: () => Promise<void>): Promise<void> {
  return refusable(async () => {
    try {
      await write();
    } catch (error) {
      const message = error instanceof Error ? error.message : String(error);
      throw /^unreadable: /.test(message)
        ? new Error(message.replace(/^unreadable: /, "refused: "))
        : error;
    }
  });
}
