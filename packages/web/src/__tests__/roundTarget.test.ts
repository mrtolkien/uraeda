// R22 and R39: the hash the triage's saves are based on, as the page reads and writes the text.
import { expect, test } from "vite-plus/test";
import { Hashes } from "../roundTarget.ts";

test("a read once the page's writes are done is taken, a text the page had before included", async () => {
  const hashes = new Hashes("A");
  await hashes.serial(async () => hashes.wrote("B"));

  // Another page put the text back as it was first.
  hashes.read("A");

  expect(hashes.current).toBe("A");
});

test("a read drawn while a write is sent may be older than it, and the write's hash wins", async () => {
  const hashes = new Hashes("A");
  const answer = Promise.withResolvers<void>();
  const write = hashes.serial(async (base) => {
    await answer.promise;
    hashes.wrote("B");
    return base;
  });
  await Promise.resolve();

  hashes.read("A");
  answer.resolve();

  expect(await write).toBe("A");

  expect(hashes.current).toBe("B");
});

test("a read drawn while a write is sent is taken once the write wrote nothing", async () => {
  const hashes = new Hashes("A");
  const answer = Promise.withResolvers<void>();
  const write = hashes.serial(() => answer.promise);
  await Promise.resolve();

  hashes.read("C");
  answer.reject(new Error("conflict"));
  await expect(write).rejects.toThrow("conflict");

  expect(hashes.current).toBe("C");
  expect(await hashes.serial(async (base) => base)).toBe("C");
});
