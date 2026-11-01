// The text field takes the focus where something new starts: the New page opens with it in the
// picked kind's composer, `s c f` move it to the composer of the card they pick, and a feature's
// "New session" opens with it in its composer. The cards' arrows keep it on the cards, and Back to a
// page scrolled down its entries keeps its place.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import { atRepo, atWidth, fakeAgent, fixtureRepo, renderPage, today } from "./helpers.tsx";

today("2026-10-11");

const FOLDER = "2026-10-11-web-ui";

/** Presses a key on `target`, as a user's reaches the window. */
const press = (key: string, target: Element = document.body) =>
  act(async () => {
    fireEvent.keyDown(target, { key });
  });

/** A kind's card, in the New page's group of cards. */
function card(kind: string) {
  const group = screen.getByRole("radiogroup", { name: "What to start" });
  return within(group).getByRole("radio", { name: kind });
}

/** The composer's text field, once the page is drawn. */
const composer = () => screen.findByRole("textbox", { name: "Message Claude Code" });

test("the New page opens with the focus in the session's composer", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  const field = await composer();

  await waitFor(() => expect(document.activeElement).toBe(field));
});

test("the New page opened at a kind focuses that kind's composer", async () => {
  await renderPage("/new?kind=feature", fixtureRepo(), { agent: await fakeAgent() });
  const field = await screen.findByRole("textbox", { name: "Write Proposal" });

  await waitFor(() => expect(document.activeElement).toBe(field));
});

test("`c` and `f` move the focus to the composer of the card they pick", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
  // Escape leaves the field for the page, whose keys work again.
  await press("Escape", document.activeElement!);

  await press("c");

  await screen.findByRole("button", { name: "Start the change" });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));

  await press("Escape", document.activeElement!);
  await press("f");

  const written = await screen.findByRole("textbox", { name: "Write Proposal" });
  await waitFor(() => expect(document.activeElement).toBe(written));
});

test("the cards' arrows keep the focus on the cards", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
  card("Session").focus();

  await press("ArrowRight", card("Session"));

  await screen.findByRole("button", { name: "Start the change" });
  // A few frames for a focus that would follow the composer drawn.
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.activeElement).toBe(card("Change"));
});

test("on the phone, the New page opens with no composer to focus, and a pick focuses it", async () => {
  atWidth(402);
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await screen.findByRole("radiogroup", { name: "What to start" });
  expect(screen.queryByRole("textbox", { name: "Message Claude Code" })).toBeNull();

  await press("c");

  await screen.findByRole("button", { name: "Start the change" });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
});

test("a feature's New session opens with the focus in its composer", async () => {
  await renderPage(`/f/${FOLDER}/session?new`, fixtureRepo(), { agent: await fakeAgent() });
  const field = await composer();

  await waitFor(() => expect(document.activeElement).toBe(field));
});

// Break: a visit that focuses the composer whatever the scroll it comes back to.
test("Back to a New page scrolled down its entries keeps its place, not the focus", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
  await press("Escape", document.activeElement!);
  // Scrolled down the entries, then away: leaving saves the scroll in the page's entry.
  Object.defineProperty(window, "scrollY", { configurable: true, value: 400 });
  await act(async () => navigate(atRepo("/priorities")));
  Object.defineProperty(window, "scrollY", { configurable: true, value: 0 });
  await screen.findByRole("heading", { level: 1, name: "Priorities" });

  await act(async () => window.history.back());

  await screen.findByRole("radiogroup", { name: "What to start" });
  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.activeElement).toBe(document.body);
});

// Break: a focus on the page's mount alone, which the leader's `Space n c` on the page never gets.
test("a new visit to the New page, from the New page, focuses the composer again", async () => {
  await renderPage("/new", fixtureRepo(), { agent: await fakeAgent() });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
  await press("Escape", document.activeElement!);

  await act(async () => navigate(atRepo("/new?kind=change")));

  await screen.findByRole("button", { name: "Start the change" });
  await waitFor(async () => expect(document.activeElement).toBe(await composer()));
});

// Break: every session's composer taking the focus as it opens.
test("a feature's session, not a new one, leaves the focus to the page", async () => {
  await renderPage(`/f/${FOLDER}/session`, fixtureRepo(), { agent: await fakeAgent() });
  await composer();

  await act(() => new Promise((resolve) => setTimeout(resolve, 100)));
  expect(document.activeElement).toBe(document.body);
});
