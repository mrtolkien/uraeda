// The Git page's writes the human could lose without seeing it: Space stages the file its row's
// box is, leaving the row in its place (US3 1); a typed commit message stays through a hook's
// refusal and goes once its commit lands (US3 more 6); and Discard asks before it restores a file
// (US3 more 4, SC-003).
import { mkdirSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  click,
  fieldText,
  fixtureRepo,
  git,
  read,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

const OUTPUT = "PRIORITIES.md:3: a line too long";

/** Writes `text` to `path` of `repo`, its folders made. */
function write(repo: string, path: string, text: string) {
  mkdirSync(dirname(join(repo, path)), { recursive: true });
  writeFileSync(join(repo, path), text);
}

/** The fixture, with `docs/web-ui.md` committed, then it and `specs/INBOX.md` changed. */
function changedRepo() {
  const repo = fixtureRepo();
  write(repo, "docs/web-ui.md", "# The web UI\n");
  git(repo, "add", "docs/web-ui.md");
  git(repo, "commit", "--quiet", "--no-verify", "-m", "docs: the web UI");
  write(repo, "docs/web-ui.md", "# The web UI\n\nIt draws the specs.\n");
  write(repo, "specs/INBOX.md", `${read(repo, "specs/INBOX.md")}\n- A note\n`);
  return repo;
}

/** The changed files' boxes, in the page's order, by their paths. */
const boxes = () =>
  screen.getAllByRole("checkbox").map((box) => (box as HTMLInputElement).labels?.[0]?.textContent);

/** The box of the changed file at `path`. */
const boxOf = (path: string) => screen.getByRole("checkbox", { name: path });

/**
 * Presses a key on `target`, as the browser does: a Space no listener took, on a checkbox, ticks
 * it, as the key comes up.
 */
async function press(target: HTMLElement, key: string) {
  await act(async () => {
    target.focus();
    const free = fireEvent.keyDown(target, { key });
    if (free && key === " " && target.getAttribute("type") === "checkbox") {
      fireEvent.keyUp(target, { key });
      fireEvent.click(target);
    }
  });
}

/** The files staged in `repo`, one per line. */
const staged = (repo: string) => git(repo, "diff", "--cached", "--name-only");

// Break: the registry taking Space on a file's box for the leader menu, so nothing is staged.
test("Space on a file row stages it, and the row keeps its place", async () => {
  const repo = changedRepo();
  await renderPage("/git", repo);
  await screen.findByRole("checkbox", { name: "specs/INBOX.md" });
  const before = boxes();
  expect(before).toEqual(["docs", "docs/web-ui.md", "specs", "specs/INBOX.md"]);

  await press(boxOf("specs/INBOX.md"), " ");

  await waitFor(() => expect(staged(repo)).toBe("specs/INBOX.md\n"));
  await waitFor(() => expect((boxOf("specs/INBOX.md") as HTMLInputElement).checked).toBe(true));
  expect(boxes()).toEqual(before);
  expect(document.activeElement).toBe(boxOf("specs/INBOX.md"));
  expect(screen.queryByRole("dialog")).toBeNull();
});

// Break: dropping the typed message as the commit is sent, so a hook's refusal loses it; or
// keeping it once landed, so the next commit's field starts with it.
test("a typed message stays once its commit is refused, and goes once it lands", async () => {
  const repo = fixtureRepo();
  const hook = join(repo, ".git/hooks/pre-commit");
  mkdirSync(dirname(hook), { recursive: true });
  writeFileSync(hook, `#!/bin/sh\necho "${OUTPUT}"\nexit 1\n`, { mode: 0o755 });
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global undo\n`);
  await renderPage("/git", repo);
  await click(await screen.findByRole("checkbox", { name: "specs/PRIORITIES.md" }));
  await waitFor(() => expect(staged(repo)).toBe("specs/PRIORITIES.md\n"));
  await type(screen.getByRole("textbox", { name: "Message" }), "chore: plan the undo");

  await click(screen.getByRole("button", { name: "Commit staged" }));

  await refreshUntil(() => expect(document.body.textContent).toContain(OUTPUT));
  expect(fieldText(screen.getByRole("textbox", { name: "Message" }))).toBe("chore: plan the undo");
  expect(staged(repo)).toBe("specs/PRIORITIES.md\n");

  writeFileSync(hook, "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await click(screen.getByRole("button", { name: "Commit staged" }));

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s")).toBe("chore: plan the undo\n"));
  write(repo, "specs/PRIORITIES.md", `${read(repo)}\n- Global redo\n`);
  await refreshUntil(() =>
    expect(fieldText(screen.getByRole("textbox", { name: "Message" }))).toBe(""),
  );
});

// Break: `d` discarding at once, with no question, or Keep discarding too.
test("discard asks first, and only Discard restores the file", async () => {
  const repo = changedRepo();
  const changed = read(repo, "docs/web-ui.md");
  await renderPage("/git", repo);
  const box = await screen.findByRole("checkbox", { name: "docs/web-ui.md" });

  await press(box, "d");
  const asked = await screen.findByRole("dialog", {
    name: "Discard the changes to docs/web-ui.md?",
  });
  await click(within(asked).getByRole("button", { name: /^Keep\b/ }));
  await waitFor(() => expect(screen.queryByRole("dialog")).toBeNull());
  expect(read(repo, "docs/web-ui.md")).toBe(changed);

  await press(boxOf("docs/web-ui.md"), "d");
  const again = await screen.findByRole("dialog", {
    name: "Discard the changes to docs/web-ui.md?",
  });
  await click(within(again).getByRole("button", { name: /^Discard\b/ }));

  await waitFor(() => expect(read(repo, "docs/web-ui.md")).toBe("# The web UI\n"));
});
