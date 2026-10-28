// The key picker (US4): one dialog over any kind of thing, with the selected item's raw markdown
// beside the list. Opened from anywhere through `useKeyPicker`, as the leader menu's `Space f d` and
// `Space Space` will: the keys are another task's, so a component beside the app calls the hook.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, cleanup, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { useEffect } from "react";
import { addChange } from "uraeda-binding/test-utils";
import { expect, test, vi } from "vite-plus/test";
import { useKeyPicker } from "../keys/KeyPicker.tsx";
import {
  atRepo,
  atWidth,
  fakeAgent,
  fixtureRepo,
  quiet,
  renderPage,
  serverFetch,
} from "./helpers.tsx";

/** What `openPicker` captured: the hook's opener, to open the picker again. */
const holder: { picker?: ReturnType<typeof useKeyPicker> } = {};
const held = () => holder.picker!;

/** A component beside the app, which keeps the hook's opener. */
function Capture() {
  const picker = useKeyPicker();
  useEffect(() => {
    holder.picker = picker;
  }, [picker]);
  return null;
}

/** Opens the picker over a kind, as a key of the leader menu does. */
async function openPicker(kind: Parameters<ReturnType<typeof useKeyPicker>["open"]>[0]) {
  // The page has drawn all it will, and the component beside it: the shell's host is listening.
  await quiet();
  await act(async () => render(<Capture />));
  await act(async () => holder.picker?.open(kind));
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

/**
 * Whether a row of the title is drawn with an icon, its kind's or its card's, and not with its
 * kind's name, which the icon stands for: a title may be a line of another kind too.
 */
async function row(title: RegExp, kind: string) {
  const options = await screen.findAllByRole("option", { name: title });
  expect(options.some((option) => option.querySelector("svg") !== null)).toBe(true);
  expect(options.every((option) => within(option).queryByText(kind) === null)).toBe(true);
}

const read = (repo: string, path: string) => readFileSync(join(repo, path), "utf8");

test("the decisions picker lists the matches of “ui”, the first's file raw beside them, and Enter opens it (US4 1, 2)", async () => {
  const repo = fixtureRepo();
  await renderPage("/inbox", repo);
  await screen.findByRole("heading", { name: "Inbox" });
  // Closed, the picker leaves nothing in the page: no layer for the page's keys to stop under.
  expect(screen.queryByRole("dialog", { hidden: true, name: /^Find/ })).toBeNull();

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
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
  expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull();
});

test("Escape closes the picker, and the focus returns to where it was (US4 more 1)", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  const holder = screen.getByRole("link", { name: "Priorities" });
  holder.focus();
  expect(document.activeElement).toBe(holder);

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  await waitFor(() => expect(document.activeElement).toBe(field));

  await press(field, "Escape");
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(holder));
  expect(window.location.pathname).toBe(atRepo("/inbox"));
});

test("the picker over every kind holds a row of each, drawn with its icon, not its kind's name (US4 3)", async () => {
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
  const field = await screen.findByRole("combobox", { name: "Find anything" });
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
  const field = await screen.findByRole("combobox", { name: "Find priorities" });
  await type(field, "Nix");
  await waitFor(() => expect(preview().textContent).toContain("- Nix + Docker based"));
  expect(preview().textContent).toContain("  - with a cache");
});

test("at a phone's width the picker is a sheet showing the list alone (US4 more 2)", async () => {
  atWidth(402);
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  await type(field, "ui");
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  expect(screen.queryByRole("region", { name: "Preview" })).toBeNull();
});

/**
 * The server's fetch, which holds the requests for the decisions' records, or fails them, once
 * told: the page has read all it needs before, and the picker's records are read when it opens.
 */
async function gatedServer(repo: string) {
  const fake = await fakeAgent();
  const through = serverFetch(repo, fake.sessions);
  const gate = Promise.withResolvers<void>();
  const control = {
    mode: "pass" as "fail" | "hold" | "pass",
    proposals: "pass" as "fail" | "pass",
  };
  const fetch: typeof globalThis.fetch = async (input, init) => {
    if (control.proposals === "fail" && String(init?.body).includes("proposal.md")) {
      throw new TypeError("Failed to fetch");
    }
    if (control.mode !== "pass" && String(init?.body).includes('"ledger"')) {
      if (control.mode === "fail") {
        throw new TypeError("Failed to fetch");
      }
      await gate.promise;
    }
    return through(input, init);
  };
  return { control, fake, fetch, release: () => gate.resolve() };
}

test("the dialog shows at once, saying Loading…, and the list comes when the records do", async () => {
  const repo = fixtureRepo();
  const server = await gatedServer(repo);
  await renderPage("/inbox", repo, { agent: server.fake, fetch: server.fetch });
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  server.control.mode = "hold";

  await openPicker("decisions");

  // The search is there to type in, and says it waits: the page's keys are held under it.
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  expect(await screen.findByText("Loading…")).toBeTruthy();
  expect(screen.queryAllByRole("option")).toHaveLength(0);
  // What is typed meanwhile is kept, and searched once the records are there.
  await type(field, "ui");

  await act(async () => server.release());
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  expect(screen.queryByText("Loading…")).toBeNull();
  expect((field as HTMLInputElement).value).toBe("ui");
  await waitFor(() => expect(preview().textContent).toContain("# UI behaviour"));
});

test("records that fail to load close the picker with a message, and the page stays", async () => {
  const repo = fixtureRepo();
  const server = await gatedServer(repo);
  await renderPage("/inbox", repo, { agent: server.fake, fetch: server.fetch });
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  server.control.mode = "fail";

  await openPicker("decisions");

  expect(await screen.findByText("Could not load the list to search.")).toBeTruthy();
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );
  expect(screen.getByRole("heading", { name: "Inbox" })).toBeTruthy();
  expect(screen.queryByText("Could not reach the Uraeda server.")).toBeNull();

  // Opened again once the server answers, it reads again.
  server.control.mode = "pass";
  await act(async () => held().open("decisions"));
  expect(await screen.findByRole("combobox", { name: "Find decisions" })).toBeTruthy();
  await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(0));
});

test("Back closes the picker, and the focus returns to where it was", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  const holder = screen.getByRole("link", { name: "Priorities" });
  holder.focus();
  const before = window.location.pathname;

  await openPicker("decisions");
  await screen.findByRole("combobox", { name: "Find decisions" });
  await act(async () => window.history.back());

  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(holder));
  expect(window.location.pathname).toBe(before);
});

test("the focus returns to an opener the dialog would not restore itself: a plain element focused by script", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  const opener = document.createElement("button");
  opener.textContent = "Not a trigger";
  document.body.append(opener);
  opener.focus();
  expect(document.activeElement).toBe(opener);

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  await press(field, "Escape");

  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );
  await waitFor(() => expect(document.activeElement).toBe(opener));
});

test("a pick opens its page, and the page keeps the focus: the opener does not take it back", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  const opener = screen.getByRole("link", { name: "Priorities" });
  opener.focus();
  // Where the address was each time the opener was given the focus.
  const refocused: Array<string> = [];
  const focus = opener.focus.bind(opener);
  vi.spyOn(opener, "focus").mockImplementation((options) => {
    refocused.push(window.location.pathname);
    focus(options);
  });

  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  await type(field, "ui");
  await waitFor(() =>
    expect(screen.getAllByRole("option")[0]?.textContent).toMatch(/^UI behaviour/),
  );
  await waitFor(() => expect(preview().textContent).toContain("# UI behaviour"));
  await press(field, "Enter");
  await waitFor(() => expect(window.location.pathname).toBe(atRepo("/decisions/ui-behaviour")));

  // A few frames, past the one the picker would refocus in.
  for (let frame = 0; frame < 3; frame += 1) {
    await act(async () => void (await new Promise((resolve) => requestAnimationFrame(resolve))));
  }
  // The picker gives the focus back as it closes, over the page that opened it: never later.
  expect(refocused).not.toContain(atRepo("/decisions/ui-behaviour"));
});

test("opened again over another kind, the picker shows no preview of the first one's item", async () => {
  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await openPicker("decisions");
  const field = await screen.findByRole("combobox", { name: "Find decisions" });
  await type(field, "ui");
  await waitFor(() => expect(preview().textContent).toContain("# UI behaviour"));
  await press(field, "Escape");
  await waitFor(() =>
    expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull(),
  );

  await act(async () => held().open("priorities"));

  await screen.findByRole("combobox", { name: "Find priorities" });
  expect(preview().textContent).not.toContain("UI behaviour");
});

test("opening with no shell to show it opens nothing for the next one", async () => {
  // The hook alone, with no page mounted: the open is dropped.
  const { useKeyPicker: use } = await import("../keys/KeyPicker.tsx");
  function Opens() {
    use().open("decisions");
    return null;
  }
  render(<Opens />);
  cleanup();

  await renderPage("/inbox", fixtureRepo());
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  expect(screen.queryByRole("combobox", { name: "Find decisions" })).toBeNull();
});

test("proposals that fail to load say so in the preview, and the list stays", async () => {
  const repo = fixtureRepo();
  const server = await gatedServer(repo);
  await renderPage("/inbox", repo, { agent: server.fake, fetch: server.fetch });
  await screen.findByRole("heading", { name: "Inbox" });
  await quiet();
  server.control.proposals = "fail";

  await openPicker("features");
  const field = await screen.findByRole("combobox", { name: "Find features" });
  await type(field, "Web UI");

  await waitFor(() => expect(preview().textContent).toContain("Could not load the proposal."));
  expect(screen.getAllByRole("option").length).toBeGreaterThan(0);
  expect(screen.queryByText("Could not load the list to search.")).toBeNull();
});

test("an archived session is listed after the live ones, its state saying archived", async () => {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const old = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const first = await fake.sessions.send(repo, old.id, { text: "Old question" });
  await fake.sessions.settled(first.turn);
  fake.sessions.archive(repo, old.id, true);
  const live = await fake.sessions.newChat(repo);
  fake.adapter.script([{ text: "Done.", type: "text" }]);
  const second = await fake.sessions.send(repo, live.id, { text: "Live question" });
  await fake.sessions.settled(second.turn);
  await renderPage("/inbox", repo, { agent: fake });
  await screen.findByRole("heading", { name: "Inbox" });

  await openPicker("sessions");
  await screen.findByRole("combobox", { name: "Find sessions" });

  await waitFor(() => expect(screen.getAllByRole("option")).toHaveLength(2));
  // Each row is its title, then its card's status mark, as the sidebar draws it.
  const titles = screen.getAllByRole("option").map((option) => option.textContent);
  expect(titles).toEqual([
    expect.stringMatching(/^Live question/),
    expect.stringMatching(/^Old question/),
  ]);
  await type(screen.getByRole("combobox", { name: "Find sessions" }), "Old");
  await waitFor(() => expect(preview().textContent).toMatch(/^Old questionArchived · /));
});
