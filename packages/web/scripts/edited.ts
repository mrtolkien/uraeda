// A file edited for the length of a check, then restored: the validation scripts edit the
// repository's own files.
import { readFileSync, writeFileSync } from "node:fs";

/** The signals a script stopped by hand gets: Ctrl-C's, and `kill`'s. */
const SIGNALS = ["SIGINT", "SIGTERM"] as const;

/**
 * Writes `edit` of `file`'s text to it while `run` runs, then restores the file, also when the
 * script is stopped by SIGINT or SIGTERM meanwhile: it then exits as that signal would have, with
 * 128 and the signal's number.
 */
export async function whileEdited<T>(
  file: string,
  edit: (original: string) => string,
  run: () => Promise<T>,
): Promise<T> {
  const original = readFileSync(file, "utf8");
  const restore = () => writeFileSync(file, original);
  const stop = (signal: NodeJS.Signals) => {
    restore();
    process.exit(128 + (signal === "SIGINT" ? 2 : 15));
  };
  for (const signal of SIGNALS) {
    process.once(signal, stop);
  }
  try {
    writeFileSync(file, edit(original));
    return await run();
  } finally {
    for (const signal of SIGNALS) {
      process.off(signal, stop);
    }
    restore();
  }
}
