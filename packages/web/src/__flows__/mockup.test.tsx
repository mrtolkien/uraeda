// Flow: a mockup of a feature, inside the app. It is a sandboxed frame, and while the spec waits for
// review it takes a comment on the spec's line that links it, or a general one naming it when no
// line does; the text typed is kept across a reload, and an approved spec takes none.
import { existsSync, readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addSpecFeature, commitOnBranch } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { click, fixtureRepo, startApp, type } from "./harness.tsx";

const FOLDERS = {
  approved: "2026-10-25-mockup-approved",
  keys: "2026-10-25-mockup-keys",
  linked: "2026-10-25-mockup-linked",
  loose: "2026-10-25-mockup-loose",
  restore: "2026-10-25-mockup-restore",
};
const HTML = "<!doctype html>\n<title>Extra</title>\n<p>An extra mockup.</p>\n";

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    for (const [key, folder] of Object.entries(FOLDERS)) {
      addSpecFeature(repo, {
        folder,
        revision: 1,
        status: key === "approved" ? "approved" : "awaiting-human",
      });
    }
    commitOnBranch(repo, FOLDERS.loose, {
      [`specs/${FOLDERS.loose}/mockups/extra.html`]: HTML,
    });
    return repo;
  },
});

const page = (folder: string, name = "title.html") => `/f/${folder}/mockups/${name}`;
const review = (folder: string) => {
  const path = join(app.repo, ".worktrees", folder, `specs/${folder}/spec-review.md`);
  return existsSync(path) ? readFileSync(path, "utf8") : "";
};

/** Opens the comment form: the page's Comment action. */
const open = async () => click(await screen.findByRole("button", { name: /^comment$/i }));

async function mockup(folder: string, name?: string) {
  cleanup();
  await app.open(page(folder, name));
  await screen.findByTitle(name ?? "title.html");
}

/** The comment form's text box: the one inside a form. */
const box = () =>
  screen.getAllByRole("textbox").find((candidate) => candidate.closest("form")) as HTMLElement;

test("a mockup shows in a frame sandboxed apart from the app, and opens in a tab of its own", async () => {
  await mockup(FOLDERS.linked);

  const frame = screen.getByTitle("title.html");
  expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
  expect(frame.getAttribute("src")).toContain(
    `/mockups/specs/${FOLDERS.linked}/mockups/title.html`,
  );
  const links = screen
    .getAllByRole("link")
    .filter((link) => link.getAttribute("target") === "_blank");
  expect(links.length).toBeGreaterThan(0);
});

test("a comment lands on the line of the spec that links the mockup, only once added", async () => {
  await mockup(FOLDERS.linked);
  await open();
  await type(box(), "The title needs a Never option");

  expect(review(FOLDERS.linked)).toBe("");
  await click(
    within(box().closest("form") as HTMLElement).getByRole("button", { name: /^add comment$/i }),
  );

  await waitFor(() => expect(review(FOLDERS.linked)).toMatch(/## C1: Line \d+, under "/));
  expect(review(FOLDERS.linked)).toContain("title.html");
  expect(review(FOLDERS.linked)).toContain("\nThe title needs a Never option\n");
});

test("Ctrl+Enter adds the mockup's comment", async () => {
  await mockup(FOLDERS.keys);
  await open();
  await type(box(), "Too dense");

  await act(async () => {
    fireEvent.keyDown(box(), { ctrlKey: true, key: "Enter" });
  });

  await waitFor(() => expect(review(FOLDERS.keys)).toContain("\nToo dense\n"));
});

test("a mockup no line links gets a general comment that names it", async () => {
  await mockup(FOLDERS.loose, "extra.html");
  await open();
  await type(box(), "Too dense");
  await click(
    within(box().closest("form") as HTMLElement).getByRole("button", { name: /^add comment$/i }),
  );

  await waitFor(() =>
    expect(review(FOLDERS.loose)).toMatch(/## C1: General\n[\s\S]*extra\.html[\s\S]*Too dense/),
  );
});

test("a comment typed on a mockup is restored after a reload", async () => {
  await mockup(FOLDERS.restore);
  await open();
  await type(box(), "Half a thought");

  forgetUnsaved();
  cleanup();
  await app.open(page(FOLDERS.restore), { reload: true });
  await screen.findByTitle("title.html");
  await open();

  await waitFor(() => expect((box() as HTMLTextAreaElement).value).toBe("Half a thought"));
  expect(review(FOLDERS.restore)).toBe("");
});

test("an approved spec takes no comment on its mockup", async () => {
  await mockup(FOLDERS.approved);

  expect(screen.queryByRole("button", { name: /^comment$/i })).toBeNull();
});
