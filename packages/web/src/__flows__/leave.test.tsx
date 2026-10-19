// Flow: leaving a page that holds unsaved text. A link, `navigate`, or Back asks first through the
// app's dialog, Stay keeps the page and its text, a reload gets the browser's prompt until the text
// is saved, and nothing asks when nothing is unsaved or when the page moved the human itself.
import { readFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fixture, fixtureRepo, git } from "uraeda-binding/test-utils";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import { click, read, startApp, type } from "./harness.tsx";

const FOLDER = "2026-10-11-web-ui";
const ROUND = `specs/${FOLDER}/clarifications-01.md`;

/** The fixture repository with the web UI's feature in its worktree, where its round is written. */
function repository() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  return repo;
}

const app = startApp({ repo: repository });

/** Q3's first text field: the answer's comment, not a follow-up's. */
const comment = () =>
  within(document.getElementById("Q3") as HTMLElement).getAllByRole(
    "textbox",
  )[0] as HTMLTextAreaElement;

/** The page of the feature, which a link in the app leads to. */
const feature = () => app.path(`/f/${FOLDER}`);
const round = () => app.path(`/f/${FOLDER}/clarifications-01.md`);

/** A link of the page to an address. */
const linkTo = (path: string) =>
  screen.getAllByRole("link").find((link) => link.getAttribute("href") === path)!;

/** The feature's page, then the round opened from it as by a link: Back has a page to go to. */
async function roundOpenedFromFeature() {
  await app.open(`/f/${FOLDER}`);
  await act(async () => navigate(round()));
  await waitFor(() => expect(document.getElementById("Q3")).toBeTruthy());
}

const back = () => act(async () => window.history.back());

/** The dialog that asks to leave, once drawn: its Stay and Leave buttons. */
async function asked() {
  const dialog = await screen.findByRole("dialog", { name: /leave/i });
  return {
    leave: () => click(within(dialog).getAllByRole("button").at(-1)!),
    stay: () => click(within(dialog).getAllByRole("button")[0]),
  };
}

/** A `beforeunload` event as a reload or a closed tab sends: cancelled when the browser asks. */
function unloadCancelled() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

test("a link away from unsaved text asks first: Stay keeps the page and the text, Leave goes", async () => {
  await roundOpenedFromFeature();
  await type(comment(), "Neither, keep it simple");

  await click(linkTo(feature()));

  const dialog = await asked();
  expect(window.location.pathname).toBe(round());
  await dialog.stay();
  await waitFor(() => expect(screen.queryByRole("dialog", { name: /leave/i })).toBeNull());
  expect(window.location.pathname).toBe(round());
  expect(comment().value).toBe("Neither, keep it simple");

  await click(linkTo(feature()));
  await (await asked()).leave();
  await waitFor(() => expect(window.location.pathname).toBe(feature()));
});

test("a page opened by navigate asks the same, and Back asks with the page staying while it does", async () => {
  await roundOpenedFromFeature();
  await type(comment(), "Neither, keep it simple");

  await act(async () => navigate(feature()));
  await (await asked()).stay();
  expect(window.location.pathname).toBe(round());

  await back();
  const dialog = await asked();
  expect(window.location.pathname).toBe(round());
  await dialog.leave();
  await waitFor(() => expect(window.location.pathname).toBe(feature()));
  expect(screen.queryByRole("dialog", { name: /leave/i })).toBeNull();
});

test("with nothing unsaved, a link, Back, and a reload do not ask", async () => {
  await roundOpenedFromFeature();
  // Text typed, then put back as it was saved: nothing is unsaved.
  await type(comment(), "Neither");
  await type(comment(), "");

  expect(unloadCancelled()).toBe(false);
  await click(linkTo(feature()));
  await waitFor(() => expect(window.location.pathname).toBe(feature()));
  await back();
  await waitFor(() => expect(window.location.pathname).toBe(round()));
  expect(screen.queryByRole("dialog", { name: /leave/i })).toBeNull();
});

test("a reload with unsaved text gets the browser's prompt, until the text is saved", async () => {
  await app.open(`/f/${FOLDER}/clarifications-01.md`);
  await waitFor(() => expect(document.getElementById("Q3")).toBeTruthy());
  await type(comment(), "Neither, keep it simple");

  expect(unloadCancelled()).toBe(true);

  const save = within(document.getElementById("Q3") as HTMLElement).getAllByRole("button", {
    name: /save/i,
  })[0];
  await click(save);
  await waitFor(() =>
    expect(readFileSync(join(app.repo, ".worktrees", FOLDER, ROUND), "utf8")).toContain(
      "**Answer:** Neither, keep it simple",
    ),
  );
  await waitFor(() => expect(unloadCancelled()).toBe(false));
});

test("the editor's own redirect after a move does not ask, though text is unsaved", async () => {
  await app.open("/edit/specs/drafts/git-listener.md");
  await click(await screen.findByRole("button", { name: "Edit" }));
  const field = screen.getByRole("textbox", { name: "Text" }) as HTMLTextAreaElement;
  await type(field, `${field.value}\nTyped, not saved.\n`);
  field.setSelectionRange(field.value.length, field.value.length);
  const bytes = readFileSync(fixture("images/phone.png"));

  await act(async () => {
    fireEvent.change(screen.getByLabelText("Add image", { selector: "input" }), {
      target: { files: [new File([bytes], "login.png", { type: "image/png" })] },
    });
  });

  const moved = "specs/drafts/git-listener/proposal.md";
  await waitFor(() => expect(window.location.pathname).toBe(app.path(`/edit/${moved}`)));
  await waitFor(() => expect(read(app.repo, moved)).toContain("![login](images/login.webp)"));
  expect(read(app.repo, moved)).toContain("Typed, not saved.");
  expect(screen.queryByRole("dialog", { name: /leave/i })).toBeNull();
});
