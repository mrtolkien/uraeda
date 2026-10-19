// What the session flows share: the page's composer and transcript, a turn the test keeps open, and
// messages written into a session as the runner would.
import { readFileSync } from "node:fs";
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { fixture } from "uraeda-binding/test-utils";
import { expect } from "vite-plus/test";
import { click, type, type Flow } from "./harness.tsx";

/** The composer's text field, once the page is drawn. */
export function composer() {
  return screen.findByRole("textbox", { name: /^Message/ });
}

/** The composer's text now. */
export function composerText() {
  return screen.getByRole("textbox", { name: /^Message/ }).textContent;
}

/** The transcript as drawn now. */
export function log() {
  return within(screen.getByRole("log"));
}

/** Types a message and presses Send. */
export async function send(text: string) {
  await type(await composer(), text);
  await click(await screen.findByRole("button", { name: "Send" }));
}

/** Puts the fake agent as it was at the start of a file's tests. */
export function resetAgent(app: Flow) {
  app.agent.sent.length = 0;
  app.agent.takenBack.length = 0;
  app.agent.opens.length = 0;
  app.agent.interrupts = 0;
  app.agent.installed = true;
  app.agent.capabilities = { ...app.agent.capabilities, images: true, takeBack: true };
}

/**
 * Sends a message that the agent reads, and leaves its turn going. The message in the transcript
 * says the session's own view is drawn, so what the test types next reaches its composer.
 */
export async function openTurn(app: Flow, text = "Why did you recommend A?") {
  await send(text);
  await waitFor(() => expect(app.agent.sent).toHaveLength(1));
  app.agent.emit({ id: app.agent.sent[0].id, type: "accepted" });
  await waitFor(() => expect(log().getByText(text)).toBeTruthy());
}

/** A new turn of a session, running until its end. */
export function addTurn(app: Flow, session: string, kind: "chat" | "workflow" = "chat") {
  return app.sessions.cache.addTurn({
    allowed: null,
    kind,
    sessionId: session,
    state: "running",
    step: kind === "workflow" ? "implementation" : null,
    trigger: kind === "workflow" ? "manual" : null,
  });
}

/** A PNG of the fixtures, as the picker or the clipboard gives it. */
export const png = (name = "login.png") =>
  new File([readFileSync(fixture("images/phone.png"))], name, { type: "image/png" });

/** Picks files with the attach button, as the system's picker gives them. */
export async function pick(files: Array<File>) {
  const input = await screen.findByLabelText(/^Add image/, { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

/** Pastes files into the composer, as from the clipboard. */
export async function paste(files: Array<File>) {
  const box = await composer();
  await act(async () => {
    fireEvent.paste(box, { clipboardData: { files, getData: () => "", types: ["Files"] } });
  });
}

/** Drops files anywhere on the page. */
export async function drop(files: Array<File>) {
  await act(async () => {
    fireEvent.drop(document.body, { dataTransfer: { files, types: ["Files"] } });
  });
}

/** The thumbnails' remove buttons, once every image is saved. */
export function thumbnails(count?: number) {
  return waitFor(() => {
    const buttons = screen.getAllByRole("button", { name: /^Remove / });
    if (count !== undefined) {
      expect(buttons).toHaveLength(count);
    }
    for (const remove of buttons) {
      expect(
        remove.closest('[role="group"]')?.querySelector('[role="status"][aria-label]'),
      ).toBeNull();
    }
    return buttons;
  });
}

/** The server's `fetch` that remembers the id of each image an upload saved. */
export function recording(app: Flow) {
  const saved: Array<string> = [];
  const fetch: typeof globalThis.fetch = async (input, init) => {
    const response = await app.fetch(input, init);
    const url = typeof input === "object" && "url" in input ? input.url : input.toString();
    if (url.includes("/attach?") && response.ok) {
      saved.push(((await response.clone().json()) as { id: string }).id);
    }
    return response;
  };
  return { fetch, saved };
}
