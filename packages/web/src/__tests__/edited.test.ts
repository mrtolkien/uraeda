// @vitest-environment node
// The validation scripts' edits of the repository's files: restored when the check ends, and when
// the script is stopped by a signal.
import { spawn } from "node:child_process";
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { temporaryFolder } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { whileEdited } from "../../scripts/edited.ts";

const MODULE = fileURLToPath(new URL("../../scripts/edited.ts", import.meta.url));

/** A file holding "original". */
function original(): string {
  const file = join(temporaryFolder("uraeda-edited"), "stories.tsx");
  writeFileSync(file, "original");
  return file;
}

test("the file is edited while the check runs, and restored when it fails", async () => {
  const file = original();

  const seen = whileEdited(
    file,
    (text) => `${text}, edited`,
    async () => {
      throw new Error(readFileSync(file, "utf8"));
    },
  );

  await expect(seen).rejects.toThrow("original, edited");
  expect(readFileSync(file, "utf8")).toBe("original");
});

test.each(["SIGINT", "SIGTERM"] as const)(
  "the file is restored when the script is stopped by %s",
  async (signal) => {
    const file = original();
    // A script that edits the file, says so, and waits until it is stopped.
    const script = `
      import { whileEdited } from ${JSON.stringify(MODULE)};
      await whileEdited(${JSON.stringify(file)}, () => "edited", () => new Promise(() => {
        setInterval(() => {}, 1000);
        process.stdout.write("edited\\n");
      }));
    `;
    const child = spawn(process.execPath, ["--input-type=module", "--eval", script]);
    await new Promise<void>((resolve) => child.stdout.once("data", () => resolve()));
    expect(readFileSync(file, "utf8")).toBe("edited");

    const exited = new Promise((resolve) => child.once("exit", (code, by) => resolve(code ?? by)));
    child.kill(signal);

    expect(await exited).not.toBe(0);
    expect(readFileSync(file, "utf8")).toBe("original");
  },
);
