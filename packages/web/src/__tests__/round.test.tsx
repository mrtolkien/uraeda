import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeAll, expect, test } from "vite-plus/test";
import { fixtureRepo, git, renderPage } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;

beforeAll(() => {
  process.env.URA_TODAY = "2026-10-11";
});

/** The round's text: in the feature's worktree once written, else at the branch's tip. */
function text(repo: string) {
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  return existsSync(path) ? readFileSync(path, "utf8") : git(repo, "show", `${FOLDER}:${ROUND}`);
}

/** The `**Answer:**` line of a question. */
function answerLine(repo: string, id: string) {
  const lines = text(repo).split("\n");
  const heading = lines.findIndex((line) =>
    new RegExp(`^#{2,3} ${id.replace(".", "\\.")}:`).test(line),
  );
  return lines.slice(heading).find((line) => line.startsWith("**Answer:**"));
}

/** A repository whose round has these answers written in the feature's worktree. */
function answered(answers: Record<string, string>) {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  let round = text(repo);
  for (const [id, answer] of Object.entries(answers)) {
    const lines = round.split("\n");
    const heading = lines.findIndex((line) =>
      line.match(new RegExp(`^#{2,3} ${id.replace(".", "\\.")}:`)),
    );
    const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
    lines[at] = answer ? `**Answer:** ${answer}` : "**Answer:**";
    round = lines.join("\n");
  }
  writeFileSync(join(repo, ".worktrees", FOLDER, ROUND), round);
  return repo;
}

function question(id: string) {
  return document.getElementById(id) as HTMLElement;
}

/** The option button of a question, by its letter. */
function option(id: string, letter: string) {
  const buttons = [...question(id).querySelectorAll(":scope > .options > .option")];
  return buttons.find((b) => b.querySelector(".letter")?.textContent === letter) as HTMLElement;
}

/** The comment field of a question, not of its follow-ups. */
function comment(id: string) {
  return within(question(id)).getAllByLabelText("Comment")[0];
}

async function tap(element: HTMLElement) {
  await act(async () => {
    fireEvent.click(element);
  });
}

async function type(element: HTMLElement, value: string) {
  await act(async () => {
    fireEvent.change(element, { target: { value } });
  });
}

/** US2.1 */
test("a tapped option is saved as the answer", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");

  await tap(option("Q2", "A"));

  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** A"));
  expect(await within(question("Q2")).findByText("saved ✓")).toBeTruthy();
  expect(option("Q2", "A").getAttribute("aria-pressed")).toBe("true");
});

/** US2.2 */
test("several options are written B and C, then A, B and C", async () => {
  const repo = answered({ Q1: "B" });
  await renderPage(PAGE, repo);
  await screen.findByText("Which human steps does the UI perform?");

  await tap(option("Q1", "C"));
  await waitFor(() => expect(answerLine(repo, "Q1")).toBe("**Answer:** B and C"));
  await tap(option("Q1", "A"));
  await waitFor(() => expect(answerLine(repo, "Q1")).toBe("**Answer:** A, B and C"));
});

/** US2.3 */
test("a comment follows the letters", async () => {
  const repo = answered({ Q2: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "but only for the dev server");

  await waitFor(() =>
    expect(answerLine(repo, "Q2")).toBe("**Answer:** A: but only for the dev server"),
  );
});

/** US2.4 */
test("a comment alone is the answer", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("Which repositories does the UI open now?");

  await type(comment("Q3"), "Neither, keep it simple");

  await waitFor(() => expect(answerLine(repo, "Q3")).toBe("**Answer:** Neither, keep it simple"));
});

/** US2.5 */
test("an answer read back selects its letters and fills its comment", async () => {
  await renderPage(PAGE, answered({ Q2: "B and C: weekdays matter" }));
  await screen.findByText("How does your iPhone reach the server?");

  expect(option("Q2", "A").getAttribute("aria-pressed")).toBe("false");
  expect(option("Q2", "B").getAttribute("aria-pressed")).toBe("true");
  expect(option("Q2", "C").getAttribute("aria-pressed")).toBe("true");
  expect((comment("Q2") as HTMLTextAreaElement).value).toBe("weekdays matter");
});

/** US2.6 */
test("a follow-up shows inside its parent once it applies", async () => {
  const repo = answered({ Q1: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("Which human steps does the UI perform?");
  expect(question("Q1.B")).toBeNull();
  expect(screen.getByText("1 of 3 answered", { exact: false })).toBeTruthy();

  await tap(option("Q1", "A"));
  await tap(option("Q1", "B"));

  await waitFor(() => expect(question("Q1.B")).toBeTruthy());
  expect(question("Q1").contains(question("Q1.B"))).toBe(true);
});

/** US2.7 */
test("a follow-up whose parent names no option can be marked as not applying", async () => {
  const repo = answered({ Q1: "keep it simple" });
  await renderPage(PAGE, repo);
  await waitFor(() => expect(question("Q1.B")).toBeTruthy());

  await tap(within(question("Q1.B")).getByRole("button", { name: "Does not apply" }));

  await waitFor(() => expect(answerLine(repo, "Q1.B")).toBe("**Answer:** -"));
});

/** US2.8 */
test("the end of the page lists the questions left, and Submit waits for them", async () => {
  await renderPage(PAGE, answered({ Q1: "A", Q2: "A" }));

  expect(await screen.findByText("1 question left:", { exact: false })).toBeTruthy();
  expect(screen.getByRole("link", { name: "Q3" }).getAttribute("href")).toBe("#Q3");
  expect(screen.getByRole("button", { name: "Submit answers" }).hasAttribute("disabled")).toBe(
    true,
  );
});

/** US2.9 */
test("submitting commits the round and shows its record", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);

  await tap(await screen.findByRole("button", { name: "Submit answers" }));

  await waitFor(() => expect(screen.getByText("Answered on 2026-10-11.")).toBeTruthy());
  expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
    "discovery(web-ui): answer round 01",
  );
  expect(text(repo)).toContain("status: answered");
  expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull();
});

/** US2.10 */
test("the notes are saved as the last line", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("Settled without you");

  await type(screen.getByLabelText("Notes"), "LGTM");

  await waitFor(() => expect(text(repo).trimEnd().endsWith("**Notes:** LGTM")).toBe(true));
});

/** US2.11 */
test("every question and option shows in full", async () => {
  await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");

  const q2 = question("Q2").textContent ?? "";
  expect(q2).toContain(
    "Tailscale keeps other machines out, not a malicious page opened on your Mac or phone.",
  );
  expect(q2).toContain("which `tailscale serve` adds and strips".replaceAll("`", ""));
  expect(q2).toContain("any page you browse can.");
  expect(q2).not.toContain("…");
  expect(screen.queryByText("more")).toBeNull();
});

/** Review focus 5: a comment, then a tap before its save returns, is not a conflict. */
test("quick saves of one answer follow each other", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "first");
  await tap(option("Q2", "B"));

  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** B: first"));
  expect(within(question("Q2")).queryByText(/Not saved/)).toBeNull();
});

test("a refused answer keeps its text, and says why", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");
  await tap(option("Q2", "A"));
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** A"));
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** C"));

  await type(comment("Q2"), "mine");

  await waitFor(() =>
    expect(
      within(question("Q2")).getByText(
        "Not saved: clarifications-01.md changed on disk since you opened it. Your text was not saved.",
      ),
    ).toBeTruthy(),
  );
  expect((comment("Q2") as HTMLTextAreaElement).value).toBe("mine");
});

test("a hook's refusal keeps the answers, and Try again commits them", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const hooks = join(repo, ".git/hooks");
  git(repo, "config", "core.hooksPath", hooks);
  writeFileSync(
    join(hooks, "pre-commit"),
    "#!/bin/sh\necho 'VITE+ - pre-commit script failed (code 1)'\nexit 1\n",
    { mode: 0o755 },
  );
  await renderPage(PAGE, repo);

  await tap(await screen.findByRole("button", { name: "Submit answers" }));

  expect(
    await screen.findByText(
      "The pre-commit hook refused the commit. Your answers are saved, not committed.",
    ),
  ).toBeTruthy();
  await tap(screen.getByText("Hook output"));
  expect(
    screen.getByText("VITE+ - pre-commit script failed (code 1)", { exact: false }),
  ).toBeTruthy();
  writeFileSync(join(hooks, "pre-commit"), "#!/bin/sh\nexit 0\n", { mode: 0o755 });
  await tap(screen.getByRole("button", { name: "Try again" }));
  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
});

/** Review I1: an answer changed elsewhere shows, and the next save builds on it. */
test("an answer changed elsewhere shows when the page reads again", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  const lines = readFileSync(path, "utf8").split("\n");
  const heading = lines.findIndex((line) => line.startsWith("## Q2:"));
  const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
  lines[at] = "**Answer:** C";
  writeFileSync(path, lines.join("\n"));

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await waitFor(() => expect(option("Q2", "C").getAttribute("aria-pressed")).toBe("true"));
  await type(comment("Q2"), "mine");
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** C: mine"));
});

/** Review I2: Submit saves what is still being typed first. */
test("Submit waits for the notes being typed", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  const notes = await screen.findByLabelText("Notes");

  await type(notes, "LGTM");
  await tap(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain("**Notes:** LGTM");
});

/** Codex review: notes changed elsewhere show, and the next save builds on them. */
test("notes changed elsewhere show when the page reads again", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  const notes = (await screen.findByLabelText("Notes")) as HTMLTextAreaElement;
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(/\*\*Notes:\*\*\n?$/, "**Notes:** theirs\n"),
  );

  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  await waitFor(() => expect(notes.value).toBe("theirs"));
  await type(notes, "theirs, and mine");
  await waitFor(() =>
    expect(text(repo).trimEnd().endsWith("**Notes:** theirs, and mine")).toBe(true),
  );
});

/** Codex review: Submit stops when what was typed could not be saved. */
test("Submit stops when an answer could not be saved", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** B"));

  await type(comment("Q1"), "mine");
  await tap(screen.getByRole("button", { name: "Submit answers" }));

  expect(await screen.findByText(/Some answers were not saved/)).toBeTruthy();
  expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).not.toBe(
    "discovery(web-ui): answer round 01",
  );
});
