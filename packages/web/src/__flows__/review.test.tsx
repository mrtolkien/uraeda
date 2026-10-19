// Flow: reviewing a spec. The human taps lines and comments on them, the comment saves only when
// added and is kept as unsaved text until then, a refused comment comes back with its text, and the
// verdict commits the review or is refused while a comment holds text. Each test reviews a spec of
// a feature of its own, in the one repository of the file.
import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { addPlan, addSpecFeature, ELEVEN, git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import { click, fixtureRepo, refreshUntil, startApp, type } from "./harness.tsx";
import { checkOut } from "./rounds.ts";

const FOLDERS = {
  approve: "2026-10-23-approve",
  cancel: "2026-10-23-cancel",
  comment: "2026-10-23-comment",
  decision: "2026-10-23-decision",
  dirty: "2026-10-23-dirty",
  general: "2026-10-23-general",
  keys: "2026-10-23-keys",
  plan: "2026-10-23-plan",
  range: "2026-10-23-range",
  refused: "2026-10-23-refused",
  request: "2026-10-23-request",
  restore: "2026-10-23-restore",
  start: "2026-10-23-start",
  unsent: "2026-10-23-unsent",
};
const STORY = "us2-complete-a-repeating-task-p1";

const app = startApp({
  repo: () => {
    const repo = fixtureRepo();
    for (const folder of Object.values(FOLDERS)) {
      // A first revision: no earlier review is in the way of a new one.
      addSpecFeature(repo, { folder, revision: 1 });
    }
    addPlan(repo, FOLDERS.plan, ELEVEN, "awaiting-human");
    return repo;
  },
});

const page = (folder: string, file = "spec.md") => `/f/${folder}/${file}`;
const review = (folder: string) =>
  join(app.repo, ".worktrees", folder, `specs/${folder}/spec-review.md`);
const reviewText = (folder: string) => readFileSync(review(folder), "utf8");
const lastSubject = (folder: string) => git(app.repo, "log", "-1", "--format=%s", folder).trim();

/** Whether an element is inside the region a closed trigger controls: folded away. */
function folded(element: Element) {
  return [...document.querySelectorAll("[aria-expanded='false'][aria-controls]")].some((trigger) =>
    document.getElementById(trigger.getAttribute("aria-controls") ?? "")?.contains(element),
  );
}

/** The scenarios a story shows, as a review taps them. */
function scenarios() {
  const story = document.getElementById(STORY) as HTMLElement;
  return within(story)
    .getAllByRole("button")
    .filter((block) => block.hasAttribute("aria-pressed") && !folded(block));
}

/** The comment form, once open. */
const form = () => screen.queryByRole("form", { name: "Comment" });
const field = () => within(form()!).getByRole("textbox") as HTMLTextAreaElement;
const formButton = (name: RegExp) => within(form()!).getByRole("button", { name });
const addButton = () => formButton(/^(add|save) comment$/i);

/** The pending comments shown under their blocks. */
const pending = () => screen.queryAllByRole("group", { name: /^C\d+ /i });

async function open(folder: string, file = "spec.md") {
  cleanup();
  await app.open(page(folder, file));
  await waitFor(() => expect(document.getElementById(STORY)).toBeTruthy());
}

/** Ctrl+Enter in the open comment's text box. */
const ctrlEnter = () =>
  act(async () => {
    fireEvent.keyDown(field(), { ctrlKey: true, key: "Enter" });
  });

async function writeComment(text: string) {
  await type(field(), text);
}

test("a comment on a tapped line is written only when added, shows under its block, and is edited and removed", async () => {
  await open(FOLDERS.comment);
  await click(scenarios()[0]);
  expect(scenarios()[0].getAttribute("aria-pressed")).toBe("true");
  await writeComment("Say what the row shows");

  // Typed, not added: nothing is written.
  expect(existsSync(review(FOLDERS.comment))).toBe(false);
  await click(addButton());
  await waitFor(() => expect(reviewText(FOLDERS.comment)).toContain("\nSay what the row shows\n"));
  await waitFor(() => expect(form()).toBeNull());
  await waitFor(() => expect(pending()).toHaveLength(1));
  // It sits under its block, and offers Edit and Remove.
  const note = pending()[0];
  expect(
    scenarios()[0].compareDocumentPosition(note) & Node.DOCUMENT_POSITION_FOLLOWING,
  ).toBeTruthy();

  await click(within(note).getByRole("button", { name: "Edit" }));
  await writeComment("Say what the row shows, and for how long");
  await click(addButton());
  await waitFor(() => expect(reviewText(FOLDERS.comment)).toContain("and for how long\n"));
  await waitFor(() => expect(pending()[0].textContent).toContain("and for how long"));

  await click(within(pending()[0]).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(pending()).toHaveLength(0));
  expect(existsSync(review(FOLDERS.comment))).toBe(false);
});

test("a general comment needs no block, and is edited and removed like the others", async () => {
  await open(FOLDERS.general);
  await click(screen.getByRole("button", { name: /general comment/i }));
  await writeComment("Too long");
  await click(addButton());

  await waitFor(() =>
    expect(reviewText(FOLDERS.general)).toMatch(/## C1: General\n[\s\S]*Too long/),
  );
  await waitFor(() => expect(pending()).toHaveLength(1));
  await click(within(pending()[0]).getByRole("button", { name: "Edit" }));
  await writeComment("Too long by half");
  await click(addButton());
  await waitFor(() => expect(reviewText(FOLDERS.general)).toContain("Too long by half"));
  await waitFor(() => expect(pending()[0].textContent).toContain("by half"));
  await click(within(pending()[0]).getByRole("button", { name: "Remove" }));
  await waitFor(() => expect(existsSync(review(FOLDERS.general))).toBe(false));
});

test("Ctrl+Enter adds a comment from the keyboard, and does nothing while it is empty", async () => {
  await open(FOLDERS.keys);
  await click(scenarios()[0]);

  await ctrlEnter();
  expect(existsSync(review(FOLDERS.keys))).toBe(false);
  await writeComment("Too vague");
  await ctrlEnter();

  await waitFor(() => expect(reviewText(FOLDERS.keys)).toContain("\nToo vague\n"));
});

test("cancelling a comment typed asks first and keeps the text; an empty one closes without asking", async () => {
  await open(FOLDERS.cancel);
  await click(scenarios()[0]);
  await click(formButton(/^cancel$/i));
  expect(screen.queryByRole("dialog")).toBeNull();
  await waitFor(() => expect(form()).toBeNull());

  await click(scenarios()[0]);
  await writeComment("Too vague");
  await click(formButton(/^cancel$/i));
  const dialog = await screen.findByRole("dialog");
  // The first choice keeps editing: the text is still there.
  await click(within(dialog).getAllByRole("button")[0]);
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(field().value).toBe("Too vague");

  await click(formButton(/^cancel$/i));
  const again = await screen.findByRole("dialog");
  const discard = within(again)
    .getAllByRole("button")
    .find((button) => /discard/i.test(button.textContent ?? ""))!;
  await click(discard);
  await waitFor(() => expect(form()).toBeNull());
  expect(existsSync(review(FOLDERS.cancel))).toBe(false);
});

test("a comment typed is restored after a reload on its lines, as unsaved text to discard", async () => {
  await open(FOLDERS.restore);
  const [first, second] = scenarios();
  await click(first);
  await click(second);
  await writeComment("Too vague");

  forgetUnsaved();
  cleanup();
  await app.open(page(FOLDERS.restore), { reload: true });

  await waitFor(() => expect(form()).toBeTruthy());
  expect(field().value).toBe("Too vague");
  expect(scenarios()[1].getAttribute("aria-pressed")).toBe("true");
  expect(existsSync(review(FOLDERS.restore))).toBe(false);
  // The notice offers to discard it.
  expect(
    within(form()!.parentElement!).queryAllByRole("button", { name: "Discard" }).length +
      screen.queryAllByRole("button", { name: "Discard" }).length,
  ).toBeGreaterThan(0);
});

test("a comment the core refuses comes back in its form with its text, and nothing is written", async () => {
  await open(FOLDERS.refused);
  await click(scenarios()[0]);
  // A comment line cannot start with "#": it would read as a heading of the review file.
  await writeComment("# Too vague");

  await click(addButton());

  await waitFor(() => expect(within(form()!).getAllByText(/./).length).toBeGreaterThan(0));
  expect(field().value).toBe("# Too vague");
  expect(existsSync(review(FOLDERS.refused))).toBe(false);
  expect(pending()).toHaveLength(0);
});

test("Request changes waits for a comment, then commits the review as changes requested", async () => {
  await open(FOLDERS.request);
  const request = screen.getByRole("button", { name: "Request changes" });
  expect(request.hasAttribute("disabled") || request.getAttribute("aria-disabled") === "true").toBe(
    true,
  );

  await click(screen.getByRole("button", { name: /general comment/i }));
  await writeComment("Shorter please");
  await click(addButton());
  await waitFor(() => expect(pending()).toHaveLength(1));
  await click(screen.getByRole("button", { name: "Request changes" }));

  await waitFor(() => expect(lastSubject(FOLDERS.request)).not.toBe(`work on ${FOLDERS.request}`));
  expect(
    git(app.repo, "show", `${FOLDERS.request}:specs/${FOLDERS.request}/spec-review.md`),
  ).toContain("verdict: changes-requested");
});

test("Approve with a chosen risk tier commits the spec approved at that tier", async () => {
  await open(FOLDERS.approve);
  await click(await screen.findByRole("radio", { name: "medium" }));

  await click(screen.getByRole("button", { name: "Approve" }));

  await waitFor(() => expect(lastSubject(FOLDERS.approve)).not.toBe(`work on ${FOLDERS.approve}`));
  const spec = git(app.repo, "show", `${FOLDERS.approve}:specs/${FOLDERS.approve}/spec.md`);
  expect(spec).toContain("status: approved\n");
  expect(spec).toContain("risk-tier: medium\n");
});

test("a verdict with a comment open that holds text is refused and commits nothing", async () => {
  await open(FOLDERS.unsent);
  await click(screen.getByRole("button", { name: /general comment/i }));
  await writeComment("Half a tho");

  await click(screen.getByRole("button", { name: "Approve" }));
  await act(async () => new Promise((resolve) => setTimeout(resolve, 100)));

  expect(lastSubject(FOLDERS.unsent)).toBe(`work on ${FOLDERS.unsent}`);
  expect(field().value).toBe("Half a tho");
  expect(screen.getByRole("button", { name: "Approve" })).toBeTruthy();
});

test("the verdict waits while the spec has changes not committed", async () => {
  // An edit made in the feature's worktree, not committed: the review is of the committed version.
  checkOut(app.repo, FOLDERS.dirty);
  const path = join(app.repo, ".worktrees", FOLDERS.dirty, `specs/${FOLDERS.dirty}/spec.md`);
  writeFileSync(path, `${readFileSync(path, "utf8")}\nUnfinished edit.\n`);

  await open(FOLDERS.dirty);

  const approve = await screen.findByRole("button", { name: "Approve" });
  expect(approve.hasAttribute("disabled") || approve.getAttribute("aria-disabled") === "true").toBe(
    true,
  );
  expect(lastSubject(FOLDERS.dirty)).toBe(`work on ${FOLDERS.dirty}`);
});

test("a spec that changed under a pending comment says so, and Start over removes the review", async () => {
  await open(FOLDERS.start);
  await click(screen.getByRole("button", { name: /general comment/i }));
  await writeComment("Shorter");
  await click(addButton());
  await waitFor(() => expect(pending()).toHaveLength(1));
  const worktree = join(app.repo, ".worktrees", FOLDERS.start);
  const spec = `specs/${FOLDERS.start}/spec.md`;
  writeFileSync(
    join(worktree, spec),
    `${readFileSync(join(worktree, spec), "utf8")}\nOne more line.\n`,
  );
  git(worktree, "commit", "--quiet", "--no-verify", "--all", "--message", "spec: edit");

  await refreshUntil(() => expect(screen.getByRole("button", { name: "Start over" })).toBeTruthy());
  await click(screen.getByRole("button", { name: "Start over" }));

  await waitFor(() => expect(pending()).toHaveLength(0));
  expect(existsSync(review(FOLDERS.start))).toBe(false);
});

test("a decision's rule takes a comment saved with its decision, listed apart from the spec's lines", async () => {
  await open(FOLDERS.decision);
  const card = await screen.findByRole("region", { name: "Task storage" });
  // The card's rules are the toggles of its group: each takes a comment on its decision's lines.
  const rule = within(within(card).getByRole("group", { name: "Rules" })).getAllByRole("button", {
    pressed: false,
  })[2];

  await click(rule);
  await writeComment("Log it where I can see it");
  await click(addButton());

  await waitFor(() =>
    expect(reviewText(FOLDERS.decision)).toContain("## C1: Decision task-storage"),
  );
  await waitFor(() =>
    expect(within(card).queryAllByRole("group", { name: /^C\d+ /i })).toHaveLength(1),
  );
});

test("a plan is reviewed on the same page, without a risk tier to pick", async () => {
  await app.open(page(FOLDERS.plan, "plan.md"));

  await screen.findByRole("button", { name: "Approve" });
  expect(screen.queryByRole("radio", { name: "high" })).toBeNull();
});
