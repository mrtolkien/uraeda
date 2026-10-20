import { spawnSync } from "node:child_process";
import { mkdtempSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { afterEach, expect, test } from "vite-plus/test";

const root = fileURLToPath(new URL("../..", import.meta.url));
const folders: Array<string> = [];
afterEach(() =>
  folders.splice(0).forEach((path) => rmSync(path, { force: true, recursive: true })),
);

/**
 * Runs the fast runner's `runFocused` over one stub family, `stub`, whose only test file is
 * `body`, in a process of its own (through `test-run.ts`, which stops a run past its time with its
 * workers). Prints the exit code it returns, or its error.
 */
function focused(body: string, selected: Array<string> = ["stub"]) {
  const folder = mkdtempSync(join(tmpdir(), "fast-guards-"));
  folders.push(folder);
  writeFileSync(join(folder, "stub.test.ts"), body);
  const code = `
import {runFocused} from "./scripts/fast-check.ts";
const file=${JSON.stringify(join(folder, "stub.test.ts"))};
const test={globals:true,maxWorkers:1,projects:[{extends:false,root:${JSON.stringify(folder)},test:{globals:true,include:["stub.test.ts"],name:"fast-stub"}}],watch:false};
try {
  const code=await runFocused({related:[file],test},{families:${JSON.stringify(selected)}});
  process.stdout.write("EXIT "+code+"\\n");
} catch (error) {
  process.stdout.write("THROWN "+(error instanceof Error?error.message:String(error))+"\\n");
}
`;
  const result = spawnSync(
    process.execPath,
    [join(root, "scripts/test-run.ts"), process.execPath, "--input-type=module", "-e", code],
    { cwd: root, encoding: "utf8", timeout: 120_000 },
  );
  return { output: result.stdout, status: result.status, stderr: result.stderr };
}

test("a passing focused test exits zero", () => {
  const { output, stderr } = focused(`test("passes", () => {});`);
  expect(output, stderr).toContain("EXIT 0");
});

test("a failing focused test makes the run exit nonzero", () => {
  const { output, stderr } = focused(`test("fails", () => { throw new Error("broken"); });`);
  expect(output, stderr).toContain("EXIT 1");
});

test("an error no test caught makes the run exit nonzero", () => {
  const { output, stderr } = focused(`
test("passes, then something throws", async () => {
  process.nextTick(() => { throw new Error("unhandled after the test"); });
  await new Promise((done) => setImmediate(done));
});`);
  expect(output, stderr).toContain("EXIT 1");
});

test("a selected family with no discovered tests fails the run", () => {
  const { output, stderr } = focused(`test("passes", () => {});`, ["stub", "absent"]);
  expect(output, stderr).toContain("THROWN Selected families discovered no tests: absent");
});

test("a selection that discovers nothing reports it and defers, without failing", () => {
  const { output, stderr } = focused(`test("passes", () => {});`, []);
  expect(output, stderr).toContain("EXIT 0");
});
