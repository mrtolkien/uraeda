// The final review's finding 5: the stretch a recap line opened stays in the address only while it
// is the human's place. A new turn takes it out, so the Activity follows the latest calls again,
// and the phone's status line's Activity opens the sheet at the latest calls, not at a stretch
// kept.
import { screen, waitFor } from "@testing-library/react";
import type { Item } from "uraeda-server/fate";
import { beforeEach, expect, test } from "vite-plus/test";
import {
  addRun,
  atWidth,
  click,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
} from "./helpers.tsx";

beforeEach(() => {
  window.localStorage.clear();
  atWidth(1440);
});

const read = (target: string): Item => ({
  durationMs: 1000,
  id: `call-${target}`,
  kind: "tool",
  name: "Read",
  status: "completed",
  target,
  toolKind: "read",
});
const asked = (text: string): Item => ({
  id: `message-${text}`,
  kind: "message",
  origin: "human",
  state: "read",
  text,
});
const said = (text: string): Item => ({ kind: "text", streaming: false, text });

/** A chat of one ended turn, a stretch of reads: the chat, its fake agent, the stretch's key. */
async function chatWithStretch() {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const turn = addRun(fake, chat.id, [asked("Read."), read("src/a.ts"), said("Read.")]);
  return { chat: chat.id, fake, key: `${turn}%3A1`, repo };
}

test("a new turn takes the stretch out of the address, and the Activity follows the latest", async () => {
  const { chat, fake, key, repo } = await chatWithStretch();
  await renderPage(`/sessions/${chat}?tab=activity&stretch=${key}`, repo, { agent: fake });
  await screen.findByRole("region", { name: "Activity" });
  expect(window.location.search).toBe(`?tab=activity&stretch=${key}`);

  addRun(fake, chat, [asked("Again."), read("src/b.ts")], "running");

  await refreshUntil(() => expect(window.location.search).toBe("?tab=activity"));
});

test("on the phone, the status line's Activity opens the sheet at the latest, not a kept stretch", async () => {
  atWidth(375);
  const { chat, fake, key, repo } = await chatWithStretch();
  // The page's entry as a sheet opened from a recap line leaves it once closed.
  await renderPage(`/sessions/${chat}?stretch=${key}`, repo, { agent: fake });

  await click(await screen.findByRole("button", { name: "Activity" }));

  await waitFor(() => expect(window.location.search).toBe("?tab=activity"));
});
