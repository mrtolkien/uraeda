import { existsSync, readFileSync, writeFileSync } from "node:fs";
import { basename, join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { forgetUnsaved } from "../fields/unsaved.ts";
import {
  atRepo,
  answered as readAnswered,
  answersSoFar,
  atWidth,
  fixture,
  fixtureRepo,
  git,
  refreshUntil,
  renderPage,
  serverFetch,
  today,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;

today("2026-10-11");

/** The round's text: in the feature's worktree once written, else at the branch's tip. */
function text(repo: string) {
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  return existsSync(path) ? readFileSync(path, "utf8") : git(repo, "show", `${FOLDER}:${ROUND}`);
}

/** The `**Answer:**` line of a question. */
function answerLine(repo: string, id: string) {
  const lines = text(repo).split("\n");
  const heading = lines.findIndex((line) =>
    new RegExp(`^#{2,3} ${id.replace(".", String.raw`\.`)}:`).test(line),
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
      line.match(new RegExp(`^#{2,3} ${id.replace(".", String.raw`\.`)}:`)),
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

/** The option of a question, not of its follow-ups, by the letter it shows. */
function option(id: string, letter: string) {
  const options = within(question(id))
    .getAllByRole("button")
    .filter((b) => b.hasAttribute("aria-pressed") && b.closest("section") === question(id));
  return options.find((b) => within(b).queryByText(letter, { exact: true })) as HTMLElement;
}

/** The comment field of a question, not of its follow-ups. */
function comment(id: string) {
  return within(question(id)).getAllByLabelText("Comment")[0];
}

/** The button saving a question's comment, not its follow-ups'. */
function saveButton(id: string) {
  return within(question(id)).getAllByRole("button", { name: "Save comment" })[0];
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
  expect(answerLine(repo, "Q2")).toBe("**Answer:** A");
  await tap(saveButton("Q2"));

  await waitFor(() =>
    expect(answerLine(repo, "Q2")).toBe("**Answer:** A: but only for the dev server"),
  );
});

/** US2.4 */
test("a comment alone is the answer", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("Which repositories does the UI open now?");

  await type(comment("Q3"), "Neither, keep it simple");
  await tap(saveButton("Q3"));

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
  await tap(screen.getByRole("button", { name: "Save notes" }));

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

/** Review focus 5: a comment saved, then a tap before its save returns, is not a conflict. */
test("quick saves of one answer follow each other", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "first");
  await tap(saveButton("Q2"));
  await tap(option("Q2", "B"));

  // Its state shows once the save's answer comes back, after the file is written.
  expect(await within(question("Q2")).findByText("saved ✓")).toBeTruthy();
  expect(within(question("Q2")).queryByText(/Not saved/)).toBeNull();
  expect(answerLine(repo, "Q2")).toBe("**Answer:** B: first");
});

test("a refused answer keeps its text, and says why", async () => {
  const { repo } = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");
  await tap(option("Q2", "A"));
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** A"));
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** C"));

  await type(comment("Q2"), "mine");
  await tap(saveButton("Q2"));

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
  await tap(saveButton("Q2"));
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

test("a comment being written is not replaced by an answer changed elsewhere", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  await type(comment("Q2"), "half a tho");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  const lines = readFileSync(path, "utf8").split("\n");
  const heading = lines.findIndex((line) => line.startsWith("## Q2:"));
  const at = lines.findIndex((line, index) => index > heading && line.startsWith("**Answer:**"));
  lines[at] = "**Answer:** C";
  writeFileSync(path, lines.join("\n"));

  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });

  // The page read the file again, with the answer changed elsewhere, and drew it.
  await readAnswered("WorkflowFile", from);
  expect((comment("Q2") as HTMLTextAreaElement).value).toBe("half a tho");
  expect(saveButton("Q2").hasAttribute("disabled")).toBe(false);
});

test("Submit saves a comment not saved yet", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "unsaved");
  await tap(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain("**Answer:** A: unsaved");
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
  await tap(screen.getByRole("button", { name: "Save notes" }));
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

/** Final review: a comment whose save was refused is saved by Submit once the page read again. */
test("Submit saves a comment whose save was refused, once the page read the file again", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(path, readFileSync(path, "utf8").replace("**Answer:** A", "**Answer:** A: theirs"));

  await type(comment("Q1"), "mine");
  await tap(saveButton("Q1"));
  expect(await within(question("Q1")).findByText(/Not saved/)).toBeTruthy();
  const from = answersSoFar();
  await act(async () => {
    document.dispatchEvent(new Event("visibilitychange"));
  });
  await readAnswered("WorkflowFile", from);
  expect((comment("Q1") as HTMLTextAreaElement).value).toBe("mine");
  expect(within(question("Q1")).getByText("Unsaved changes")).toBeTruthy();

  await tap(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() =>
    expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(
      "discovery(web-ui): answer round 01",
    ),
  );
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain("**Answer:** A: mine");
});

/**
 * The key under which this browser keeps the round's position in a repository: the list's name of
 * a copy of the fixture is its folder's.
 */
const position = (repo: string) => `uraeda.round.${basename(repo)}/${FOLDER}/clarifications-01.md`;

/** The title of the question that has the focus. */
function focused() {
  const element = document.activeElement;
  return element && /^H[1-6]$/.test(element.tagName) ? (element.textContent ?? "") : "";
}

/** US1 1 */
test("the bar counts and offers Next, without ＋ (US1 1)", async () => {
  atWidth(402);
  await renderPage(PAGE, answered({ Q1: "A" }));
  expect(await screen.findByRole("button", { name: "1/3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Add a priority" })).toBeNull();
});

/** US1 2, 3; SC-005 */
test("Next goes to the first blank question after the one at the top, and focuses it (US1 2, 3)", async () => {
  atWidth(402);
  const repo = answered({ Q1: "A" });
  // The round reopens at Q1, answered: without a position, it would open at Q2, the first blank.
  window.localStorage.setItem(position(repo), "Q1");
  await renderPage(PAGE, repo);
  await screen.findByText("Which human steps does the UI perform?");
  expect(focused()).toContain("Which human steps does the UI perform?");
  await tap(screen.getByRole("button", { name: "Next" }));
  await waitFor(() => expect(focused()).toContain("How does your iPhone reach the server?"));
});

/** US1 4 */
test("with nothing blank, Next becomes Submit (US1 4)", async () => {
  atWidth(402);
  await renderPage(PAGE, answered({ Q1: "A", Q2: "A", Q3: "A" }));
  expect(await screen.findByRole("button", { name: "3/3" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Submit" })).toBeTruthy();
  expect(screen.queryByRole("button", { name: "Next" })).toBeNull();
});

/** US1 5 */
test("the index lists the questions with their state, and jumps (US1 5)", async () => {
  atWidth(402);
  await renderPage(PAGE, answered({ Q1: "A" }));
  await tap(await screen.findByRole("button", { name: "1/3" }));
  const index = await screen.findByRole("dialog", { name: "Questions" });
  const rows = within(index).getAllByRole("button", { name: /^[✓○] Q/ });
  expect(rows.map((row) => row.textContent?.slice(0, 4))).toEqual(["✓ Q1", "○ Q2", "○ Q3"]);
  expect(rows[0].textContent).toContain("Which human steps does the UI perform?");

  await tap(within(index).getByRole("button", { name: /^○ Q3/ }));

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Questions" })).toBeNull());
  await waitFor(() => expect(focused()).toContain("Which repositories does the UI open now?"));
});

/** US1 9 */
test("the round reopens where it was left (US1 9)", async () => {
  const repo = answered({});
  window.localStorage.setItem(position(repo), "Q3");
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");
  expect(focused()).toContain("Which repositories does the UI open now?");
});

/** US1 10 */
test("a new browser opens at the first blank question (US1 10)", async () => {
  await renderPage(PAGE, answered({ Q1: "A" }));
  await screen.findByText("How does your iPhone reach the server?");
  expect(focused()).toContain("How does your iPhone reach the server?");
});

/** The round's position is kept per repository: another's same round opens as on a new browser. */
test("a position saved in another repository does not apply", async () => {
  const repo = answered({ Q1: "A" });
  window.localStorage.setItem(position(answered({})), "Q3");
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  expect(focused()).toContain("How does your iPhone reach the server?");
});

test("a new browser opens a round not started at its top, on its intro", async () => {
  await renderPage(PAGE, answered({}));
  await screen.findByText("How does your iPhone reach the server?");
  expect(focused()).toBe("");
});

/** Edge case: a position saved on a question that no longer applies. */
test("a saved position on a question that no longer applies falls back", async () => {
  const repo = answered({ Q1: "A" });
  window.localStorage.setItem(position(repo), "Q1.B");
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  expect(focused()).toContain("How does your iPhone reach the server?");
});

/** The window's own storage, while a test takes it away; `null` when it came from its prototype. */
let storage: PropertyDescriptor | null | undefined;
afterEach(() => {
  if (storage) {
    Object.defineProperty(window, "localStorage", storage);
  } else if (storage === null) {
    delete (window as { localStorage?: Storage }).localStorage;
  }
  storage = undefined;
});

/** Edge case: no storage, as in a private window. */
test("without storage, the round opens at the first blank question", async () => {
  const repo = answered({ Q1: "A" });
  storage = Object.getOwnPropertyDescriptor(window, "localStorage") ?? null;
  Object.defineProperty(window, "localStorage", {
    configurable: true,
    get() {
      throw new Error("The storage is not available.");
    },
  });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  expect(focused()).toContain("How does your iPhone reach the server?");
});

/** The composer of the feature's session, once the page is drawn. */
function composer() {
  return screen.findByRole("textbox", { name: "Message Claude Code" });
}

/** US6.2 */
test("US6.2: a question's Ask the agent quotes its title", async () => {
  const repo = fixtureRepo();
  await renderPage(PAGE, repo, { agent: true });
  await screen.findByText("Which repositories does the UI open now?");

  await tap(within(question("Q3")).getAllByRole("button", { name: "Ask the agent" })[0]);

  expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`));
  const box = await composer();
  await waitFor(() =>
    expect(box.textContent).toBe(
      `About Q3 of ${ROUND}:\n> Which repositories does the UI open now?\n\n`,
    ),
  );
});

test("without the agent, a question offers no Ask the agent", async () => {
  await renderPage(PAGE, fixtureRepo());
  await screen.findByText("Which repositories does the UI open now?");

  expect(screen.queryByRole("button", { name: "Ask the agent" })).toBeNull();
});

/** US1.4 in an option: its image shows, and a tap on it toggles the option, as on its text. */
test("an option's image is part of the option's toggle", async () => {
  const repo = answered({});
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(
      "still cannot reach the server.",
      "still cannot reach the server. ![Login](images/login.webp)",
    ),
  );
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");
  const a = option("Q2", "A");
  const image = within(a).getByRole("img", { name: "Login" });
  // A toggle holds no link: the image does not open on its own.
  expect(within(a).queryByRole("link")).toBeNull();

  await tap(image);

  expect(option("Q2", "A").getAttribute("aria-pressed")).toBe("true");
  expect(screen.queryByRole("dialog", { name: "Login" })).toBeNull();
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** A"));
});

/** The address a request goes to. */
const urlOf = (input: RequestInfo | URL) =>
  typeof input === "object" && "url" in input ? input.url : input.toString();

/** A PNG, as the picker gives it. */
const png = (name: string) =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Picks files with an "Add image" button, named for its field, as the system's picker gives them. */
async function pick(name: string, files: Array<File>) {
  const input = screen.getByLabelText(name, { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/**
 * The server in process, whose uploads, and the requests `alsoHold` picks, wait until the test lets
 * each one through.
 */
function hold(repo: string, alsoHold: (body: string) => boolean = () => false) {
  const fetch = serverFetch(repo);
  const waiting: Array<() => void> = [];
  return {
    fetch: (async (input, init) => {
      const body = typeof init?.body === "string" ? init.body : "";
      if (urlOf(input).includes("/attach?") || alsoHold(body)) {
        await new Promise<void>((resolve) => waiting.push(resolve));
      }
      return fetch(input, init);
    }) as typeof globalThis.fetch,
    waiting,
    /** Lets the next request held through, once it waits. */
    async release() {
      await waitFor(() => expect(waiting.length).toBeGreaterThan(0));
      await act(async () => waiting.shift()!());
    },
  };
}

const LINK = "![login](images/login.webp)";
const IMAGES = `specs/${FOLDER}/images`;

/** The images the round's branch holds. */
const committedImages = (repo: string) =>
  git(repo, "ls-tree", "-r", "--name-only", FOLDER, IMAGES).trim();

const SUBMITTED = "discovery(web-ui): answer round 01";

/** Review: several "Add image" buttons on one page are told apart by their field. */
test("each Add image names its field, and shows Add image", async () => {
  await renderPage(PAGE, answered({}));
  await screen.findByText("How does your iPhone reach the server?");

  const q2 = screen.getByRole("button", { name: "Add image to Q2's comment" });
  expect(q2.textContent).toBe("Add image");
  expect(screen.getByRole("button", { name: "Add image to the notes" }).textContent).toBe(
    "Add image",
  );
  expect(screen.queryByRole("button", { name: "Add image" })).toBeNull();
});

/** US4.1 with the picker: the answer holds the image's link at once. */
test("Add image on an answer links the image in its comment, saved at once", async () => {
  const repo = answered({ Q2: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");

  await pick("Add image to Q2's comment", [png("login.png")]);

  await waitFor(() => expect((comment("Q2") as HTMLTextAreaElement).value).toBe(`${LINK}\n`));
  await waitFor(() => expect(answerLine(repo, "Q2")).toBe(`**Answer:** A: ${LINK}`));
  expect(existsSync(join(repo, ".worktrees", FOLDER, IMAGES, "login.webp"))).toBe(true);
});

/** US4.2 with the picker: the notes hold the image's link, saved. */
test("Add image on the notes links the image at their end, saved", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  const notes = (await screen.findByLabelText("Notes")) as HTMLTextAreaElement;
  await type(notes, "See:");

  await pick("Add image to the notes", [png("login.png")]);

  await waitFor(() => expect(notes.value).toBe(`See:\n\n${LINK}\n`));
  await waitFor(() => expect(text(repo)).toContain(`**Notes:** See:`));
  await waitFor(() => expect(text(repo)).toContain(LINK));
});

/** Review focus 11, R64: Submit waits for an answer's image, and commits it with the round. */
test("Submit during an answer's upload commits the round with the image", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const held = hold(repo);
  await renderPage(PAGE, repo, { fetch: held.fetch });
  await screen.findByText("How does your iPhone reach the server?");
  await pick("Add image to Q2's comment", [png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));

  await tap(screen.getByRole("button", { name: "Submit answers" }));
  await held.release();

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain(`**Answer:** A: ${LINK}`);
  expect(committedImages(repo)).toBe(`${IMAGES}/login.webp`);
});

/** Review: a follow-up gone during its upload still has its image saved before Submit commits. */
test("Submit waits for the image of a follow-up that stopped applying during its upload", async () => {
  const repo = answered({ Q1: "B", Q2: "A", Q3: "A" });
  const held = hold(repo);
  await renderPage(PAGE, repo, { fetch: held.fetch });
  await waitFor(() => expect(question("Q1.B")).toBeTruthy());
  await pick("Add image to Q1.B's comment", [png("login.png")]);
  await waitFor(() => expect(held.waiting).toHaveLength(1));

  await tap(option("Q1", "A"));
  await tap(option("Q1", "B"));
  await waitFor(() => expect(question("Q1.B")).toBeNull());
  await tap(screen.getByRole("button", { name: "Submit answers" }));
  await held.release();

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  expect(git(repo, "show", `${FOLDER}:${ROUND}`)).toContain(LINK);
  expect(committedImages(repo)).toBe(`${IMAGES}/login.webp`);
});

/** Review: an answer saved at once for its image is not saved again by Submit. */
test("Submit does not save again an answer saved for its image", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const saves: Array<string> = [];
  let holdSave = true;
  const held = hold(repo, (body) => {
    if (!body.includes("images/login.webp") || body.includes("submit")) {
      return false;
    }
    saves.push(body);
    const now = holdSave;
    holdSave = false;
    return now;
  });
  await renderPage(PAGE, repo, { fetch: held.fetch });
  await screen.findByText("How does your iPhone reach the server?");
  await pick("Add image to Q2's comment", [png("login.png")]);
  await held.release();
  // The answer's save, held while Submit starts.
  await waitFor(() => expect(saves).toHaveLength(1));

  await tap(screen.getByRole("button", { name: "Submit answers" }));
  await held.release();

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  expect(saves).toHaveLength(1);
});

/** Review: the bar's Submit takes the focus to "Submit answers", not to the notes' buttons. */
test("the bar's Submit focuses Submit answers", async () => {
  atWidth(402);
  await renderPage(PAGE, answered({ Q1: "A", Q2: "A", Q3: "A" }));
  await screen.findByRole("button", { name: "3/3" });

  await tap(screen.getByRole("button", { name: "Submit" }));

  expect(document.activeElement).toBe(screen.getByRole("button", { name: "Submit answers" }));
});

/** US2 1 and 2 */
test("a tap saves the letters with the comment as saved, and Save comment the comment typed", async () => {
  const repo = answered({ Q2: "Fine" });
  await renderPage(PAGE, repo);
  await screen.findByText("How does your iPhone reach the server?");

  await type(comment("Q2"), "Fine, but daily only");
  await tap(option("Q2", "B"));

  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** B: Fine"));
  expect(await within(question("Q2")).findByText("Unsaved changes")).toBeTruthy();
  expect((comment("Q2") as HTMLTextAreaElement).value).toBe("Fine, but daily only");

  await tap(saveButton("Q2"));

  await waitFor(() => expect(answerLine(repo, "Q2")).toBe("**Answer:** B: Fine, but daily only"));
  await waitFor(() => expect(within(question("Q2")).queryByText("Unsaved changes")).toBeNull());
});

/** The first point the fixture's round settled without the human, and the second. */
const COMMITS = "The actions' commits move into the core";
const WRITTEN = "An answer is written";

/** A settled point's toggle, named by its text, which starts with its bold subject. */
const settledPoint = (subject: string) =>
  screen.findByRole("button", { name: new RegExp(`^${subject}`) });

/** The comment field of the settled point's form open. */
const settledField = () => screen.getByLabelText("Comment text") as HTMLTextAreaElement;

/** US5 9 */
test("Submit saves a comment, the notes, and a settled point's comment typed, then submits", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");
  await type(comment("Q3"), "keep it simple");
  await type(screen.getByLabelText("Notes"), "LGTM");
  await tap(await settledPoint(COMMITS));
  await type(settledField(), "Good.");

  await tap(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  const committed = git(repo, "show", `${FOLDER}:${ROUND}`);
  expect(committed).toContain("**Answer:** A: keep it simple");
  expect(committed.trimEnd()).toMatch(
    /\*\*Notes:\*\* LGTM\n\n- \*\*The actions' commits move into the core\*\*: Good\.$/,
  );
});

/** Review focus 5 */
test("Submit adds no comment for a settled point's form left blank", async () => {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(
      /\*\*Notes:\*\*\n?$/,
      `**Notes:**\n\n- **${WRITTEN}**: Clear.\n`,
    ),
  );
  await renderPage(PAGE, repo);
  await tap(await settledPoint(COMMITS));
  await type(settledField(), "   ");
  // An edit cleared: the store keeps its blank text, unsaved.
  const shown = screen.getByRole("group", { name: `Your comment on "${WRITTEN}"` });
  await tap(within(shown).getByRole("button", { name: "Edit" }));
  await type(settledField(), "");

  await tap(screen.getByRole("button", { name: "Submit answers" }));

  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  const committed = git(repo, "show", `${FOLDER}:${ROUND}`);
  expect(committed.trimEnd()).toMatch(/\*\*Notes:\*\*\n\n- \*\*An answer is written\*\*: Clear\.$/);
});

/** A round answered, whose notes hold a comment on each settled point. */
function withTwoComments() {
  const repo = answered({ Q1: "A", Q2: "A", Q3: "A" });
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace(
      /\*\*Notes:\*\*\n?$/,
      `**Notes:**\n\n- **${COMMITS}**: Undo comment.\n- **${WRITTEN}**: Delete comment.\n`,
    ),
  );
  return { path, repo };
}

/** A settled point's comment shown, by its subject. */
const settledComment = (subject: string) =>
  screen.getByRole("group", { name: `Your comment on "${subject}"` });

/** Edits a settled point's comment, then taps the other point: the edit stays unsaved. */
async function editThenLeave(subject: string, text: string, other: string) {
  await tap(
    within(await waitFor(() => settledComment(subject))).getByRole("button", { name: "Edit" }),
  );
  await type(settledField(), text);
  await tap(await settledPoint(other));
}

/** The round's notes as committed by Submit. */
async function submittedNotes(repo: string) {
  await tap(screen.getByRole("button", { name: "Submit answers" }));
  await waitFor(() => expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).toBe(SUBMITTED));
  const committed = git(repo, "show", `${FOLDER}:${ROUND}`);
  return committed.slice(committed.indexOf("**Notes:**")).trimEnd();
}

/** Final review: an edit of a comment removed goes with it, never into the comment renumbered. */
test("Submit does not write the edit of a comment removed into the next one", async () => {
  const { repo } = withTwoComments();
  await renderPage(PAGE, repo);
  await editThenLeave(COMMITS, "Edited undo comment.", WRITTEN);

  await tap(within(settledComment(COMMITS)).getByRole("button", { name: "Remove" }));
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: `Your comment on "${COMMITS}"` })).toBeNull(),
  );

  expect(await submittedNotes(repo)).toBe(`**Notes:**\n\n- **${WRITTEN}**: Delete comment.`);
});

/** Final review: an edit pending on a later comment follows it as a removal renumbers it. */
test("Submit writes the edit of a comment renumbered by a removal into that comment", async () => {
  const { repo } = withTwoComments();
  await renderPage(PAGE, repo);
  await editThenLeave(WRITTEN, "Edited delete comment.", COMMITS);

  await tap(within(settledComment(COMMITS)).getByRole("button", { name: "Remove" }));
  await waitFor(() =>
    expect(screen.queryByRole("group", { name: `Your comment on "${COMMITS}"` })).toBeNull(),
  );

  expect(await submittedNotes(repo)).toBe(`**Notes:**\n\n- **${WRITTEN}**: Edited delete comment.`);
});

/** Final review: a comment removed elsewhere renumbers the others: its edit is not written. */
test("Submit does not write an edit into another comment after a removal made elsewhere", async () => {
  const { path, repo } = withTwoComments();
  await renderPage(PAGE, repo);
  await editThenLeave(COMMITS, "Edited undo comment.", WRITTEN);

  writeFileSync(path, readFileSync(path, "utf8").replace(`- **${COMMITS}**: Undo comment.\n`, ""));
  await refreshUntil(() =>
    expect(screen.queryByRole("group", { name: `Your comment on "${COMMITS}"` })).toBeNull(),
  );

  expect(await submittedNotes(repo)).toBe(`**Notes:**\n\n- **${WRITTEN}**: Delete comment.`);
});

/** Final review: an edit kept for a comment changed elsewhere since is not written over it. */
test("Submit stops at the edit of a comment changed elsewhere since it began", async () => {
  const { path, repo } = withTwoComments();
  await renderPage(PAGE, repo);
  await editThenLeave(COMMITS, "Edited undo comment.", WRITTEN);

  writeFileSync(path, readFileSync(path, "utf8").replace("Undo comment.", "Theirs."));
  await refreshUntil(() =>
    expect(within(settledComment(COMMITS)).getByText("Theirs.")).toBeTruthy(),
  );
  await tap(screen.getByRole("button", { name: "Submit answers" }));

  expect(await screen.findByText(/Some answers were not saved/)).toBeTruthy();
  expect(readFileSync(path, "utf8")).toContain(`- **${COMMITS}**: Theirs.`);
  expect(git(repo, "log", "-1", "--format=%s", FOLDER).trim()).not.toBe(SUBMITTED);
});

/** US5 1, on a question's comment */
test("a question's comment typed is restored after a reload", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");
  await type(comment("Q3"), "Half typed");

  forgetUnsaved();
  await renderPage(PAGE, repo, { reload: true });

  await screen.findByText("Which repositories does the UI open now?");
  expect((comment("Q3") as HTMLTextAreaElement).value).toBe("Half typed");
  expect(
    within(question("Q3")).getByText("Unsaved text restored from", { exact: false }),
  ).toBeTruthy();
  expect(within(question("Q3")).getByText("Unsaved changes")).toBeTruthy();
});

/** The spec's edge case: the round answered elsewhere while a comment is unsaved. */
test("an unsaved comment of a round answered elsewhere stays, with the notice", async () => {
  const repo = answered({});
  await renderPage(PAGE, repo);
  await screen.findByText("Which repositories does the UI open now?");
  await type(comment("Q3"), "Too late");

  const path = join(repo, ".worktrees", FOLDER, ROUND);
  writeFileSync(
    path,
    readFileSync(path, "utf8").replace("status: awaiting-human", "status: answered"),
  );
  await refreshUntil(() =>
    expect(screen.queryByRole("button", { name: "Submit answers" })).toBeNull(),
  );

  expect(
    within(question("Q3")).getByText("The round was answered.", { exact: false }),
  ).toBeTruthy();
  expect(within(question("Q3")).queryByText("Too late")).toBeNull();
  await tap(within(question("Q3")).getByRole("button", { name: "Discard" }));
  expect(
    within(question("Q3")).queryByText("The round was answered.", { exact: false }),
  ).toBeNull();
});
