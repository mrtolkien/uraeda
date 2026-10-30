// The New page's start of a change, held: a start that answers late clears only the text it sent,
// not what the human typed after. The slug is asked in a dialog once the text is sent, and is not
// kept on the page. The lines of the priorities it was filled from leave them.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { forgetUnsaved, unsavedKey } from "../fields/unsaved.ts";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  click,
  fakeAgent,
  fixture,
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

test("a start that answers late clears only the text it sent", async () => {
  const held = await renderHeld();
  await type(
    await screen.findByRole("textbox", { name: "Message Claude Code" }),
    "Centre the x in failure circles",
  );
  // Sending the text asks its slug, the one the core proposes for it.
  await click(screen.getByRole("button", { name: "Start the change" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the change" });
  await waitFor(() =>
    expect((within(dialog).getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value).toBe(
      "centre-x",
    ),
  );
  await click(within(dialog).getByRole("button", { name: "Start the change" }));
  await waitFor(() => expect(held).toHaveLength(1));
  await act(async () => navigate(atRepo("/priorities")));
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await act(async () => navigate(atRepo("/new?kind=change")));

  // A newer text, typed while the first change starts.
  const box = await screen.findByRole("textbox", { name: "Message Claude Code" });
  await type(box, "Widen the sidebar");
  await act(async () => held.shift()!());
  await quiet();

  expect(`${window.location.pathname}${window.location.search}`).toBe(atRepo("/new?kind=change"));
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toBe(
    "Widen the sidebar",
  );
});

/** New change, filled from the cards of the priorities' lines with these texts, in order. */
async function filledFrom(repo: string, texts: ReadonlyArray<string>) {
  const fake = await fakeAgent({ installed: false });
  await renderPage("/new?kind=change", repo, {
    agent: fake,
    fetch: serverFetch(repo, fake.sessions),
  });
  for (const text of texts) {
    await click(await screen.findByRole("button", { name: new RegExp(`^${text}`) }));
  }
  await quiet();
}

/** Starts the change in the composer, under the slug the core proposes. */
async function start() {
  await click(await screen.findByRole("button", { name: "Start the change" }));
  const dialog = await screen.findByRole("dialog", { name: "Name the change" });
  await waitFor(() =>
    expect(
      (within(dialog).getByRole("textbox", { name: "Slug" }) as HTMLInputElement).value,
    ).not.toBe(""),
  );
  await click(within(dialog).getByRole("button", { name: "Start the change" }));
  await quiet();
}

/** The start replaces only a line of Now: a line of Next it starts from is taken out as before. */
test("a change started from a line of Next takes it out of the priorities", async () => {
  const repo = fixtureRepo();
  await filledFrom(repo, ["Claude Code runner"]);
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
    "Claude Code runner (triggered manually)",
  );

  await start();

  await waitFor(() =>
    expect(read(repo)).not.toContain("\n- Claude Code runner (triggered manually)\n"),
  );
  expect(read(repo)).toContain("Git listener process");
});

/**
 * The start moves its line up, as the change's link, under Now's started lines, which moves the
 * lines it passes down: another line of Now it was filled from is taken out by its text, never by
 * the position it had, which the link now holds.
 */
test("a change started from two lines of Now takes the second out by its text", async () => {
  const repo = fixtureRepo();
  const priorities = join(repo, "specs/PRIORITIES.md");
  writeFileSync(
    priorities,
    read(repo).replace(
      "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n",
      "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n- Alpha\n- Beta\n",
    ),
  );
  git(repo, "commit", "--quiet", "--all", "-m", "chore: two lines of Now");
  await filledFrom(repo, ["Beta", "Alpha"]);

  await start();

  await waitFor(() => expect(read(repo)).not.toContain("- Alpha"));
  expect(read(repo)).toContain("- [Beta](/specs/changes/2026-10-16-beta/proposal.md)");
  expect(read(repo)).toContain("- [Plan review](/specs/2026-10-13-plan-review/proposal.md)");
  expect(read(repo)).not.toContain("- Beta\n");
});

/**
 * A line's Start on the Priorities page opens New change with it inserted as the page draws: it is
 * one of the composer's sources, which its start takes out.
 */
test("a change started from a line's Start on the Priorities page takes it out", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent({ installed: false });
  await renderPage("/priorities", repo, { agent: fake, fetch: serverFetch(repo, fake.sessions) });
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await act(async () => navigate(atRepo("/new?kind=change"), { insert: "line:next-1" }));
  await quiet();
  expect(screen.getByRole("textbox", { name: "Message Claude Code" }).textContent).toContain(
    "Claude Code runner (triggered manually)",
  );

  await start();

  await waitFor(() =>
    expect(read(repo)).not.toContain("\n- Claude Code runner (triggered manually)\n"),
  );
});

/** The composer's text, whichever card is picked, once it is drawn. */
const composerText = async () =>
  (
    await waitFor(
      () =>
        screen.queryByRole("textbox", { name: "Message Claude Code" }) ??
        screen.getByRole("textbox", { name: "Write Proposal" }),
    )
  ).textContent;

/** A key pressed outside any field, as the registry hears it. */
const press = (key: string) =>
  act(async () => {
    fireEvent.keyDown(document.body, { key });
  });

/** The repository with the line `text` in Now, without a file, committed. */
function withNowLine(text: string) {
  const repo = fixtureRepo();
  writeFileSync(
    join(repo, "specs/PRIORITIES.md"),
    read(repo).replace(
      "- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n",
      `- [Plan review](/specs/2026-10-13-plan-review/proposal.md)\n- ${text}\n  - one nested line\n`,
    ),
  );
  git(repo, "commit", "--quiet", "--all", "-m", "chore: a line of Now");
  return repo;
}

/** The New page again, as after a reload: the store reads `localStorage` anew. */
async function reloaded(repo: string, path: string) {
  forgetUnsaved();
  await act(async () => navigate(atRepo(path)));
  const fake = await fakeAgent({ installed: false });
  await renderPage(path, repo, {
    agent: fake,
    fetch: serverFetch(repo, fake.sessions),
    reload: true,
  });
  await quiet();
}

/** The Change's text, a blank line, then the Feature's: no text an older page kept is dropped. */
test("old drafts of the Change and Feature cards are joined into one, once", async () => {
  const repo = fixtureRepo();
  const old = (field: string, text: string) =>
    window.localStorage.setItem(
      unsavedKey(repo, field),
      JSON.stringify({ at: new Date().toISOString(), base: "", text }),
    );
  old("new-change", "Centre the x");
  old("new-feature-proposal", "Dark mode");
  forgetUnsaved();

  await renderPage("/new?kind=change", repo);
  await quiet();

  expect(await composerText()).toBe("Centre the x\n\nDark mode");
  expect(window.localStorage.getItem(unsavedKey(repo, "new-change"))).toBeNull();
  expect(window.localStorage.getItem(unsavedKey(repo, "new-feature-proposal"))).toBeNull();
  // A reload reads the shared draft alone: nothing is joined twice.
  await reloaded(repo, "/new?kind=feature");
  expect(await composerText()).toBe("Centre the x\n\nDark mode");
});

/** The Start of the fifth line of Now, the one `withNowLine` adds, as the Priorities page's. */
const startLine = () =>
  act(async () => navigate(atRepo("/new?kind=feature"), { insert: "line:now-5" }));

test("a line's Start replaces the draft, and `u` brings it back", async () => {
  const repo = withNowLine("Proposal start flow");
  const fake = await fakeAgent({ installed: false });
  await renderPage("/priorities", repo, { agent: fake, fetch: serverFetch(repo, fake.sessions) });
  await screen.findByRole("heading", { level: 1, name: "Priorities" });

  // An empty composer: the line and its nested line, no link, and nothing to undo.
  await startLine();
  await quiet();
  expect(await composerText()).toBe("Proposal start flow\n- one nested line");
  expect(screen.queryByText("Draft replaced")).toBeNull();

  // Over a draft: replaced, then back with `u`.
  await act(async () => navigate(atRepo("/priorities")));
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await act(async () => navigate(atRepo("/new?kind=change")));
  const change = await screen.findByRole("textbox", { name: "Message Claude Code" });
  // Emptied, the composer forgets the line it was filled from; then a draft of the human's own.
  await type(change, "");
  await type(change, "Widen the sidebar");
  // Row: the draft's image goes with it, and comes back with it.
  const png = new File([readFileSync(fixture("images/phone.png"))], "wide.png", {
    type: "image/png",
  });
  await act(async () => {
    fireEvent.paste(change, { clipboardData: { files: [png], getData: () => "" } });
  });
  await screen.findByRole("button", { name: /^Remove/ });
  await act(async () => navigate(atRepo("/priorities")));
  await screen.findByRole("heading", { level: 1, name: "Priorities" });
  await startLine();
  await quiet();
  expect(await composerText()).toBe("Proposal start flow\n- one nested line");
  await screen.findByText("Draft replaced");
  expect(screen.queryByRole("button", { name: /^Remove/ })).toBeNull();
  await press("u");
  await waitFor(async () => expect(await composerText()).toBe("Widen the sidebar"));
  await screen.findByRole("button", { name: /^Remove/ });

  // Row: switching cards three times keeps the text byte for byte.
  for (const kind of ["change", "session", "feature"]) {
    await act(async () => navigate(atRepo(`/new?kind=${kind}`)));
    await quiet();
    expect(await composerText()).toBe("Widen the sidebar");
  }
  // Row: the draft brought back keeps no source of the line: a reload still holds its own text.
  await reloaded(repo, "/new?kind=change");
  expect(await composerText()).toBe("Widen the sidebar");
  expect(JSON.parse(window.localStorage.getItem(unsavedKey(repo, "new-draft"))!).sources).toBe(
    undefined,
  );
});

/** What the composer was filled from is stored with its text: a reload keeps the line a source. */
test("a line filled into the composer is still its source after a reload", async () => {
  const repo = withNowLine("Alpha");
  await filledFrom(repo, ["Alpha"]);

  await reloaded(repo, "/new?kind=change");
  await start();

  await waitFor(() =>
    expect(read(repo)).toContain("- [Alpha](/specs/changes/2026-10-16-alpha/proposal.md)"),
  );
  expect(read(repo)).not.toContain("- Alpha\n");
});

/**
 * A note's ID is its place in the inbox: one removed above it since the composer was filled moves
 * it, and the start takes out the note it was filled from, found by its text, never the one now in
 * its place.
 */
test("a change started from a note takes it out by its text, once a note above it went", async () => {
  const repo = fixtureRepo();
  await filledFrom(repo, ["Icons are blurry on retina screens"]);
  const inbox = join(repo, "specs/INBOX.md");
  writeFileSync(
    inbox,
    read(repo, "specs/INBOX.md").replace("- Draft to proposal on mobile went 404\n", ""),
  );
  git(repo, "commit", "--quiet", "--all", "-m", "chore: a note above it goes");

  await start();

  await waitFor(() =>
    expect(read(repo, "specs/INBOX.md")).not.toContain("Icons are blurry on retina screens"),
  );
  expect(read(repo, "specs/INBOX.md")).toContain("Opening a session with 2,000 messages takes 4 s");
});
