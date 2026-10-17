// US3 of the UI iteration flow: a round's visual question, whose options are stories. Each variant
// shows under its option's button, which still picks it (US3.1); a comment on a picked element of a
// variant joins the question's answer on a line of its own, keeping the comment saved and leaving
// the one typed unsaved (US3.2, R9, R36), as a comment on a follow-up's story or a question's
// context story joins that question's answer (R37); a variant removed after the answer says so, and
// an answered round takes no comment (US3.4, R10). Two questions embedding the same story keep their
// own unsaved comments on it.
import { screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { atSize, commands, reload, show } from "./helpers.tsx";

atSize("desktop");

const FEATURE = "2026-10-20-sidebar-resize";
const ROUND = `/f/${FEATURE}/clarifications-01.md`;
const ROUND_PATH = `specs/${FEATURE}/clarifications-01.md`;
const ROUND_FILE = `.worktrees/${FEATURE}/${ROUND_PATH}`;
const Q2 = "What does the handle look like?";
/** How long the fake preview may take to start and its story to load, on a loaded machine. */
const READY = { interval: 100, timeout: 20_000 };

/** Q2's comment field: Q1's comes first. */
const q2Comment = () =>
  screen.getAllByRole("textbox", {
    name: "Comment, or your own answer instead of a letter",
  })[1] as HTMLTextAreaElement;

/** An option's card, by its sentence. */
const optionCard = (text: RegExp) =>
  screen.getByText(text).closest<HTMLElement>(".astryx-selectable-card")!;

test("each variant shows under its option's button, which still picks it (US3.1)", async () => {
  await commands.addStoryFeature();
  await show(ROUND, Q2);

  const a = optionCard(/A thin line/);
  const thin = await screen.findByRole("figure", { name: "Thin line" });
  expect(a.contains(thin)).toBe(false);
  expect(a.compareDocumentPosition(thin) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  const grip = screen.getByRole("figure", { name: "Grip" });
  expect(a.compareDocumentPosition(grip) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
  // An embed loads its frames once on screen.
  thin.scrollIntoView();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");

  await userEvent.click(a);
  expect((within(a).getByRole("checkbox") as HTMLInputElement).checked).toBe(true);
  await expect.poll(() => commands.readRepo(ROUND_FILE)).toMatch(/\*\*Answer:\*\* A\n\n## Settled/);
});

/** Commits the test feature's round, rewritten by `edit`, on its branch. */
async function editRound(edit: (round: string) => string) {
  await commands.commitOnBranch(FEATURE, {
    [ROUND_PATH]: edit(await commands.readRepo(ROUND_FILE)),
  });
}

/** Picks the separator in a story's desktop frame, and saves a comment on it with Ctrl+Enter. */
async function commentOnSeparator(label: string, text: string) {
  const embed = await screen.findByRole("figure", { name: label });
  embed.scrollIntoView();
  await expect.poll(() => commands.frameText(`${label}, desktop`), READY).not.toBe("");
  // A click on the element itself: userEvent finds the button again by its label, which matches
  // both variants' Pick buttons.
  (await within(embed).findByRole("button", { name: "Pick an element" }, READY)).click();
  await expect
    .poll(() => commands.frameOutlined(`${label}, desktop`, "separator"), READY)
    .toBe(true);
  await commands.frameClick(`${label}, desktop`, "separator");
  expect(await within(embed).findByText(`Comment on ${label}, desktop, separator`)).toBeTruthy();
  await userEvent.keyboard(text);
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
}

test("a variant nested in its option's quote or list shows outside its button (US3.1)", async () => {
  await commands.addStoryFeature();
  // A quote holds A's story, and a numbered list's loose item holds B's.
  await editRound((round) =>
    round
      .replace("  [Thin line](", "  > [Thin line](")
      .replace("  [Grip](/packages/web/src/SidebarHandle.stories.tsx#Grip)\n\n", "")
      .replace(
        "  - [con] one more thing on screen.\n",
        "  - [con] one more thing on screen.\n\n  1. As drawn:\n\n     [Grip](/packages/web/src/SidebarHandle.stories.tsx#Grip)\n",
      ),
  );
  await show(ROUND, Q2);

  const a = optionCard(/A thin line/);
  const b = optionCard(/A grip of three dots/);
  const thin = await screen.findByRole("figure", { name: "Thin line" });
  expect(a.contains(thin)).toBe(false);
  // B's item, its text and its story, shows too.
  expect(await screen.findByText("As drawn:")).toBeTruthy();
  const grip = await screen.findByRole("figure", { name: "Grip" });
  expect(b.contains(grip)).toBe(false);
  thin.scrollIntoView();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");
  grip.scrollIntoView();
  await expect.poll(() => commands.frameText("Grip, desktop"), READY).toContain("Grip");
});

test("a comment on a variant joins the question's answer, on a line of its own (US3.2)", async () => {
  await commands.addStoryFeature();
  await show(ROUND, Q2);
  await userEvent.click(optionCard(/A grip of three dots/));
  await userEvent.click(q2Comment());
  await userEvent.keyboard("Keep it visible.");
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  await expect.poll(() => commands.readRepo(ROUND_FILE)).toContain("B: Keep it visible.");
  await userEvent.type(q2Comment(), " Not sent yet.");

  const grip = screen.getByRole("figure", { name: "Grip" });
  grip.scrollIntoView({ block: "start" });
  await expect.poll(() => commands.frameText("Grip, desktop"), READY).toContain("Grip");
  // A click on the element itself: userEvent finds the button again by its label, which matches
  // both variants' Pick buttons.
  (await within(grip).findByRole("button", { name: "Pick an element" }, READY)).click();
  await expect.poll(() => commands.frameOutlined("Grip, desktop", "separator"), READY).toBe(true);
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
  // An embed loads its frames once on screen (R18).
  screen.getByRole("figure", { name: "Thin line" }).scrollIntoView();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");
  expect(screen.getAllByText("This variant was removed after your answer.")).toHaveLength(1);
});

test("a comment on a follow-up's variant joins the follow-up's answer (R37)", async () => {
  await commands.addStoryFeature();
  await editRound((round) => {
    // Q2's answer is the round's last.
    const at = round.lastIndexOf("**Answer:**\n");
    const followUp = [
      "**Answer:** B",
      "",
      "### Q2.B: How many dots?",
      "",
      "Only if you picked B in Q2.",
      "",
      "- **A (recommended). Three dots.**",
      "",
      "  [Three dots](/packages/web/src/SidebarHandle.stories.tsx#Dragging)",
      "",
      "  - [pro] small.",
      "- **B. Five dots.**",
      "  - [pro] easier to grab.",
      "",
      "**Answer:**",
      "",
    ].join("\n");
    return `${round.slice(0, at)}${followUp}${round.slice(at + 12)}`;
  });
  await show(ROUND, "How many dots?");

  await commentOnSeparator("Three dots", "Smaller dots.");

  const line = "Story SidebarHandle.stories.tsx#Dragging, desktop, separator: Smaller dots.";
  await expect
    .poll(async () => (await commands.readRepo(ROUND_FILE)).split("### Q2.B")[1], READY)
    .toContain(line);
  const [before] = (await commands.readRepo(ROUND_FILE)).split("### Q2.B");
  expect(before).not.toContain(line);
  expect(before).toContain("**Answer:** B\n");
});

test("a comment on a story in a question's context joins its answer (R37)", async () => {
  await commands.addStoryFeature();
  await editRound((round) =>
    round.replace(
      "Why it matters: a wide sidebar takes the reading column's room.",
      "Why it matters: a wide sidebar takes the reading column's room.\n\n[Dragging the handle](/packages/web/src/SidebarHandle.stories.tsx#Dragging)",
    ),
  );
  await show(ROUND, "How wide can the sidebar get?");

  await commentOnSeparator("Dragging the handle", "Wider.");

  const line = "Story SidebarHandle.stories.tsx#Dragging, desktop, separator: Wider.";
  await expect
    .poll(async () => (await commands.readRepo(ROUND_FILE)).split("## Q2")[0], READY)
    .toContain(line);
  expect((await commands.readRepo(ROUND_FILE)).split("## Q2")[1]).not.toContain(line);
});

test("an answered round's stories take no comment (US3.4, R10)", async () => {
  await commands.addStoryFeature({ round: "answered" });
  await show(ROUND, Q2);

  const thin = await screen.findByRole("figure", { name: "Thin line" });
  // An embed loads its frames once on screen (R18).
  thin.scrollIntoView();
  await expect.poll(() => commands.frameText("Thin line, desktop"), READY).toContain("ThinLine");
  expect(within(thin).queryByRole("button", { name: "Pick an element" })).toBeNull();
  expect(within(thin).queryByRole("button", { name: "Comment" })).toBeNull();
});

/** Q1's embed of the Grip story, in its context, after `editRound` put it there. */
const inQ1 = () => screen.getByRole("figure", { name: "Handle grip" });

/** Q2's embed of the Grip story, its option B's variant. */
const inQ2 = () => screen.getByRole("figure", { name: "Grip" });

/** The text of the comment form open in an embed. */
const text = (figure: HTMLElement) =>
  (within(figure).getByRole("textbox") as HTMLTextAreaElement).value;

test("two questions embedding the same story keep their own unsaved comments on it", async () => {
  await commands.addStoryFeature();
  await editRound((round) =>
    round.replace(
      "Why it matters: a wide sidebar takes the reading column's room.",
      "Why it matters: a wide sidebar takes the reading column's room.\n\n[Handle grip](/packages/web/src/SidebarHandle.stories.tsx#Grip)",
    ),
  );
  await show(ROUND, Q2);

  await userEvent.click(await within(inQ1()).findByRole("button", { name: "Comment" }, READY));
  await userEvent.keyboard("For Q1.");
  expect(within(inQ2()).queryByRole("form", { name: "Comment" })).toBeNull();
  await userEvent.click(await within(inQ2()).findByRole("button", { name: "Comment" }, READY));
  expect(text(inQ2())).toBe("");
  await userEvent.keyboard("For Q2.");
  expect(text(inQ1())).toBe("For Q1.");

  await reload(Q2);

  await within(inQ1()).findByRole("textbox", {}, READY);
  expect(text(inQ1())).toBe("For Q1.");
  expect(text(inQ2())).toBe("For Q2.");
});
