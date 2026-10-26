// US5 4 and 5: leaving a page that holds unsaved text asks first, through the app's dialog for a
// link or Back.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { navigate } from "../routes.tsx";
import { atRepo, click, fixtureRepo, renderPage, today, type } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const FEATURE = `/f/${FOLDER}`;
const LEAVE = "Leave page?";
const BODY = "Your unsaved text stays in this browser, and comes back when you return.";

today("2026-10-11");

/** Q3's comment field, not its follow-ups'. */
const q3Comment = () =>
  within(document.getElementById("Q3") as HTMLElement).getAllByLabelText(
    "Comment, or your own answer instead of a letter",
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
