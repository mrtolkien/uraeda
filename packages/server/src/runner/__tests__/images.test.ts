import { mkdtempSync, readdirSync, rmSync, utimesSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { afterEach, expect, test } from "vite-plus/test";
import { ChatImages, UNSENT_KEPT_MS } from "../images.ts";

const dirs: Array<string> = [];

afterEach(() => {
  for (const dir of dirs.splice(0)) {
    rmSync(dir, { recursive: true, force: true });
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
  width: 2,
  height: 1,
});

test("saves an image under a new ID, and resolves only IDs", async () => {
  const store = images();

  const image = await store.save(encoded("gif"));

  expect(image).toMatchObject({ width: 2, height: 1 });
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
