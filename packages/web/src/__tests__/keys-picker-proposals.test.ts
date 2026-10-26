// The picker's proposal reads (US4): they stop once the picker no longer waits for them, and one
// proposal that cannot be read leaves the others' previews.
import { expect, test, vi } from "vite-plus/test";
import { readProposals } from "../keys/pickerSources.ts";

const FOLDERS = ["a", "b", "c"];
const read = (ref: string) => Promise.resolve({ folder: ref, text: `text of ${ref}` });

test("every proposal read gives its text, and none failed", async () => {
  const result = await readProposals(FOLDERS, FOLDERS, read, () => true);

  expect([...(result?.texts ?? [])]).toEqual([
    ["a", "text of a"],
    ["b", "text of b"],
    ["c", "text of c"],
  ]);
  expect(result?.failed.size).toBe(0);
});

// Break: the loop reading every folder after the picker closed.
test("the loop stops reading once the picker closed", async () => {
  let isCurrent = true;
  const one = vi.fn(async (ref: string) => {
    isCurrent = false;
    return read(ref);
  });

  const result = await readProposals(FOLDERS, FOLDERS, one, () => isCurrent);

  expect(result).toBeNull();
  expect(one).toHaveBeenCalledTimes(1);
});

// Break: one failed read throwing away the loaded ones.
test("a proposal that cannot be read fails its own preview, and the others load", async () => {
  const result = await readProposals(
    FOLDERS,
    FOLDERS,
    (ref) => (ref === "b" ? Promise.reject(new Error("gone")) : read(ref)),
    () => true,
  );

  expect([...(result?.texts.keys() ?? [])]).toEqual(["a", "c"]);
  expect([...(result?.failed ?? [])]).toEqual(["b"]);
});
