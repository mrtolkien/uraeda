// US5 5 in a real browser's history: Back from a page holding unsaved text puts the page back and
// asks; the confirmation's own history entry, above the one put back, is what Back and its buttons
// go over; "Leave page" then goes back to the page before.
import { act, screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { navigate } from "../routes.tsx";
import { atRepo, show } from "./helpers.tsx";

const FOLDER = "2026-10-11-web-ui";
const PAGE = `/f/${FOLDER}/clarifications-01.md`;
const FEATURE = `/f/${FOLDER}`;
const QUESTION = "How does your iPhone reach the server?";
const LEAVE = "Leave page?";

const leaveDialog = () => screen.queryByRole("dialog", { name: LEAVE });
const overlayEntry = () => (window.history.state as { overlay?: string } | null)?.overlay;

/** Q3's comment field, not its follow-ups'. */
const q3Comment = () =>
  within(document.getElementById("Q3")!).getAllByRole("textbox", {
    name: "Comment",
  })[0] as HTMLTextAreaElement;

/** Goes back, as the browser's Back button, and waits for the asking dialog. */
async function backAsks() {
  window.history.back();
  return screen.findByRole("dialog", { name: LEAVE });
}

test("Back from unsaved text asks, stays, and leaves on Leave page", async () => {
  await show(FEATURE, "Web UI for the workflow files");
  await act(async () => navigate(atRepo(PAGE)));
  await screen.findByText(QUESTION);
  await userEvent.fill(q3Comment(), "Neither, keep it simple");

  // Stay: the page and its text stay, on an entry of the page, the confirmation's gone.
  await userEvent.click(within(await backAsks()).getByRole("button", { name: "Stay" }));
  await waitFor(() => expect(leaveDialog()).toBeNull());
  await expect.poll(overlayEntry).toBeUndefined();
  expect(window.location.pathname).toBe(atRepo(PAGE));
  expect(q3Comment().value).toBe("Neither, keep it simple");

  // Back on the confirmation closes it, as Back closes every dialog: the page stays.
  await backAsks();
  window.history.back();
  await waitFor(() => expect(leaveDialog()).toBeNull());
  await expect.poll(overlayEntry).toBeUndefined();
  expect(window.location.pathname).toBe(atRepo(PAGE));
  expect(screen.getByText(QUESTION)).toBeTruthy();

  // Leave page: back to the feature's page, without asking again.
  await userEvent.click(within(await backAsks()).getByRole("button", { name: "Leave page" }));
  await expect.poll(() => window.location.pathname).toBe(atRepo(FEATURE));
  await waitFor(() => expect(screen.queryByText(QUESTION)).toBeNull());
  expect(leaveDialog()).toBeNull();
});
