// Questions page US3 key 1 and 2, US2 more 1, SC-002, SC-005, and the edge case "the column
// folded": in WebKit, the round's column is a third of the window with Outline open; asking about a
// question or switching tabs moves no card of the round by a pixel; the outline marks the part at
// the top; folded with `]`, the round takes the room and a wide card splits; and the round with its
// column passes the page's checks and axe in both schemes.
import { screen, within } from "@testing-library/react";
import { describe, expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import {
  atSize,
  checkAccessibility,
  checkPage,
  colorScheme,
  commands,
  drawn,
  LIVE,
  scrollStopped,
  show,
} from "./helpers.tsx";

/** The feature a test writes the merge-chats round in, and its round. */
const FOLDER = "2026-10-06-recurring-tasks";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const Q1 = "Who may move a chat up to a change, or a change up to a feature?";

/** Every question card of the round, Q2.A once Q2 is answered A. */
const CARDS = ["Q1", "Q2", "Q3", "Q4", "Q5", "Q6", "Q7"];

/** Writes the merge-chats round as the feature's round, and shows it at `search`. */
async function showRound(search = "") {
  const round = await commands.fixtureText("round-merge-chats/clarifications-01.md");
  await commands.commitOnBranch(FOLDER, { [ROUND]: round });
  await show(`${PAGE}${search}`, Q1);
}

/** The round's column. */
const column = () => screen.getByRole("complementary", { name: "The round's column" });

/** A question's card. */
const card = (id: string) => document.getElementById(id)!;

/** Where every card is, and how wide, in the window, rounded to the pixel. */
function cardBoxes() {
  return CARDS.map((id) => {
    const { left, top, width } = card(id).getBoundingClientRect();
    return `${id} ${Math.round(left)} ${Math.round(top)} ${Math.round(width)}`;
  });
}

/** The session's composer, in the column. */
function composer() {
  return within(screen.getByRole("tabpanel", { name: "Session" })).findByRole(
    "textbox",
    { name: "Message Claude Code" },
    LIVE,
  );
}

/** The outline's row marked as the part at the top, by its text. */
function marked() {
  const outline = screen.getByRole("navigation", { name: "Outline" });
  return within(outline)
    .getAllByRole("listitem")
    .filter((row) => row.getAttribute("aria-current") === "true")
    .map((row) => row.textContent);
}

/** Q1's title, as drawn. */
const q1Title = () => document.getElementById("Q1-title")!.getBoundingClientRect();

/** Q1's options, as drawn: each the box its checkbox is in. */
const q1Options = () =>
  within(card("Q1"))
    .getAllByRole("checkbox")
    .map((box) => box.parentElement!.getBoundingClientRect());

/** How far a part's top is from where a jump puts it. */
function offset(id: string) {
  const section = document.getElementById(id)!;
  return Math.abs(
    section.getBoundingClientRect().top -
      Number.parseFloat(getComputedStyle(section).scrollMarginTop),
  );
}

describe("on the desktop", () => {
  atSize("desktop");

  test("at 1440 px the column is 480 px, Outline open (US3 key 1)", async () => {
    await showRound();

    expect(Math.round(column().getBoundingClientRect().width)).toBe(480);
    for (const name of ["Outline", "Notes", "Session"]) {
      expect(within(column()).getByRole("tab", { name })).toBeTruthy();
    }
    expect(
      within(column()).getByRole("tab", { name: "Outline" }).getAttribute("aria-selected"),
    ).toBe("true");
    expect(within(column()).getByRole("navigation", { name: "Outline" })).toBeTruthy();
  });

  test("asking about Q2 moves no card, nor does switching tabs (US3 key 2, SC-002)", async () => {
    await showRound();
    // The page read at Q2, its Ask in view: the click scrolls nothing.
    const ask = within(card("Q2")).getAllByRole("button", { name: "Ask the agent" })[0]!;
    ask.scrollIntoView({ block: "center" });
    await scrollStopped();
    const before = cardBoxes();

    await userEvent.click(ask);
    const box = await composer();
    await expect
      .poll(() => box.textContent, LIVE)
      .toBe(`About Q2 of ${ROUND}:\n> Where does a new chat work?\n\n`);
    await drawn();
    expect(cardBoxes()).toEqual(before);

    for (const name of ["Notes", "Outline", "Session"]) {
      await userEvent.click(within(column()).getByRole("tab", { name }));
      await drawn();
      expect(cardBoxes(), name).toEqual(before);
    }
  });

  test("the part at the top is marked (US2 more 1)", async () => {
    await showRound();
    expect(marked()).toEqual(["!Verdict and summary"]);

    const outline = screen.getByRole("navigation", { name: "Outline" });
    await userEvent.click(within(outline).getByRole("button", { name: /^Q3 / }));
    await expect.poll(() => offset("Q3"), LIVE).toBeLessThan(3);
    await scrollStopped();

    await expect
      .poll(marked, LIVE)
      .toEqual(["○ Q3 Does the chat's conversation become the change's session? (unanswered)"]);
  });

  test("with the column folded, a wide card splits (edge case)", async () => {
    await showRound();
    // Beside the column, Q1's card is under 840 px: its options come under its title.
    expect(card("Q1").getBoundingClientRect().width).toBeLessThan(840);
    expect(q1Options()[0]!.top).toBeGreaterThan(q1Title().bottom);

    // The keys reach the page once it has the focus, as after the human's first click in it.
    await userEvent.click(screen.getByRole("heading", { level: 1 }));
    await userEvent.keyboard("]");
    await expect.poll(() => card("Q1").getBoundingClientRect().width, LIVE).toBeGreaterThan(840);
    await drawn();

    // The card splits once it measured its new width, a frame or more after the column folds.
    await expect
      .poll(() => q1Options().every((option) => option.left > q1Title().right), LIVE)
      .toBe(true);
  });
});

describe("accessibility", () => {
  atSize("both");

  test("the round with its column passes the page's checks and axe in light and dark (SC-005)", async () => {
    await showRound();
    for (const mode of ["light", "dark"] as const) {
      await colorScheme(mode);
      await drawn();
      checkPage();
      await checkAccessibility();
    }
  });
});
