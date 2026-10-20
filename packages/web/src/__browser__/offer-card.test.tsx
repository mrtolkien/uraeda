// The agent's offer card in a session (US2 of merge chats), at both sizes: a session opened at its
// end keeps its end in view, the card's buttons above the composer, though the card draws after
// the transcript.
import { screen, within } from "@testing-library/react";
import { createFateClient } from "react-fate/client";
import { expect, test } from "vite-plus/test";
import { sendMessage as sendTo } from "../sessions.ts";
import { agent, atRepo, atSize, drawn, LIVE, show } from "./helpers.tsx";

atSize("both");

const OFFER = [
  "The guard and the router both redirect: this should not land on main directly.",
  "",
  "```uraeda-offer change",
  "# Login redirects twice",
  "",
  "After signing in, the app shows the home page, then the sign-in page again.",
  "```",
].join("\n");

const ENDED = { denials: [], errors: [], interrupted: false, ok: true, type: "result" as const };

test("a session opened at its end shows its offer's buttons above the composer", async () => {
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

  expect(card.getByRole("button", { name: "Start the change" })).toBeTruthy();
  // At its end, the card's end with it: the composer's band covers nothing of it.
  const box = document.scrollingElement!;
  expect(box.scrollHeight - box.scrollTop - box.clientHeight).toBeLessThanOrEqual(1);
});
