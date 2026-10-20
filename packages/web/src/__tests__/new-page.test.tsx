// The New page: one selector, in the URL, picks a session, a change, or a feature, each with its
// sentence and the steps that wait on the human. Session sends a first message in the main
// checkout; Change starts a change from a typed text, an inbox note, or a priority line, and opens
// its session; Feature drafts a new title, a note, or a priority line, and opens it in the editor.
// "Start the change" from a typed text opens its session, where its agent works. The edge case "No
// agent on this machine": the session opens with the workflow's message in its composer, unsent, as
// a feature's hand-over does. A start that answers once the human left opens nothing.
import { writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, screen, waitFor, within } from "@testing-library/react";
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

/** Picks a kind in the New page's selector. */
async function pick(kind: string) {
  const selector = await screen.findByRole("radiogroup", { name: "What to start" });
  const radio = within(selector).getByRole("radio", { name: kind });
  await click(radio);
  await waitFor(() => expect(radio.getAttribute("aria-checked")).toBe("true"));
}

/** The entries of a section of `PRIORITIES.md`, as written. */
function entries(repo: string, title: string) {
  const section = read(repo).split(`## ${title}\n`)[1].split("\n## ")[0];
  return section.split("\n").filter((line) => line.startsWith("- "));
}

/** US3 1 */
test("＋ New opens Session, with its sentence", async () => {
  const fake = await fakeAgent();
  await renderPage("/new", fixtureRepo(), { agent: fake });

  const selector = await screen.findByRole("radiogroup", { name: "What to start" });
  expect(
    within(selector).getByRole("radio", { name: "Session" }).getAttribute("aria-checked"),
  ).toBe("true");
  expect(
    screen.getByText(
      "A conversation with the agent, in the main checkout, like plain Claude Code. It offers a change when the work grows.",
    ),
  ).toBeTruthy();
  expect(screen.queryByText("Prompt")).toBeNull();
  await type(screen.getByRole("textbox", { name: "Message Claude Code" }), "List the drafts");
  await click(screen.getByRole("button", { name: "Send" }));

  await waitFor(() =>
    expect(window.location.pathname).toMatch(new RegExp(`^${atRepo("/sessions/")}[^/]+$`)),
  );
  expect(fake.adapter.sent[0].text).toBe("List the drafts");
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

/** US3 more 1 */
test("a feature from a priority line", async () => {
  await renderPage("/new?kind=feature", startingRepo());

  await click(await screen.findByRole("button", { name: "Open the draft: Empty inbox" }));

  await waitFor(() =>
    expect(window.location.pathname).toBe(atRepo("/edit/specs/drafts/empty-inbox.md")),
  );
});

/** US3, its paragraph */
test("the steps that wait on you", async () => {
  await renderPage("/new?kind=change", fixtureRepo());

  await screen.findByText(
    "A bug fix or a small change, on its own branch. The agent asks only what it must, then opens a pull request.",
  );
  for (const step of ["Prompt", "Questions, if any", "Pull request"]) {
    expect(screen.getByText(step)).toBeTruthy();
  }
  expect(screen.queryByText("Spec")).toBeNull();
  await pick("Feature");
  await screen.findByText(
    "A larger piece of work, on its own branch. You answer its questions and approve its spec before any code.",
  );
  for (const step of ["Prompt", "Questions", "Spec", "Pull request"]) {
    expect(screen.getByText(step)).toBeTruthy();
  }
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
