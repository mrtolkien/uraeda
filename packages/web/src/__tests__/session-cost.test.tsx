// The cost of typing in a session's composer: a keystroke redraws no message of the transcript.
// Counted, never timed: every agent message draws through Astryx's `Markdown`, so its calls are the
// profile.
import { screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { fakeAgent, fixtureRepo, renderPage, type } from "./helpers.tsx";
import { TAIL_MESSAGES } from "../tail.tsx";

const calls = vi.hoisted(() => ({ markdown: 0 }));

vi.mock(import("@astryxdesign/core/Markdown"), async (original) => {
  const real = await original();
  return {
    ...real,
    Markdown: (props: Parameters<typeof real.Markdown>[0]) => {
      calls.markdown += 1;
      return real.Markdown(props);
    },
  };
});

/** Opens a chat whose one turn holds `count` agent messages, and waits for the last. */
async function openChatWith(count: number) {
  const repo = fixtureRepo();
  const fake = await fakeAgent();
  const chat = await fake.sessions.newChat(repo);
  const { cache } = fake.sessions;
  const turn = cache.addTurn({
    allowed: null,
    kind: "chat",
    sessionId: chat.id,
    state: "running",
    step: null,
    trigger: null,
  });
  for (let index = 1; index <= count; index += 1) {
    cache.appendItem(turn, { kind: "text", streaming: false, text: `Reply number ${index}.` });
  }
  cache.endTurn(turn, { state: "done" });
  await renderPage(`/chats/${chat.id}`, repo, { agent: fake });
  await screen.findByText(`Reply number ${count}.`);
}

test("typing in the composer redraws no message of the transcript", async () => {
  await openChatWith(30);
  const composer = screen.getByRole("textbox", { name: "Message Claude Code" });
  const before = calls.markdown;
  // The tail draws the latest 20 of the 30 (R7).
  expect(before).toBeGreaterThanOrEqual(TAIL_MESSAGES);

  for (const text of ["h", "he", "hel", "hell", "hello"]) {
    await type(composer, text);
  }

  expect(composer.textContent).toBe("hello");
  expect(calls.markdown).toBe(before);
});
