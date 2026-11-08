// A round's settled points from the keyboard: Enter or `i` on a held point opens its comment with
// the focus in its field, at every width, so the letters typed next are the comment's, never the
// page's keys; on a point whose comment is open already, they take the focus back to its field.
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atWidth, fixtureRepo, git, hold, renderPage, today } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
today("2026-10-11");

/** The fixture's first settled point. */
const COMMITS = "The actions' commits move into the core";

function roundRepo() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  return repo;
}

/** A settled point's toggle, "Under the hood" opened for it. */
async function settledPoint(subject: string) {
  const hood = await screen.findByRole("region", { name: "Under the hood" });
  const toggle = within(hood).getByRole("button", { name: /^Under the hood/ });
  if (toggle.getAttribute("aria-expanded") !== "true") {
    await act(async () => void fireEvent.click(toggle));
  }
  return screen.findByRole("button", { name: new RegExp(`^${subject}`) });
}

/** A key pressed where the focus is, as the keyboard sends it. */
async function press(key: string) {
  await act(async () => {
    fireEvent.keyDown(document.activeElement ?? document.body, { key });
  });
}

/** The open comment form's field, once it has the focus. */
async function focusedField() {
  const field = await screen.findByLabelText("Comment text");
  await waitFor(() => expect(document.activeElement).toBe(field));
  return field;
}

/** A tap on a settled point, on its text as a finger lands. */
async function tapPoint(subject: string) {
  const point = await settledPoint(subject);
  await act(async () => {
    fireEvent.pointerDown(point);
    fireEvent.click(point);
  });
}

// Break: the form opened with the focus left on the point, so typing ran the page's keys.
test("Enter on a held settled point opens its comment with the focus in its field", async () => {
  await renderPage(PAGE, roundRepo());
  hold(await settledPoint(COMMITS));
  await press("Enter");
  await focusedField();
});

// Break: the phone's sheet opened without the focus, as a tap opens it.
test.each(["Enter", "i"])(
  "on the phone, %s on a held settled point focuses its comment's field",
  async (key) => {
    atWidth(402);
    await renderPage(PAGE, roundRepo());
    hold(await settledPoint(COMMITS));
    await press(key);
    await focusedField();
  },
);

// Break: a tap on a wide screen leaving the focus behind, as before the human could type.
test("a tap on a wide screen focuses the comment's field", async () => {
  await renderPage(PAGE, roundRepo());
  await tapPoint(COMMITS);
  await focusedField();
});

// Break: a tap on the phone raising the keyboard over the sheet.
test("a tap on the phone opens the comment without focusing its field", async () => {
  atWidth(402);
  await renderPage(PAGE, roundRepo());
  await tapPoint(COMMITS);
  const field = await screen.findByLabelText("Comment text");
  // The frames the focus would have been given in.
  await act(() => new Promise((done) => setTimeout(done, 200)));
  expect(document.activeElement).not.toBe(field);
});

// Break: `i` on a held point went to the page, and Enter on a point whose form is open did nothing.
test("i, or Enter, on a held point whose comment is open takes the focus back to its field", async () => {
  await renderPage(PAGE, roundRepo());
  hold(await settledPoint(COMMITS));
  await press("i");
  const field = await focusedField();

  for (const key of ["i", "Enter"]) {
    await press("Escape");
    // Escape leaves the field, and its form stays open: the key comes back to it.
    await waitFor(() => expect(document.activeElement).not.toBe(field));
    expect(field.isConnected).toBe(true);
    hold(await settledPoint(COMMITS));
    await press(key);
    expect(await focusedField()).toBe(field);
  }
});

// Break: the focus asked as the form opened, kept on: the form drawn again in the phone's sheet as
// the window narrowed took the focus once more, and raised the keyboard.
test("a form drawn again as the window narrows takes no focus", async () => {
  await renderPage(PAGE, roundRepo());
  await tapPoint(COMMITS);
  const wide = await focusedField();
  act(() => wide.blur());

  atWidth(402);
  const narrow = await waitFor(() => {
    const field = screen.getByLabelText("Comment text");
    expect(field).not.toBe(wide);
    return field;
  });
  // The frames the focus would have been given in.
  await act(() => new Promise((done) => setTimeout(done, 200)));
  expect(document.activeElement).not.toBe(narrow);
});
