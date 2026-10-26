// The key picker (US4): one dialog over any kind of thing, with the selected item's raw markdown
// beside the list. Opened from anywhere through `useKeyPicker`, as the leader menu's `Space f d` and
// `Space Space` will: the keys are another task's, so a component beside the app calls the hook.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { addChange } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { useKeyPicker } from "../keys/KeyPicker.tsx";
import { atRepo, atWidth, fakeAgent, fixtureRepo, quiet, renderPage } from "./helpers.tsx";

/** Opens the picker over a kind, as a key of the leader menu does. */
async function openPicker(kind: Parameters<ReturnType<typeof useKeyPicker>["open"]>[0]) {
  const held: { picker?: ReturnType<typeof useKeyPicker> } = {};
  function Capture() {
    const picker = useKeyPicker();
    useEffect(() => {
      held.picker = picker;
    }, [picker]);
    return null;
  }
  // The page has drawn all it will, and the component beside it: the shell's host is listening.
  await quiet();
  await act(async () => render(<Capture />));
  await act(async () => held.picker?.open(kind));
}

/** Presses a key on an element, as the keyboard does. */
async function press(element: Element, key: string) {
  await act(async () => {
    fireEvent.keyDown(element, { key });
  });
}

/** Types a query in the picker's field. */
async function type(field: HTMLElement, query: string) {
  await act(async () => {
    fireEvent.change(field, { target: { value: query } });
  });
}

/** The picker's preview of the item under the cursor. */
const preview = () => screen.getByRole("region", { name: "Preview" });

/** Whether a row of the title is labelled by the kind: a title may be a line of another kind too. */
async function row(title: RegExp, kind: string) {
  const options = await screen.findAllByRole("option", { name: title });
  expect(options.some((option) => within(option).queryByText(kind) !== null)).toBe(true);
}

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

test("the decisions picker lists the matches of “ui”, the first's file raw beside them, and Enter opens it (US4 1, 2)", async () => {
  const repo = fixtureRepo();
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Inbox" });
  // Closed, the picker leaves nothing in the page: no layer for the page's keys to stop under.
  expect(screen.queryByRole("dialog", { hidden: true, name: /^Find/ })).toBeNull();

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find · decisions" });
  await type(field, "ui");
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  // The first is under the cursor, shown as its file is written: the frontmatter, the rules' marks.
  await waitFor(() => expect(preview().textContent).toContain("# UI behaviour"));
  const raw = read(repo, "specs/decisions/ui-behaviour.md");
  expect(raw.startsWith("---\n")).toBe(true);
  expect(preview().textContent).toContain("approved-by: mrtolkien");
  expect(preview().textContent).toContain("## Rules");
  expect(preview().textContent).toContain("- ");

  await press(field, "Enter");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/ui-behaviour")));
  expect(screen.queryByRole("combobox", { name: "Find · decisions" })).toBeNull();
});

test("Escape closes the picker, and the focus returns to where it was (US4 more 1)", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  const holder = screen.getByRole("link", { name: "Priorities" });
  holder.focus();
  expect(document.activeElement).toBe(holder);

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find · decisions" });
  await waitFor(() => expect(document.activeElement).toBe(field));

  await press(field, "Escape");
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find · decisions" })).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(holder));
  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

test("the picker over every kind holds a row of each, labelled by its kind (US4 3)", async () => {
  const repo = fixtureRepo();
  addChange(repo, "2026-10-16-centred-x", { "proposal.md": "# Centre the x\n\nIt sits low.\n" });
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const { turn } = await fake.sessions.send(repo, chat.id, { text: "List the drafts" });
  await fake.sessions.settled(turn);
  await renderPage("/inbox", repo, { agent: fake });
  await screen.findByRole("heading", { name: "Inbox" });

  await openPicker("all");
  const field = await screen.findByRole("combobox", { name: "Find · everything" });
  await row(/Web UI for the workflow files/, "Feature");
  await row(/Centre the x/, "Change");
  await row(/List the drafts/, "Session");
  await row(/UI behaviour/, "Decision");
  await row(/Text input feels laggy/, "Note");
  await row(/Nix \+ Docker based execution environments/, "Priority");

  // A session previews as three plain lines: its title, its state, its branch.
  await type(field, "List the drafts");
  await waitFor(() => expect(preview().textContent).toContain("List the drafts"));
  // Its lines are the title, then its state, then its branch: nothing else.
  expect(preview().textContent).toMatch(/^List the drafts.+main$/);

  // A feature previews as its proposal, a change as its own, loaded after the list.
  await type(field, "Web UI");
  await waitFor(() => expect(preview().textContent).toContain("A web UI."));
  await type(field, "Centre the x");
  await waitFor(() => expect(preview().textContent).toContain("It sits low."));
});

test("a note and a priority preview as their text and their lines", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await openPicker("priorities");
  const field = await screen.findByRole("combobox", { name: "Find · priorities" });
  await type(field, "Nix");
  await waitFor(() => expect(preview().textContent).toContain("- Nix + Docker based"));
  expect(preview().textContent).toContain("  - with a cache");
});

test("at a phone's width the picker is a sheet showing the list alone (US4 more 2)", async () => {
  atWidth(402);
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find · decisions" });
  await type(field, "ui");
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
});
