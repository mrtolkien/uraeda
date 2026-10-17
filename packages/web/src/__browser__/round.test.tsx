// US1 scenarios 6, 7, and 8, and the review's C3: on a wide screen, the round's index is a sticky
// column beside the questions, `n` and `p` move between blank questions, Back returns to the same
// question, and at a 1200 px window with the navigation open, the questions keep 600 px. The
// clarifications redesign's US3: each question a card of two columns on a wide screen, one column
// without a card on the phone, its title sticking at the top.
import { act, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, test } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import {
  atRepo,
  atSize,
  commands,
  drawn,
  repository,
  scrollStopped,
  show,
  watchFor,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND_PATH = `specs/${FOLDER}/clarifications-01.md`;

/** A question's card, or its section on the phone. */
const card = (id: string) => document.getElementById(id)!;

/** A question's title. */
const titleOf = (id: string) => document.getElementById(`${id}-title`)!;

/** The cards of a question's options. */
const optionsOf = (id: string) => [
  ...card(id).querySelectorAll<HTMLElement>(".astryx-selectable-card"),
];

beforeEach(() => {
  // A browser that never opened the round: a round not started opens on its intro, at its top.
  window.localStorage.removeItem(`uraeda.round.${repository()}/${FOLDER}/clarifications-01.md`);
});

/** How far a question's top is from where a jump puts it, under the bar. */
function offset(id: string) {
  const section = document.getElementById(id)!;
  return Math.abs(
    section.getBoundingClientRect().top -
      Number.parseFloat(getComputedStyle(section).scrollMarginTop),
  );
}

describe("on the desktop", () => {
  atSize("desktop");

  test("the index is a column beside the questions, and n and p jump (US1 6, 7)", async () => {
    await show(PAGE, "How does your iPhone reach the server?");
    const index = screen.getByRole("navigation", { name: "Questions" });
    expect(index.textContent).toContain("0 of 3 answered");
    expect(screen.getByRole("button", { name: "Next" })).toBeTruthy();
    const question = document.getElementById("Q1")!.getBoundingClientRect();
    expect(index.getBoundingClientRect().left).toBeGreaterThanOrEqual(question.right);
    await drawn();
    expect(window.scrollY).toBe(0);

    // The keys reach the page once it has the focus, as after the human's first click in it.
    await userEvent.click(
      screen.getByRole("heading", { name: "Which human steps does the UI perform?" }),
    );
    await userEvent.keyboard("n");
    await expect.poll(() => offset("Q1")).toBeLessThan(3);
    await userEvent.keyboard("n");
    await expect.poll(() => offset("Q2")).toBeLessThan(3);
    // It stays in view while the page scrolls.
    const box = index.getBoundingClientRect();
    expect(box.top).toBeGreaterThanOrEqual(0);
    expect(box.top).toBeLessThan(window.innerHeight / 2);

    await userEvent.keyboard("p");
    await expect.poll(() => offset("Q1")).toBeLessThan(3);
    await scrollStopped();

    // Neither key acts while a text field has the focus.
    const comment = screen.getAllByRole("textbox", {
      name: "Comment, or your own answer instead of a letter",
    })[0] as HTMLTextAreaElement;
    await userEvent.click(comment);
    await scrollStopped();
    const before = window.scrollY;
    await userEvent.keyboard("n");
    expect(comment.value).toBe("n");
    // A jump gives its question's title the focus at once, then scrolls from the next frame.
    expect(document.activeElement).toBe(comment);
    await drawn();
    expect(window.scrollY).toBe(before);
  });

  test("Back returns to the question at the top (US1 8)", async () => {
    await show(PAGE, "How does your iPhone reach the server?");
    await userEvent.click(
      screen.getByRole("heading", { name: "Which human steps does the UI perform?" }),
    );
    await userEvent.keyboard("n");
    await expect.poll(() => offset("Q1")).toBeLessThan(3);
    await userEvent.keyboard("n");
    await expect.poll(() => offset("Q2")).toBeLessThan(3);
    await scrollStopped();

    // A real click: WebKit skips, on Back, an entry that added another without a user's gesture.
    await userEvent.click(screen.getByRole("link", { name: "discovery" }));
    await expect.poll(() => window.location.pathname).toBe(atRepo(`/f/${FOLDER}/discovery-01.md`));
    await expect
      .poll(() =>
        document.body.textContent?.includes("A web UI for a spec workflow has four parts."),
      )
      .toBe(true);
    // The round comes back at Q2, never through "Loading…".
    const loading = watchFor("Loading…");
    await act(async () => window.history.back());
    await expect.poll(() => window.location.pathname).toBe(atRepo(PAGE));
    await expect.poll(() => offset("Q2")).toBeLessThan(3);
    expect(loading.stop()).toBe(false);
  });

  test("at 1200 px with the navigation open, the questions get at least 600 px (C3)", async () => {
    await page.viewport(1200, 900);
    try {
      await show(PAGE, "How does your iPhone reach the server?");
      // The side navigation is open, at its default width, with the index beside the questions.
      const priorities = screen.getByRole("link", { name: "Priorities" }).getBoundingClientRect();
      expect(priorities.width).toBeGreaterThan(100);
      expect(screen.getByRole("navigation", { name: "Questions" })).toBeTruthy();
      // The question's card, which holds its title inside its padding (R19).
      expect(card("Q2").getBoundingClientRect().width).toBeGreaterThanOrEqual(600);
    } finally {
      await page.viewport(1440, 900);
    }
  });
});

describe("question cards on the desktop", () => {
  atSize("desktop");

  test("each question's options start to the right of its title, beside the sidebar and the index (US3.1, SC-001)", async () => {
    await show(PAGE, "How does your iPhone reach the server?");
    const priorities = screen.getByRole("link", { name: "Priorities" }).getBoundingClientRect();
    expect(priorities.width).toBeGreaterThan(100);
    expect(screen.getByRole("navigation", { name: "Questions" })).toBeTruthy();
    // Q1's follow-up shows once B is picked.
    await userEvent.click(optionsOf("Q1")[1]!);
    await expect.poll(() => document.getElementById("Q1.B")).toBeTruthy();
    await drawn();

    for (const id of ["Q1", "Q1.B", "Q2", "Q3"]) {
      const title = titleOf(id).getBoundingClientRect();
      expect(optionsOf(id).length, id).toBeGreaterThan(0);
      for (const option of optionsOf(id)) {
        expect(option.getBoundingClientRect().left, id).toBeGreaterThan(title.right);
      }
    }
  });

  test("a question whose options hold story variants is one column (US3.4)", async () => {
    await commands.addStoryFeature();
    await show(
      "/f/2026-10-20-sidebar-resize/clarifications-01.md",
      "What does the handle look like?",
    );

    const title = titleOf("Q2").getBoundingClientRect();
    expect(optionsOf("Q2").length).toBeGreaterThan(0);
    for (const option of optionsOf("Q2")) {
      const box = option.getBoundingClientRect();
      expect(box.top).toBeGreaterThan(title.bottom);
      expect(box.left).toBeLessThan(title.right);
    }
  });

  test("Tab reaches an option's card, and Space picks its letter and saves it (US3.7)", async () => {
    await show(PAGE, "Which repositories does the UI open now?");
    await userEvent.click(
      screen.getByRole("heading", { name: "Which repositories does the UI open now?" }),
    );

    await userEvent.tab();
    const a = within(card("Q3")).getByRole("checkbox", { name: /^Option A\b/ }) as HTMLInputElement;
    expect(document.activeElement).toBe(a);
    await userEvent.keyboard(" ");

    await expect.poll(() => a.checked).toBe(true);
    expect(await within(card("Q3")).findByText("saved ✓")).toBeTruthy();
  });
});

describe("on the phone", () => {
  atSize("phone");

  test("each question follows its context in one column, without a card, its options as wide as the screen (US3.2, SC-001)", async () => {
    await show(PAGE, "How does your iPhone reach the server?");

    for (const id of ["Q1", "Q2", "Q3"]) {
      const section = card(id);
      // No card drawn around it: no border, and no background of its own.
      const around = titleOf(id).closest(".astryx-card");
      if (around) {
        const style = getComputedStyle(around);
        expect(style.borderTopWidth, id).toBe("0px");
        expect(style.backgroundColor, id).toBe("rgba(0, 0, 0, 0)");
      }
      const why = section.querySelector('[role="note"]') ?? titleOf(id);
      const above = why.getBoundingClientRect().bottom;
      expect(optionsOf(id).length, id).toBeGreaterThan(0);
      for (const option of optionsOf(id)) {
        const box = option.getBoundingClientRect();
        expect(box.top, id).toBeGreaterThanOrEqual(above);
        expect(box.left, id).toBeLessThanOrEqual(0.5);
        expect(box.right, id).toBeGreaterThanOrEqual(window.innerWidth - 0.5);
      }
    }
    expect(document.documentElement.scrollWidth).toBeLessThanOrEqual(window.innerWidth);
  });

  test("scrolled to Q1's option C, Q1's title of three lines shows whole at the top (US3.3)", async () => {
    const long =
      "Which human steps does the UI perform from the phone, and which ones stay in the text editor on the computer?";
    const round = await commands.fixtureText(`repo/branches/${FOLDER}/${ROUND_PATH}`);
    await commands.commitOnBranch(FOLDER, {
      [ROUND_PATH]: round.replace("Which human steps does the UI perform?", long),
    });
    await show(PAGE, long);
    const title = titleOf("Q1");
    const size = Number.parseFloat(getComputedStyle(title).fontSize);
    expect(title.getBoundingClientRect().height).toBeGreaterThan(3 * size);

    optionsOf("Q1")[2]!.scrollIntoView({ block: "start" });
    await drawn();

    // Its header, the id then the title, sticks right below the top bar, never under it.
    const bar = screen.getByRole("banner").getBoundingClientRect();
    const head = title.parentElement!;
    expect(head.getBoundingClientRect().top).toBeGreaterThanOrEqual(bar.bottom - 0.5);
    expect(head.getBoundingClientRect().top).toBeLessThan(bar.bottom + 1);
    const box = title.getBoundingClientRect();
    // Whole: its first and last lines show, over the options scrolled under it.
    for (const y of [box.top + 2, box.bottom - 2]) {
      expect(title.contains(document.elementFromPoint(box.left + 8, y))).toBe(true);
    }
    expect(getComputedStyle(head).backgroundColor).not.toBe("rgba(0, 0, 0, 0)");
  });
});
