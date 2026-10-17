/**
 * Prints the lines covered per language, from the lcov files `vp run coverage` writes:
 * `coverage/rust.lcov` and `coverage/typescript/lcov.info`. A report, never a check: it fails only
 * when a file is missing.
 */
import { readFileSync } from "node:fs";
import { join } from "node:path";

/** One source file of an lcov report: its path, its lines found, and the ones run. */
type SourceFile = { file: string; found: number; hit: number };

function records(lcov: string): Array<SourceFile> {
  return lcov
    .split("end_of_record")
    .map((text) => ({
      file: /^SF:(.*)$/m.exec(text)?.[1] ?? "",
      found: Number(/^LF:(\d+)$/m.exec(text)?.[1] ?? 0),
      hit: Number(/^LH:(\d+)$/m.exec(text)?.[1] ?? 0),
    }))
    .filter(({ file }) => file);
}

function percent(files: Array<SourceFile>): string {
  const found = files.reduce((sum, { found }) => sum + found, 0);
  const hit = files.reduce((sum, { hit }) => sum + hit, 0);
  return `${(found ? (hit / found) * 100 : 0).toFixed(1)}%`;
}

/**
 * The summary's lines. The CLI tests spawn `ura`: when no line of its `main.rs` is covered, its runs
 * were not counted, and the Rust total says so.
 */
export function summary(rust: string, typescript: string): Array<string> {
  const rustFiles = records(rust);
  const uraCounted = rustFiles.some(
    ({ file, hit }) => file.replaceAll("\\", "/").endsWith("/crates/cli/src/main.rs") && hit > 0,
  );
  return [
    `Rust: ${percent(rustFiles)} of lines`,
    ...(uraCounted ? [] : ["The `ura` binary run by the CLI tests is not counted."]),
    `TypeScript: ${percent(records(typescript))} of lines`,
  ];
}

if (import.meta.main) {
  const root = join(import.meta.dirname, "..");
  const read = (path: string) => readFileSync(join(root, path), "utf8");
  const lines = summary(read("coverage/rust.lcov"), read("coverage/typescript/lcov.info"));
  process.stdout.write(`${lines.join("\n")}\nThe HTML reports: vp run coverage:open\n`);
}
