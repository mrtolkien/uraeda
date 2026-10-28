// The other pages' own keys, on the registry (US3 2, 5; US2 more 3; US6 1): `a` on Home and on
// Sessions opens the New page, `i` in a session focuses the composer and Escape leaves it keeping
// the draft, the New page's `s c f` pick a card as a click would and `i` focuses the picked kind's
// composer, and the questions' `n p` hint is drawn from the registry. Keys are pressed as a user's reach the
// window: on the focused element, or on the page.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  fakeAgent,
  fixture,
  fixtureRepo,
  git,
  homeShown,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

today("2026-10-11");

const FOLDER = "2026-10-11-web-ui";

/** Presses a key on `target`, as a user's reaches the window: a capital is typed with Shift. */
const press = (key: string, target: Element = document.body) =>
  act(async () => {
    fireEvent.keyDown(target, { key, shiftKey: /^[A-Z]$/.test(key) });
  });

/** The address now, in the repository's own path. */
const address = () => `${window.location.pathname}${window.location.search}`;

/** A kind's card, in the New page's group of cards. */
function card(kind: string) {
  const group = screen.getByRole("radiogroup", { name: "What to start" });
  return within(group).getByRole("radio", { name: kind });
}

/** The composer's text field, once the page is drawn. */
const composer = () => screen.findByRole("textbox", { name: "Message Claude Code" });

/** The feature's composer, which writes its proposal. */
const proposal = () => screen.findByRole("textbox", { name: "Write Proposal" });

test("US3: `a` on Home opens the New page, as its button does", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await homeShown();

  await press("a");

  await waitFor(() => expect(address()).toBe(atRepo("/new")));
  await screen.findByRole("radiogroup", { name: "What to start" });
});

test("US3: `a` on the Sessions page opens the New page", async () => {
  atWidth(402);
  await renderPage("/sessions", fixtureRepo(), { agent: await fakeAgent() });
  await screen.findByRole("heading", { name: "Sessions" });

  await press("a");

  await waitFor(() => expect(address()).toBe(atRepo("/new")));
});

// Break: Escape that clears the draft.
test("US3 2: `i` in a session focuses the composer, and Escape leaves it keeping the draft", async () => {
  await renderPage(`/f/${FOLDER}/session`, fixtureRepo(), { agent: await fakeAgent() });
  const field = await composer();

  await press("i");

  expect(document.activeElement).toBe(field);
  // The key was the page's, not typed into the field.
  expect(field.textContent).toBe("");
  await type(field, "hello");
  await press("Escape", field);

  expect(document.activeElement).toBe(document.body);
  expect(field.textContent).toBe("hello");
  // The page's keys work again, and a later `i` comes back to the draft.
  await press("i");
  expect(document.activeElement).toBe(field);
  expect(field.textContent).toBe("hello");
});

test("US3 5: on the New page, `f`, `c`, and `s` pick a card as a click would", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await screen.findByRole("radiogroup", { name: "What to start" });
  expect(card("Session").getAttribute("aria-checked")).toBe("true");

  await press("f");

  await waitFor(() => expect(card("Feature").getAttribute("aria-checked")).toBe("true"));
  expect(address()).toBe(atRepo("/new?kind=feature"));
  expect(card("Session").getAttribute("aria-checked")).toBe("false");

  await press("c");

  await waitFor(() => expect(card("Change").getAttribute("aria-checked")).toBe("true"));
  expect(address()).toBe(atRepo("/new?kind=change"));

  await press("s");

  await waitFor(() => expect(card("Session").getAttribute("aria-checked")).toBe("true"));
  // The address names a session too, so that the phone knows a card was picked.
  expect(address()).toBe(atRepo("/new?kind=session"));
});

// Each kind's text box is a composer, a feature's its proposal's: its own `i` focuses it.
test("US3 5: on the New page, `i` focuses the composer of the kind picked", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await screen.findByRole("radiogroup", { name: "What to start" });

  await press("i");
  expect(document.activeElement).toBe(await composer());

  document.body.focus();
  await press("f");
  const written = await proposal();
  document.body.focus();
  await press("i");
  expect(document.activeElement).toBe(written);

  document.body.focus();
  await press("c");
  await waitFor(() => expect(screen.queryByRole("textbox", { name: "Write Proposal" })).toBeNull());
  document.body.focus();
  await press("i");
  expect(document.activeElement).toBe(await composer());
});

test("US3: the picked card's own keys still move between cards", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await screen.findByRole("radiogroup", { name: "What to start" });

  await press("ArrowRight", card("Session"));

  await waitFor(() => expect(card("Change").getAttribute("aria-checked")).toBe("true"));
  expect(document.activeElement).toBe(card("Change"));
});

/** The merge-chats round, in the feature's worktree, with its questions blank. */
function roundRepo() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  writeFileSync(
    join(repo, ".worktrees", FOLDER, "specs", FOLDER, "clarifications-01.md"),
    readFileSync(fixture("round-merge-chats/clarifications-01.md"), "utf8"),
  );
  return repo;
}

test("US6 1, US2 more 3: the questions page's status line reads `n p unanswered`, and `n` jumps", async () => {
  await renderPage(`/f/${FOLDER}/clarifications-01.md`, roundRepo());
  await screen.findAllByText(/Who may move a chat up to a change/);

  const line = await screen.findByRole("contentinfo", { name: "Status line" });
  await waitFor(() => expect(line.textContent).toContain("n p unanswered"));

  await press("n");

  await waitFor(() => expect(document.activeElement?.textContent).toContain("Q1"));
});
