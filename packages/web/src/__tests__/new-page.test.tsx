// The New page: three cards, a group of radios in the URL, pick a session, a change, or a feature,
// each with its sentence, its example, what it ends with, and what waits on the human (US5).
// Session sends a first message in the main checkout; Change starts a change from a typed text, an
// inbox note, or a priority line, and opens its session; Feature drafts a new title, a note, or a
// priority line, and opens it in the editor.
// "Start the change" from a typed text opens its session, where its agent works. The edge case "No
// agent on this machine": the session opens with the workflow's message in its composer, unsent, as
// a feature's hand-over does. A start that answers once the human left opens nothing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  click,
  fakeAgent,
  fixtureRepo,
  git,
  quiet,
  read,
  renderPage,
  serverFetch,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-16");

const FOLDER = "2026-10-16-centre-x";

const NOTE = "The PR texts lack context: start with what was done";

/** The fixture, with the spec's note in the inbox and "Empty inbox" in Next, both committed. */
function startingRepo() {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/INBOX.md"),
    read(repo, "specs/INBOX.md").replace(
      "- We need a home icon\n",
      `- We need a home icon\n- ${NOTE}\n`,
    ),
  );
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("\n## Later\n", "- Empty inbox\n\n## Later\n"),
  );
  git(repo, "commit", "-qam", "chore: the spec's note and line");
  return repo;
}

/** A kind's card, in the New page's group of cards. */
function card(kind: string) {
  const group = screen.getByRole("radiogroup", { name: "What to start" });
  return within(group).getByRole("radio", { name: kind });
}

/** A card's facts, each label then its value, as they read. */
function facts(kind: string) {
  const values = within(card(kind)).getAllByRole("definition");
  return within(card(kind))
    .getAllByRole("term")
    .flatMap((label, index) => [label.textContent, values[index]?.textContent]);
}

/** Picks a kind by its card. */
async function pick(kind: string) {
  await screen.findByRole("radiogroup", { name: "What to start" });
  await click(card(kind));
  await waitFor(() => expect(card(kind).getAttribute("aria-checked")).toBe("true"));
}

/** The entries of a section of `PRIORITIES.md`, as written. */
function entries(repo: string, title: string) {
  const section = read(repo).split(`## ${title}\n`)[1].split("\n## ")[0];
  return section.split("\n").filter((line) => line.startsWith("- "));
}

/** US3 1, US5 1 */
test("US5.1: New without a kind picks Session, its composer under the cards", async () => {
  const fake = await fakeAgent();
  await renderPage("/new", fixtureRepo(), { agent: fake });

  await screen.findByRole("radiogroup", { name: "What to start" });
  expect(card("Session").getAttribute("aria-checked")).toBe("true");
  expect(card("Change").getAttribute("aria-checked")).toBe("false");
  expect(card("Feature").getAttribute("aria-checked")).toBe("false");
  expect(
    within(card("Session")).getByText(
      "Talk to the agent in the main checkout, like plain Claude Code.",
    ),
  ).toBeTruthy();
  const box = screen.getByRole("textbox", { name: "Message Claude Code" });
  // Under the cards.
  expect(card("Feature").compareDocumentPosition(box) & Node.DOCUMENT_POSITION_FOLLOWING).not.toBe(
    0,
  );
  await type(box, "List the drafts");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/sessions/")}[^/]+$`)),
  );
  expect(fake.adapter.sent[0].text).toBe("List the drafts");
});

/** US5 2 */
test("US5.2: picking Feature marks it, puts it in the address, and shows its form", async () => {
  await renderPage("/new", startingRepo(), { agent: await fakeAgent() });

  await pick("Feature");

  expect(card("Session").getAttribute("aria-checked")).toBe("false");
  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=feature"));
  expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
  expect(screen.getByRole("button", { name: "Write the proposal" })).toBeTruthy();
  expect(await screen.findByText("Or start from a note or a priority")).toBeTruthy();
  expect(screen.queryByRole("textbox", { name: "Message Claude Code" })).toBeNull();
});

/** US5 3 */
test("US5.3: each card says what it ends with and what waits on you", async () => {
  await renderPage("/new", fixtureRepo());
  await screen.findByRole("radiogroup", { name: "What to start" });

  expect(facts("Session")).toEqual(["Ends with", "the chat", "Waits on you", "nothing"]);
  expect(facts("Change")).toEqual([
    "Ends with",
    "a pull request",
    "Waits on you",
    "the pull request",
  ]);
  expect(facts("Feature")).toEqual([
    "Ends with",
    "a spec, then a pull request",
    "Waits on you",
    "questions, then the spec",
  ]);
});

/** A radio's content is presentational: the card's body is its description, read with its name. */
test("each card's sentence and facts are its radio's description", async () => {
  await renderPage("/new", fixtureRepo());
  await screen.findByRole("radiogroup", { name: "What to start" });

  expect(
    screen.getByRole("radio", { description: /Ends with ?a pull request/, name: "Change" }),
  ).toBe(card("Change"));
  expect(
    screen.getByRole("radio", {
      description: /Ends with ?a spec, then a pull request/,
      name: "Feature",
    }),
  ).toBe(card("Feature"));
});

/** US5, each card's sentence and example. */
test("each card has its sentence and its example", async () => {
  await renderPage("/new", fixtureRepo());
  await screen.findByRole("radiogroup", { name: "What to start" });

  for (const [kind, sentence, example] of [
    [
      "Session",
      "Talk to the agent in the main checkout, like plain Claude Code.",
      "“Why is CI slow?”",
    ],
    ["Change", "A bug fix or a small change, on its own branch.", "“Fix the due-date typo”"],
    [
      "Feature",
      "A larger piece of work, designed with the agent before any code.",
      "“Add recurring tasks”",
    ],
  ]) {
    expect(within(card(kind)).getByText(sentence)).toBeTruthy();
    expect(within(card(kind)).getByText(example)).toBeTruthy();
  }
});

/** Presses a key on the element that has the focus. */
async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement!, { key });
  });
}

/** Waits for a kind's card to be picked, as the address changes. */
async function picked(kind: string) {
  await waitFor(() => expect(card(kind).getAttribute("aria-checked")).toBe("true"));
}

/** US5 more 2 */
test("US5 more 2: the arrow keys move the pick, and Space picks, as in a group of radio buttons", async () => {
  await renderPage("/new", fixtureRepo());
  await screen.findByRole("radiogroup", { name: "What to start" });
  // One stop in the tab order: the picked card.
  expect(card("Session").tabIndex).toBe(0);
  expect(card("Change").tabIndex).toBe(-1);
  card("Session").focus();

  await press("ArrowRight");
  await picked("Change");
  expect(document.activeElement).toBe(card("Change"));
  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=change"));

  await press("End");
  await picked("Feature");
  expect(document.activeElement).toBe(card("Feature"));
  // Past the last, the first.
  await press("ArrowDown");
  await picked("Session");
  await press("ArrowLeft");
  await picked("Feature");
  await press("Home");
  await picked("Session");
  expect(document.activeElement).toBe(card("Session"));
  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new"));

  // Space picks the focused card, unpicked.
  card("Change").focus();
  await press(" ");
  await picked("Change");
  expect(document.activeElement).toBe(card("Change"));
});

test("an arrow with a modifier is the browser's, as Alt+Right is Forward: the pick stays", async () => {
  await renderPage("/new", fixtureRepo());
  await screen.findByRole("radiogroup", { name: "What to start" });
  card("Session").focus();

  for (const modifier of ["altKey", "ctrlKey", "metaKey"]) {
    // `fireEvent` answers false when the page took the key from the browser.
    expect(fireEvent.keyDown(card("Session"), { key: "ArrowRight", [modifier]: true })).toBe(true);
  }
  expect(card("Session").getAttribute("aria-checked")).toBe("true");
  expect(document.activeElement).toBe(card("Session"));
});

/** SC-005: the kind is the address's, so a reload, which renders the address again, keeps it. */
test("SC-005: a reload keeps the picked kind", async () => {
  await renderPage("/new?kind=feature", fixtureRepo());

  await screen.findByRole("radiogroup", { name: "What to start" });
  expect(card("Feature").getAttribute("aria-checked")).toBe("true");
  expect(card("Session").getAttribute("aria-checked")).toBe("false");
  expect(screen.getByRole("textbox", { name: "Title" })).toBeTruthy();
});

/** The ui-layout decision: the kind picked is in the URL. */
test("the kind picked is in the address", async () => {
  await renderPage("/new", fixtureRepo());

  await pick("Change");
  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=change"));
  await pick("Session");
  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new"));
});

/** US3 2, SC-004: two clicks, Change, then the note's "Start the change". */
test("a change from an inbox note", async () => {
  const repo = startingRepo();
  // The human's edit elsewhere in the main checkout stays, uncommitted.
  writeFileSync(join(repo, "specs/README.md"), "# Specs, edited\n");
  const fake = await fakeAgent();
  fake.adapter.script([]);
  await renderPage("/new", repo, { agent: fake });

  await pick("Change");
  await click(await screen.findByRole("button", { name: `Start the change: ${NOTE}` }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(
      new RegExp(`^${atRepo("/f/2026-10-16-")}[^/]+/session$`),
    ),
  );
  expect(window.location.search).toBe("");
  expect(read(repo, "specs/INBOX.md")).not.toContain(NOTE);
  // The note left the inbox in a commit of its own.
  expect(git(repo, "status", "--porcelain", "specs/INBOX.md")).toBe("");
  expect(read(repo, "specs/README.md")).toBe("# Specs, edited\n");
  const folder = window.location.pathname.split("/f/")[1].split("/")[0];
  expect(git(repo, "show", `change/${folder}:specs/changes/${folder}/proposal.md`)).toContain(
    "The PR texts lack context",
  );
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].text).toMatch(
    new RegExp(`^/uraeda Continue the change specs/changes/${folder}/`),
  );
});

test("a change from a note that cannot start keeps the note", async () => {
  const repo = startingRepo();
  // The name the note's change would take.
  git(repo, "branch", "change/2026-10-16-pr-texts");
  await renderPage("/new?kind=change", repo, { agent: await fakeAgent() });

  await click(await screen.findByRole("button", { name: `Start the change: ${NOTE}` }));

  await screen.findByText(/exists/);
  expect(window.location.pathname).toBe(atRepo("/new"));
  expect(read(repo, "specs/INBOX.md")).toContain(NOTE);
});

/** US3 2, SC-004, from a priority line: two clicks, and the change's agent works. */
test("a change from a priority line", async () => {
  const fake = await fakeAgent();
  fake.adapter.script([]);
  await renderPage("/new", startingRepo(), { agent: fake });

  await pick("Change");
  await click(await screen.findByRole("button", { name: "Start the change: Empty inbox" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(
      new RegExp(`^${atRepo("/f/2026-10-16-")}[^/]+/session$`),
    ),
  );
  expect(window.location.search).toBe("");
  const folder = window.location.pathname.split("/f/")[1].split("/")[0];
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
  expect(fake.adapter.sent[0].text).toMatch(
    new RegExp(`^/uraeda Continue the change specs/changes/${folder}/`),
  );
});

/** US3 3 */
test("a feature from a title", async () => {
  const repo = fixtureRepo();
  // Now's started features, then a line not started yet.
  const started = entries(repo, "Now");
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace("\n## Next\n", "- Empty inbox\n\n## Next\n"),
  );
  await renderPage("/new?kind=feature", repo);

  await type(await screen.findByRole("textbox", { name: "Title" }), "Keyboard navigation");
  await click(screen.getByRole("button", { name: "Write the proposal" }));

  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/keyboard-navigation.md")),
  );
  expect(entries(repo, "Now")).toEqual([
    ...started,
    "- [Keyboard navigation](drafts/keyboard-navigation.md)",
    "- Empty inbox",
  ]);
});

test("a feature from a title whose draft cannot be written leaves Now as it was", async () => {
  const repo = fixtureRepo();
  // The draft the title would be written to.
  writeFileSync(join(repo, "specs/drafts/keyboard-navigation.md"), "# Keyboard navigation\n");
  const before = read(repo);
  await renderPage("/new?kind=feature", repo);

  await type(await screen.findByRole("textbox", { name: "Title" }), "Keyboard navigation");
  await click(screen.getByRole("button", { name: "Write the proposal" }));

  await screen.findByText("specs/drafts/keyboard-navigation.md exists");
  expect(read(repo)).toBe(before);
  // The title stays, to change and send again.
  expect((screen.getByRole("textbox", { name: "Title" }) as HTMLInputElement).value).toBe(
    "Keyboard navigation",
  );
  expect(window.location.pathname).toBe(atRepo("/new"));
});

test("a start whose read fails shows why", async () => {
  const repo = startingRepo();
  const server = serverFetch(repo);
  let failing = false;
  const fetch: typeof globalThis.fetch = async (input, init) => {
    // The start's first read fails, once.
    if (failing) {
      failing = false;
      throw new TypeError("Failed to fetch");
    }
    return server(input, init);
  };
  await renderPage("/new?kind=feature", repo, { fetch });
  const start = await screen.findByRole("button", { name: `Open the draft: ${NOTE}` });

  failing = true;
  await click(start);

  expect(await screen.findByText("Failed to fetch")).toBeTruthy();
  expect(read(repo, "specs/INBOX.md")).toContain(NOTE);
});

/** US3 more 1 */
test("a feature from a priority line", async () => {
  await renderPage("/new?kind=feature", startingRepo());

  await click(await screen.findByRole("button", { name: "Open the draft: Empty inbox" }));

  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/empty-inbox.md")),
  );
});

test("without the agent, the change's page opens with its message unsent", async () => {
  const fake = await fakeAgent({ installed: false });
  await renderPage("/new?kind=change", fixtureRepo(), { agent: fake });

  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Centre the x in failure circles\n\nIn failures the x sits low in its circle.");
  const slug = screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe("centre-x"));
  await click(screen.getByRole("button", { name: "Start the change" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`)));
  expect(window.location.search).toBe("?continue=start");
  // The session's composer, holding the workflow's message, unsent.
  await waitFor(() =>
    expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toMatch(
      new RegExp(`^/uraeda Continue the change specs/changes/${FOLDER}/`),
    ),
  );
  expect(screen.getByRole("button", { name: "Start the agent" })).toBeTruthy();
  expect(fake.adapter.sent).toHaveLength(0);
});

test("with the agent, the change's session opens, where its agent works", async () => {
  const fake = await fakeAgent();
  fake.adapter.script([]);
  await renderPage("/new?kind=change", fixtureRepo(), { agent: fake });

  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Centre the x in failure circles");
  const slug = screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe("centre-x"));
  await click(screen.getByRole("button", { name: "Start the change" }));

  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${FOLDER}/session`)));
  expect(window.location.search).toBe("");
  await waitFor(() => expect(fake.adapter.sent).toHaveLength(1));
});

/** New change, its `change.start` requests held in `held` until released. */
async function renderHeld() {
  const fake = await fakeAgent({ installed: false });
  const repo = fixtureRepo();
  const server = serverFetch(repo, fake.sessions);
  const held: Array<() => void> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (typeof init?.body === "string" && init.body.includes("change.start")) {
      await new Promise<void>((resolve) => held.push(resolve));
    }
    return server(input, init);
  };
  await renderPage("/new?kind=change", repo, { agent: fake, fetch });
  return held;
}

test("a start that answers after the human left opens nothing, and shows progress until then", async () => {
  const held = await renderHeld();
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Centre the x in failure circles");
  const slug = screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement;
  await waitFor(() => expect(slug.value).toBe("centre-x"));
  const start = screen.getByRole("button", { name: "Start the change" });

  await click(start);
  await waitFor(() => expect(held).toHaveLength(1));
  // Busy, its name kept, while the change starts.
  expect(start.getAttribute("aria-busy")).toBe("true");
  await act(async () => navigate(atRepo("/priorities")));
  await act(async () => held.shift()!());
  await quiet();

  expect(window.location.pathname).toBe(atRepo("/priorities"));
  expect(window.location.search).toBe("");
  // The change started: its text and slug are gone, so it cannot be started twice.
  await act(async () => navigate(atRepo("/new?kind=change")));
  const again = await screen.findByRole("textbox", { name: "Message Claude Code" });
  expect(again.textContent).toBe("");
  expect((screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe("");
});

test("a start that answers late clears only the text and slug it sent", async () => {
  const held = await renderHeld();
  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "Centre the x in failure circles",
  );
  await waitFor(() =>
    expect((screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe(
      "centre-x",
    ),
  );
  await click(screen.getByRole("button", { name: "Start the change" }));
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => navigate(atRepo("/priorities")));
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await act(async () => navigate(atRepo("/new?kind=change")));

  // A newer text and slug, typed while the first change starts.
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Widen the sidebar");
  await type(screen.getByRole("textbox", { name: "Slug" }), "sidebar-width");
  await act(async () => held.shift()!());
  await quiet();

  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=change"));
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toBe(
    "Widen the sidebar",
  );
  expect((screen.getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe(
    "sidebar-width",
  );
});
