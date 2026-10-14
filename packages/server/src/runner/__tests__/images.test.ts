import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  rmSync,
  statSync,
  utimesSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { isAbsolute, join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { ChatImages, UNSENT_KEPT_MS } from "../images.ts";

const dirs: Array<string> = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { force: true, recursive: true });
  }
});

function images() {
  const dir = mkdtempSync(join(tmpdir(), "uraeda-images-"));
  dirs.push(dir);
  return new ChatImages(join(dir, "images"));
}

const encoded = (extension: "webp" | "gif") => ({
  bytes: Buffer.from("RIFF....WEBP"),
  extension,
  height: 1,
  width: 2,
});

test("saves an image under a new ID, and resolves only IDs", async () => {
  const store = images();

  const image = await store.save(encoded("gif"));

  expect(image).toMatchObject({ height: 1, width: 2 });
  expect(image.id).toMatch(/^[0-9a-f-]{36}\.gif$/);
  expect(store.path(image.id)).toBe(join(store.dir, image.id));
  expect(store.path("../runner.sqlite")).toBeUndefined();
  await store.remove(image.id);
  expect(store.path(image.id)).toBeUndefined();
  await store.remove(image.id);
});

test("cleans images no message holds, once a day old", async () => {
  const store = images();
  const now = Date.now();
  const [held, old, recent] = [
    await store.save(encoded("webp")),
    await store.save(encoded("webp")),
    await store.save(encoded("webp")),
  ];
  const dayAgo = (now - UNSENT_KEPT_MS - 1000) / 1000;
  for (const { id } of [held, old]) {
    utimesSync(join(store.dir, id), dayAgo, dayAgo);
  }

  await store.clean(new Set([held.id]), now);

  expect(readdirSync(store.dir).sort()).toEqual([held.id, recent.id].sort());
});

test("cleaning a data folder without images does nothing", async () => {
  await expect(images().clean(new Set(), Date.now())).resolves.toBeUndefined();
});

test("an image that cannot be written is refused with the system's error", async () => {
  const store = images();
  // The images folder is a file.
  writeFileSync(store.dir, "");

  await expect(store.save(encoded("webp"))).rejects.toThrow(
    /^refused: The image could not be saved: E[A-Z]+: .+\.$/,
  );
});

test("the images folder and its files are the owner's only", async () => {
  const store = images();

  const { id } = await store.save(encoded("webp"));

  expect(statSync(store.dir).mode & 0o777).toBe(0o700);
  expect(statSync(join(store.dir, id)).mode & 0o777).toBe(0o600);
});

test("a relative images folder is made absolute: the agent runs in another folder", () => {
  const store = new ChatImages(join(".uraeda", "images"));

  expect(isAbsolute(store.dir)).toBe(true);
  expect(store.dir).toBe(join(process.cwd(), ".uraeda", "images"));
});

test("an image that cannot be deleted is skipped, and the others are cleaned", async () => {
  const store = images();
  const now = Date.now();
  const old = await store.save(encoded("webp"));
  // A folder named like an image: removing it fails.
  const stuck = "0b9f9c4e-6a4f-4f3e-9d1e-2a7c1f0e5b3a.webp";
  mkdirSync(join(store.dir, stuck));
  const dayAgo = (now - UNSENT_KEPT_MS - 1000) / 1000;
  for (const id of [old.id, stuck]) {
    utimesSync(join(store.dir, id), dayAgo, dayAgo);
  }

  await expect(store.clean(new Set(), now)).resolves.toBeUndefined();

  expect(readdirSync(store.dir)).toEqual([stuck]);
});
