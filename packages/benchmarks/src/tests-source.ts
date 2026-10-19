import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";

const RAW = "https://raw.githubusercontent.com/scaleapi/SWE-bench_Pro-os";
/** The files of a task's verifier: its tests folder, which no session of a run ever sees. */
export const VERIFIER_FILES = [
  "test.sh",
  "run_script.sh",
  "parser.py",
  "config.json",
  "test_patch.patch",
];

/** Downloads a V2 task's verifier files into `folder`, from the benchmark's repository at `ref`. */
export async function fetchVerifier(task: string, folder: string, ref = "main"): Promise<void> {
  mkdirSync(folder, { recursive: true });
  for (const file of VERIFIER_FILES) {
    const response = await fetch(`${RAW}/${ref}/v2/tasks/${task}/tests/${file}`);
    if (!response.ok) {
      throw new Error(`${task}: ${file}: ${response.status}`);
    }
    writeFileSync(join(folder, file), Buffer.from(await response.arrayBuffer()));
  }
}

/** Downloads a V2 task's instruction: the text of its proposal, from the benchmark's repository. */
export async function fetchInstruction(task: string, ref = "main"): Promise<string> {
  const response = await fetch(`${RAW}/${ref}/v2/tasks/${task}/instruction.md`);
  if (!response.ok) {
    throw new Error(`${task}: instruction.md: ${response.status}`);
  }
  return response.text();
}
