// Flow: the spec page. The contents lead to every part by an anchor and keep the human's choice,
// stories fold their other scenarios and keep them open on Back, the decisions the branch changes
// are cards with their changes marked, a pending comment is counted on its part, an approved spec
// is read-only, and a story's frame is sandboxed apart from the app's origin. Reads and taps only:
// the writes of a review are the review flow's.
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addPreview, addSpecFeature, commitOnBranch, git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { atWidth, click, fixtureRepo, startApp } from "./harness.tsx";

const FOLDERS = {
  approved: "2026-10-17-spec-approved",
  main: "2026-10-17-spec-page",
  niche: "2026-10-17-spec-niche",
  pending: "2026-10-17-spec-pending",
  section: "2026-10-17-spec-section",
};
const STORY_US2 = "us2-complete-a-repeating-task-p1";

/** The spec of a feature, at its branch's tip. */
const specOf = (repo: string, folder: string) =>
  git(repo, "show", `${folder}:specs/${folder}/spec.md`);

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    addSpecFeature(repo, { folder: FOLDERS.main });
    addSpecFeature(repo, { folder: FOLDERS.pending });
    addSpecFeature(repo, { folder: FOLDERS.approved, status: "approved" });
    addSpecFeature(repo, { folder: FOLDERS.section });
    addSpecFeature(repo, { folder: FOLDERS.niche });
    // A comment of the human's, pending, on the first story's opening line.
    const spec = specOf(repo, FOLDERS.pending);
    const line =
      spec.split("\n").findIndex((l) => l.includes("In a task's edit panel, a repeat menu")) + 1;
    const tip = git(repo, "rev-parse", "--short=7", FOLDERS.pending).trim();
    commitOnBranch(repo, FOLDERS.pending, {
      [`specs/${FOLDERS.pending}/spec-review.md`]: `---\nverdict: pending\ncommit: ${tip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line ${line}, under "Somewhere"\n\n> Quoted.\n\nWhy?\n`,
    });
    // A comment, pending, on a niche edge case, which the page folds away unless it is commented.
    const niche = specOf(repo, FOLDERS.niche);
    const nicheLine = niche.split("\n").findIndex((l) => l.includes("EVERY MONDAY")) + 1;
    const nicheTip = git(repo, "rev-parse", "--short=7", FOLDERS.niche).trim();
    commitOnBranch(repo, FOLDERS.niche, {
      [`specs/${FOLDERS.niche}/spec-review.md`]: `---\nverdict: pending\ncommit: ${nicheTip}\n---\n\n# Review: Spec, Recurring tasks\n\n## C1: Line ${nicheLine}, under "Edge cases"\n\n> | Niche | A repeat phrase in capitals |\n\nAnd mixed case?\n`,
    });
    // A section the page does not know, and a heading inside a story's folded scenarios.
    commitOnBranch(repo, FOLDERS.section, {
      [`specs/${FOLDERS.section}/spec.md`]: specOf(repo, FOLDERS.section)
        .replace("## History", "## Rollout\n\nShip it behind a flag first.\n\n## History")
        .replace(
          "   due the day after tomorrow.\n",
          "   due the day after tomorrow.\n\n   #### Twice in a row\n",
        ),
    });
    addPreview(repo);
    return repo;
  },
});

const page = (folder: string) => `/f/${folder}/spec.md`;

/** The links of the page that lead to a place of it: the contents' entries, by their anchors. */
function anchors() {
  return screen
    .queryAllByRole("link")
    .filter((link) => link.getAttribute("href")?.startsWith("#"))
    .map((link) => link as HTMLAnchorElement);
}

/** The contents' entries by their targets, and their names, which carry a pending comment's count. */
function entries() {
  return new Map(
    anchors().map((link) => [
      link.getAttribute("href"),
      `${link.getAttribute("aria-label") ?? ""}|${link.textContent ?? ""}`,
    ]),
  );
}

/** Whether the contents are shown: their entry for the stories' section is a link. */
function shown() {
  return entries().has("#user-stories");
}

/** Whether an element is inside the region a closed trigger controls: folded away. */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** The toggles of a story's scenarios the page shows, as a review taps them. */
function scenariosOf(card: HTMLElement) {
  return within(card)
    .queryAllByRole("button")
    .filter((block) => block.hasAttribute("aria-pressed") && !folded(block));
}

/** The fold trigger of a story: its only button that opens and closes its other scenarios. */
function foldOf(card: HTMLElement) {
  return within(card)
    .queryAllByRole("button")
    .find((button) => button.hasAttribute("aria-expanded") && button.hasAttribute("aria-controls"));
}

async function open(folder: string, hash = "") {
  cleanup();
  await app.open(`${page(folder)}${hash}`);
  await waitFor(() => expect(document.getElementById("your-review")).toBeTruthy());
}

test("the contents lead to every part by an anchor the page draws, and the stories are among them", async () => {
  atWidth(1440);
  await open(FOLDERS.main);

  await waitFor(() => expect(anchors().length).toBeGreaterThan(0));
  for (const link of anchors()) {
    const id = decodeURIComponent(link.getAttribute("href")!.slice(1));
    expect(document.getElementById(id), `the target of ${id}`).toBeTruthy();
  }
  const targets = [...entries().keys()];
  expect(targets).toContain(`#${STORY_US2}`);
  expect(targets).toContain("#your-review");
  expect(targets).toContain("#user-stories");
});

test("the contents start folded on a narrow window, show from the keyboard, and keep the human's choice across a reload", async () => {
  atWidth(800);
  await open(FOLDERS.main);
  expect(shown()).toBe(false);

  await act(async () => {
    fireEvent.keyDown(document.body, { code: "BracketRight", key: "]" });
  });
  await waitFor(() => expect(shown()).toBe(true));

  // The choice is kept on this browser: a reload shows them as chosen, at any width.
  await app.open(page(FOLDERS.main), { reload: true });
  await waitFor(() => expect(document.getElementById("your-review")).toBeTruthy());
  await waitFor(() => expect(shown()).toBe(true));

  await act(async () => {
    fireEvent.keyDown(document.body, { code: "BracketRight", key: "]" });
  });
  await waitFor(() => expect(shown()).toBe(false));
  await app.open(page(FOLDERS.main), { reload: true });
  await waitFor(() => expect(document.getElementById("your-review")).toBeTruthy());
  expect(shown()).toBe(false);
});

test("a pending comment is counted on its part in the contents, and on no other", async () => {
  atWidth(1440);
  await open(FOLDERS.main);
  await waitFor(() => expect(anchors().length).toBeGreaterThan(0));
  const without = entries();
  await open(FOLDERS.pending);
  await waitFor(() => expect(anchors().length).toBeGreaterThan(0));
  const withComment = entries();

  const changed = [...withComment].filter(([target, name]) => without.get(target) !== name);
  expect(changed.map(([target]) => target)).toEqual(["#us1-make-a-task-repeat-p1"]);
});

test("a story shows its key scenarios and folds the others, and the fold stays open on Back", async () => {
  atWidth(1440);
  await open(FOLDERS.main);
  const card = document.getElementById(STORY_US2) as HTMLElement;
  const fold = foldOf(card)!;
  const shown = scenariosOf(card).length;
  expect(fold.getAttribute("aria-expanded")).toBe("false");

  await click(fold);

  expect(fold.getAttribute("aria-expanded")).toBe("true");
  expect(scenariosOf(card).length).toBeGreaterThan(shown);
  // A decision's link leaves the page; Back returns to it with the fold as it was left.
  const link = screen
    .getAllByRole("link")
    .find((l) => l.getAttribute("href")?.startsWith(app.path("/decisions")));
  expect(link, "a link to a decision").toBeTruthy();
  await click(link!);
  expect(window.location.pathname).toContain("/decisions");
  await act(async () => {
    window.history.back();
  });
  await waitFor(() => expect(window.location.pathname).toBe(app.path(page(FOLDERS.main))));
  await waitFor(() =>
    expect(
      foldOf(document.getElementById(STORY_US2) as HTMLElement)?.getAttribute("aria-expanded"),
    ).toBe("true"),
  );
});

test("a story without other scenarios has no fold, and a hash into a folded heading opens it", async () => {
  atWidth(1440);
  await open(FOLDERS.main);
  const custom = [...document.querySelectorAll<HTMLElement>("[id^=us3]")][0];
  expect(foldOf(custom)).toBeUndefined();

  await open(FOLDERS.section, "#twice-in-a-row");

  await waitFor(() => expect(document.getElementById("twice-in-a-row")).toBeTruthy());
  const card = document.getElementById(STORY_US2) as HTMLElement;
  await waitFor(() => expect(foldOf(card)?.getAttribute("aria-expanded")).toBe("true"));
});

test("a tap on a scenario selects it and opens the comment form on its lines, a second tap extends it", async () => {
  atWidth(1440);
  await open(FOLDERS.main);
  const card = document.getElementById(STORY_US2) as HTMLElement;
  const [first, second] = scenariosOf(card);

  await click(first);
  expect(first.getAttribute("aria-pressed")).toBe("true");
  await waitFor(() =>
    expect(screen.getAllByRole("textbox").some((box) => box.closest("form"))).toBe(true),
  );
  await click(second);

  expect(second.getAttribute("aria-pressed")).toBe("true");
  expect(first.getAttribute("aria-pressed")).toBe("true");
});

test("the decisions the branch changes are cards, a reworded rule marked in place and never struck out", async () => {
  atWidth(1440);
  await open(FOLDERS.main);
  const storage = await screen.findByRole("region", { name: "Task storage" });

  // The change is marked by roles a screen reader hears: words added, and words removed.
  expect(within(storage).queryAllByRole("insertion").length).toBeGreaterThan(0);
  expect(within(storage).queryAllByRole("deletion").length).toBeGreaterThan(0);
  const struck = [...storage.querySelectorAll<HTMLElement>("*")].filter((element) =>
    getComputedStyle(element).textDecorationLine.includes("line-through"),
  );
  expect(struck).toHaveLength(0);
  // A decision removed by the branch is a card too, with no link to a file that is gone.
  const removed = screen.getAllByRole("region").find((r) => r.id.includes("task-history"));
  expect(removed).toBeTruthy();
  expect(within(removed!).queryAllByRole("link")).toHaveLength(0);
});

test("a spec approved is the same page, read-only: no verdict and no comment", async () => {
  atWidth(1440);
  await open(FOLDERS.approved);

  expect(screen.queryByRole("button", { name: "Approve" })).toBeNull();
  expect(screen.queryByRole("button", { name: "Request changes" })).toBeNull();
  expect(document.querySelector("button[aria-pressed]")).toBeNull();
  // The same parts are drawn.
  expect(document.getElementById(STORY_US2)).toBeTruthy();
});

test("a mockup page shows the file in a frame sandboxed apart from the app's origin", async () => {
  await app.open(`/f/${FOLDERS.main}/mockups/title.html`);

  const frame = await waitFor(() => {
    const found = document.querySelector("iframe");
    expect(found).toBeTruthy();
    return found!;
  });
  expect(frame.getAttribute("sandbox")).not.toContain("allow-same-origin");
});
