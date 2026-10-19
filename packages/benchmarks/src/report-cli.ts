import { dirname, join } from "node:path";
import { writeReport } from "./report.ts";

/** `vp run benchmarks:report`: the page, written from `benchmarks/runs/` and opened. */
const root = join(dirname(new URL(import.meta.url).pathname), "../../../benchmarks");
const result = writeReport(root);
process.stdout.write(
  "empty" in result
    ? "Nothing to show: benchmarks/runs/ holds no run yet.\n"
    : result.opened
      ? `Opened ${result.path}\n`
      : `Written to ${result.path}\n`,
);
