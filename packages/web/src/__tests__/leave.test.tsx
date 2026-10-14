// US5 1, 4, 5, and 6, and the plan's review focus 7: leaving a page that holds unsaved text asks
// first, through the app's dialog for a link, `navigate`, or Back, and the browser's prompt for a
// reload; nothing asks when nothing is unsaved, nor for Back closing a sheet, nor for a redirect.
import { readFileSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { afterEach, expect, test, vi } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import {
  atRepo,
  atWidth,
  click,
  fixture,
  fixtureRepo,
  git,
  read,
  renderPage,
  today,
  type,
} from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const ROUND = `specs/${FOLDER}/clarifications-01.md`;
const FEATURE = `/f/${FOLDER}`;
const LEAVE = "Leave page?";
const BODY = "Your unsaved text stays in this browser, and comes back when you return.";

today("2026-10-11");

afterEach(() => {
  vi.restoreAllMocks();
});

/** Q3's comment field, not its follow-ups'. */
const q3Comment = () =>
  within(document.getElementById("Q3") as HTMLElement).getAllByLabelText(
    "Comment",
  )[0] as HTMLTextAreaElement;

/** The breadcrumb's link to the feature's page. */
const featureLink = () =>
  within(screen.getByRole("navigation", { name: "Breadcrumbs" }))
    .getAllByRole("link")
    .find((link) => link.getAttribute("href") === atRepo(FEATURE)) as HTMLElement;

const leaveDialog = () => screen.queryByRole("dialog", { name: LEAVE });

/** The round, with Q3's comment typed and not saved. */
async function roundWithUnsavedComment() {
  const page = await renderPage(PAGE);
  await screen.findByText("How does your iPhone reach the server?");
  await type(q3Comment(), "Neither, keep it simple");
  return page;
}

/** The feature's page, then the round opened from it, as by a link: Back has a page to go to. */
async function roundOpenedFromFeature(repo = fixtureRepo()) {
  const page = await renderPage(FEATURE, repo);
  await act(async () => navigate(atRepo(PAGE)));
  await screen.findByText("How does your iPhone reach the server?");
  return page;
}

async function back() {
  await act(async () => window.history.back());
}

/** A `beforeunload` event sent to the window, as a reload or a closed tab sends: cancelled or not. */
function unloadCancelled() {
  const event = new Event("beforeunload", { cancelable: true });
  window.dispatchEvent(event);
  return event.defaultPrevented;
}

/** US5 4 */
test("a link away from unsaved text asks first; Stay keeps the page, Leave page leaves", async () => {
  await roundWithUnsavedComment();

  await click(featureLink());

  const dialog = await screen.findByRole("dialog", { name: LEAVE });
  expect(within(dialog).getByText(BODY)).toBeTruthy();
  await click(within(dialog).getByRole("button", { name: "Stay" }));
  await waitFor(() => expect(leaveDialog()).toBeNull());
  expect(window.location.pathname).toBe(atRepo(PAGE));
  expect(q3Comment().value).toBe("Neither, keep it simple");

  await click(featureLink());
  await click(
    within(await screen.findByRole("dialog", { name: LEAVE })).getByRole("button", {
      name: "Leave page",
    }),
  );
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));
});

/** US5 4, through a page's own `navigate`, as a button that opens another page calls it. */
test("a page opened by navigate asks the same", async () => {
  await roundWithUnsavedComment();

  await act(async () => navigate(atRepo(FEATURE)));

  const dialog = await screen.findByRole("dialog", { name: LEAVE });
  expect(window.location.pathname).toBe(atRepo(PAGE));
  await click(within(dialog).getByRole("button", { name: "Leave page" }));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));
});

/** US5 5 */
test("Back from unsaved text asks first, the page staying while it asks", async () => {
  await roundOpenedFromFeature();
  await type(q3Comment(), "Neither, keep it simple");

  await back();

  const dialog = await screen.findByRole("dialog", { name: LEAVE });
  expect(window.location.pathname).toBe(atRepo(PAGE));
  await click(within(dialog).getByRole("button", { name: "Stay" }));
  await waitFor(() => expect(leaveDialog()).toBeNull());
  expect(window.location.pathname).toBe(atRepo(PAGE));
  expect(q3Comment().value).toBe("Neither, keep it simple");

  await back();
  await click(
    within(await screen.findByRole("dialog", { name: LEAVE })).getByRole("button", {
      name: "Leave page",
    }),
  );
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));
  expect(leaveDialog()).toBeNull();
});

/** US5 6 */
test("with nothing unsaved, a link, Back, and a reload do not ask", async () => {
  const listen = vi.spyOn(window, "addEventListener");
  await roundOpenedFromFeature();
  expect(listen.mock.calls.filter(([name]) => name === "beforeunload")).toEqual([]);
  // Text typed, then put back as it was saved: nothing is unsaved.
  await type(q3Comment(), "Neither");
  await type(q3Comment(), "");

  expect(unloadCancelled()).toBe(false);
  await click(featureLink());
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));
  await back();
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(PAGE)));
  await screen.findByText("How does your iPhone reach the server?");
  await back();
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));

  expect(leaveDialog()).toBeNull();
});

/** US5 1: the browser's own prompt, for a reload or a closed tab. */
test("a reload with unsaved text gets the browser's prompt, until it is saved", async () => {
  const { repo } = await roundWithUnsavedComment();

  expect(unloadCancelled()).toBe(true);

  await click(
    within(document.getElementById("Q3") as HTMLElement).getAllByRole("button", {
      name: "Save comment",
    })[0],
  );
  await waitFor(() =>
    expect(readFileSync(join(repo, ".worktrees", FOLDER, ROUND), "utf8")).toContain(
      "**Answer:** Neither, keep it simple",
    ),
  );
  await waitFor(() => expect(unloadCancelled()).toBe(false));
});

const SETTLED = "## Settled without the human";
const UNDO = "Undoing a completion";

/** A round in the feature's worktree that settles the recurring-tasks example's points. */
function roundWithSettledPoints() {
  const repo = fixtureRepo();
  git(repo, "worktree", "add", "--quiet", join(".worktrees", FOLDER), FOLDER);
  const example = readFileSync(
    fixture(
      "repo/branches/2026-10-06-recurring-tasks/specs/2026-10-06-recurring-tasks/clarifications-01.md",
    ),
    "utf8",
  );
  const settled = example.slice(example.indexOf(SETTLED), example.indexOf("**Notes:**"));
  const path = join(repo, ".worktrees", FOLDER, ROUND);
  const all = readFileSync(path, "utf8");
  writeFileSync(path, `${all.slice(0, all.indexOf(SETTLED))}${settled}**Notes:**\n`);
  return repo;
}

/** Review focus 7: Back closes the sheet; the text it held is unsaved, and kept, not on the page. */
test("Back closing a sheet with an unsaved comment does not ask, nor does the page after", async () => {
  atWidth(402);
  await roundOpenedFromFeature(roundWithSettledPoints());
  await click(await screen.findByRole("button", { name: new RegExp(`^${UNDO}`) }));
  const sheet = await screen.findByRole("dialog", { name: "Comment" });
  await type(within(sheet).getByLabelText("Comment text"), "Half typed");

  await back();

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Comment" })).toBeNull());
  expect(leaveDialog()).toBeNull();
  expect(window.location.pathname).toBe(atRepo(PAGE));

  // The comment's text is kept, in a sheet no longer drawn: leaving the page loses nothing.
  await back();
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(FEATURE)));
  expect(leaveDialog()).toBeNull();
});

/** Review focus 7: a draft moved into a folder as an image is added shows at its new path. */
test("the editor's redirect after a move does not ask", async () => {
  const { repo } = await renderPage("/edit/specs/drafts/git-listener.md");
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
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/edit/${moved}`)));
  await waitFor(() => expect(read(repo, moved)).toContain("![login](images/login.webp)"));
  expect(read(repo, moved)).toContain("Typed, not saved.");
  expect(leaveDialog()).toBeNull();
});
