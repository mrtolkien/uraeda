// A note's image taken out of its draft by the core, over the draft's version, its file left, and
// its Undo, which puts the line back where it was.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { expect, test } from "vite-plus/test";
import { byId, fixture, fixtureRepo, mutate, port, testApp } from "./helpers.ts";

const INBOX = ["id", "hash", "categories", "names", "count", "changes", "triage"];
const DRAFT = "specs/drafts/headings-are-flat/proposal.md";
const FIRST = "specs/drafts/headings-are-flat/images/first.webp";

type Served = Awaited<ReturnType<typeof testApp>>;

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

/** Adds the note with two images, as the add form does. */
async function withTwoImages(served: Served) {
  const [inbox] = await byId(served.app, "Inbox", ["inbox"], ["id", "hash"]);
  const body = new FormData();
  body.set("hash", inbox.hash);
  body.set("text", "Headings are flat");
  for (const _ of [1, 2]) {
    body.append("file", new File([readFileSync(fixture("images/phone.png"))], "phone.png"));
  }
  const query = new URLSearchParams([
    ["name", "first.png"],
    ["name", "second.png"],
  ]);
  const response = await served.app.request(
    `http://127.0.0.1:${port}/r/${served.name}/inbox/note-image?${query}`,
    { body, method: "POST" },
  );
  expect(response.status).toBe(200);
}

/** The draft's hash, as the page reads it. */
const draftHash = async (served: Served) =>
  (await byId(served.app, "Draft", [DRAFT], ["id", "hash"]))[0].hash as string;

/** The images of the note that links the draft. */
const imagesOf = (inbox: { categories: Array<{ notes: Array<Record<string, unknown>> }> }) =>
  inbox.categories.flatMap((category) => category.notes).find((note) => note.draft === DRAFT)
    ?.images;

test("an image leaves its note's draft, its file kept, and its Undo puts it back", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  await withTwoImages(served);
  const before = read(repo, DRAFT);

  const removed = await mutate(
    served.app,
    "inbox.removeImage",
    { draft: DRAFT, hash: await draftHash(served), image: FIRST },
    [...INBOX, "imageRemoved"],
  );

  expect(removed.ok).toBe(true);
  expect(read(repo, DRAFT)).toBe(before.replace("\n\n![first](images/first.webp)", ""));
  expect(existsSync(join(repo, FIRST))).toBe(true);
  expect(imagesOf(removed.data)).toEqual(["specs/drafts/headings-are-flat/images/second.webp"]);
  expect(removed.data.imageRemoved).toMatchObject({ draft: DRAFT, image: FIRST });

  const restored = await mutate(
    served.app,
    "inbox.restoreImage",
    { removed: removed.data.imageRemoved },
    INBOX,
  );

  expect(restored.ok).toBe(true);
  expect(read(repo, DRAFT)).toBe(before);
  expect(imagesOf(restored.data)).toHaveLength(2);
});

test("an image's removal over a stale draft is refused as a conflict", async () => {
  const repo = fixtureRepo();
  const served = await testApp(repo);
  await withTwoImages(served);
  const before = read(repo, DRAFT);

  const result = await mutate(
    served.app,
    "inbox.removeImage",
    { draft: DRAFT, hash: "stale", image: FIRST },
    INBOX,
  );

  expect(result.ok).toBe(false);
  expect(result.error?.message).toBe(
    "conflict: drafts/headings-are-flat/proposal.md changed on disk. Your change was not applied.",
  );
  expect(read(repo, DRAFT)).toBe(before);
});
