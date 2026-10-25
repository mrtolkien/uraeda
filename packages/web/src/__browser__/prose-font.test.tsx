// The UI look decision's fonts in a reading block: its text is set in the reading font, Inter, and
// the controls inside it keep the UI's monospace font, as an offer card's button in a transcript.
import { screen, within } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import { expect, test } from "vite-plus/test";
import { sendMessage as sendTo } from "../sessions.ts";
import { agent, atRepo, atSize, commands, drawn, LIVE, show } from "./helpers.tsx";

atSize("desktop");

const PARAGRAPH = "The guard and the router both redirect: this should not land on main directly.";

const OFFER = [
  PARAGRAPH,
  "",
  "```uraeda-offer change",
  "# Login redirects twice",
  "",
  "After signing in, the app shows the home page, then the sign-in page again.",
  "```",
].join("\n");

const ENDED = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

/** The first family of an element's computed font. */
const family = (element: Element) =>
  getComputedStyle(element).fontFamily.split(",")[0]!.replaceAll(/["']/g, "").trim();

test("a reading block's text is Inter, and a button inside it stays monospace", async () => {
  await show("/", "Priorities");
  const fate = createFateClient({ url: atRepo("/fate") });
  const sent = await sendTo(fate, { text: "Why does the login redirect twice? Fix it." });
  if (!sent.ok) {
    throw new Error(sent.message);
  }
  await agent.agentAccept();
  await agent.agentEmit([{ text: OFFER, type: "text" }, ENDED]);

  await show(`/sessions/${sent.session}`, "Login redirects twice");
  const card = within(await screen.findByRole("region", { name: "Start a change" }, LIVE));
  await drawn();

  expect(family(screen.getByText(PARAGRAPH))).toBe("Inter Variable");
  expect(family(card.getByRole("button", { name: "Start the change" }))).toBe(
    "JetBrains Mono Variable",
  );
});

test("a plan's lead and a task's paragraph are in the reading font, as its list items", async () => {
  const folder = "2026-10-13-plan-review";
  const plan = await commands.fixtureText("plan-page/plan.md");
  await commands.commitOnBranch(folder, { [`specs/${folder}/plan.md`]: plan });
  await show(`/f/${folder}/plan.md`, "Global constraints");
  await drawn();

  const lead = screen.getByRole("region", { name: "Goal" });
  const task = screen.getByRole("region", {
    name: "Task 1 · The session's view, scrolling in the round's column",
  });
  const item = within(task).getAllByRole("listitem")[0]!;
  const paragraph = within(task)
    .getByText(/the session's scrolling moves into a box/)
    .closest("p")!;
  expect(family(item)).toBe("Inter Variable");
  expect(
    family(
      within(lead)
        .getByText(/the round of questions draws/)
        .closest("p")!,
    ),
  ).toBe(family(item));
  expect(family(paragraph)).toBe(family(item));
});
