// US3 of the UI iteration flow: a round's visual question, whose options are stories. Each variant
// shows under its option's button, which still picks it (US3.1); a comment on a picked element of a
// variant joins the question's answer on a line of its own, keeping the comment saved and leaving
// the one typed unsaved (US3.2, R9, R36); a variant removed after the answer says so (US3.4).
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, commands, show } from "./helpers.tsx";

atSize("desktop");

const FEATURE = "2026-10-20-sidebar-resize";
const ROUND = `/f/${FEATURE}/clarifications-01.md`;
const ROUND_FILE = `.worktrees/${FEATURE}/specs/${FEATURE}/clarifications-01.md`;
const Q2 = "What does the handle look like?";
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** Q2's comment field: Q1's comes first. */
const q2Comment = () =>
  screen.getAllByRole("textbox", { name: "Comment" })[1] as HTMLTextAreaElement;

test("each variant shows under its option's button, which still picks it (US3.1)", async () => {
  await commands.addStoryFeature();
  await show(ROUND, Q2);

  const a = screen.getByRole("button", { name: /A thin line/ });
  const thin = await screen.findByRole("figure", { name: "Thin line" });
  expect(a.contains(thin)).toBe(false);
  expect(a.compareDocumentPosition(thin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const grip = screen.getByRole("figure", { name: "Grip" });
  expect(a.compareDocumentPosition(grip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");

  await userEvent.click(a);
  expect(a.getAttribute("aria-pressed")).toBe("true");
  await expect.poll(() => commands.readRepo(ROUND_FILE)).toMatch(/\*\*Answer:\*\* A\n\n## Settled/);
});

test("a comment on a variant joins the question's answer, on a line of its own (US3.2)", async () => {
  await commands.addStoryFeature();
  await show(ROUND, Q2);
  await userEvent.click(screen.getByRole("button", { name: /A grip of three dots/ }));
  await userEvent.click(q2Comment());
  await userEvent.keyboard("Keep it visible.");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  await expect.poll(() => commands.readRepo(ROUND_FILE)).toContain("B: Keep it visible.");
  await userEvent.type(q2Comment(), " Not sent yet.");

  const grip = screen.getByRole("figure", { name: "Grip" });
  await expect.poll(() => commands.frameText("Grip, desktop"), READY).toContain("Grip");
  await userEvent.click(
    await within(grip).findByRole("button", { name: "Pick an element" }, READY),
  );
  await commands.frameClick("Grip, desktop", "separator");
  expect(await within(grip).findByText("Comment on Grip, desktop, separator")).toBeTruthy();
  await userEvent.keyboard("Thicker grip.");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");

  await expect
    .poll(() => commands.readRepo(ROUND_FILE), READY)
    .toContain(
      "B: Keep it visible.\nStory SidebarHandle.stories.tsx#Grip, desktop, separator: Thicker grip.",
    );
  expect(await commands.readRepo(ROUND_FILE)).not.toContain("Not sent yet.");
  // The text typed stays unsaved, the line after it, so saving it later keeps the line (R36).
  expect(q2Comment().value).toBe(
    "Keep it visible. Not sent yet.\nStory SidebarHandle.stories.tsx#Grip, desktop, separator: Thicker grip.",
  );
  // The comment went to the round, not to a review of the spec.
  expect(await commands.repoFileSize(`.worktrees/${FEATURE}/specs/${FEATURE}/spec-review.md`)).toBe(
    -1,
  );
});

test("a variant removed after the answer says so, and the one kept still shows (US3.4)", async () => {
  await commands.addStoryFeature({ round: "answered" });
  await show(ROUND, Q2);

  const grip = await screen.findByRole("figure", { name: "Grip" });
  expect(
    await within(grip).findByText("This variant was removed after your answer.", {}, READY),
  ).toBeTruthy();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");
  expect(screen.getAllByText("This variant was removed after your answer.")).toHaveLength(1);
});
