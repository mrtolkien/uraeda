import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  controlled,
  fieldText,
  png,
  refused,
  renderComposer,
  savedImage,
  sessionRecord,
  settle,
} from "./helpers.tsx";

const TEXT = "First line\n\n  indented second line";
const FIRST = savedImage("11111111-1111-4111-8111-111111111111.webp", "first.png");
const SECOND = savedImage("22222222-2222-4222-8222-222222222222.webp", "second.png");
const THIRD = savedImage("33333333-3333-4333-8333-333333333333.webp", "third.png");

/** A text query's option for the text shown on the page, not in Astryx's announcements. */
const SHOWN = { ignore: "script, style, [data-astryx-live-region]" };

const field = () => screen.getByRole("textbox", { name: "Message Claude Code" });
const thumbnails = () =>
  screen
    .queryAllByRole("button", { name: /^Remove / })
    .map((button) => button.getAttribute("aria-label") ?? button.textContent);

async function ctrlEnter() {
  await act(async () => {
    fireEvent.keyDown(field(), { ctrlKey: true, key: "Enter" });
  });
}

async function pick(files: Array<File>) {
  const input = await screen.findByLabelText("Add images", { selector: "input" });
  await act(async () => {
    fireEvent.change(input, { target: { files } });
  });
}

test("a refused send reaches the endpoint, then restores its exact text, images and reason", async () => {
  const answer = controlled<never>();
  const { draft, endpoint } = await renderComposer(
    { session: "chat-1" },
    {
      attach: async () => THIRD.image!,
      images: [FIRST, SECOND],
      mutations: { "session.send": () => answer.promise },
      sessions: [sessionRecord("chat-1")],
      value: TEXT,
    },
  );

  await ctrlEnter();

  // The composer empties while the endpoint holds the request it received.
  await waitFor(() => expect(endpoint.sent("session.send")).toHaveLength(1));
  expect(endpoint.sent("session.send")[0]).toEqual({
    images: [FIRST.image, SECOND.image],
    session: "chat-1",
    text: TEXT.trim(),
  });
  expect(draft()).toEqual({ images: [], value: "" });

  // An image added while the send is pending comes after the refused message's own.
  await pick([png("third.png")]);
  await waitFor(() => expect(draft().images.map(({ image }) => image)).toEqual([THIRD.image]));

  answer.reject(refused("The session is archived: unarchive it to send."));
  await settle();

  expect(draft().value).toBe(TEXT.trim());
  expect(draft().images.slice(0, 2)).toEqual([FIRST, SECOND]);
  expect(draft().images.map(({ image }) => image)).toEqual([
    FIRST.image,
    SECOND.image,
    THIRD.image,
  ]);
  expect(thumbnails()).toEqual([
    "Remove first.png — image 1 of 3",
    "Remove second.png — image 2 of 3",
    "Remove third.png — image 3 of 3",
  ]);
  expect(screen.getByText("The session is archived: unarchive it to send.", SHOWN)).toBeTruthy();
});

/** Pastes `files` in the field, as the clipboard gives a screenshot: files, and no text. */
async function paste(files: Array<File>) {
  await act(async () => {
    fireEvent.paste(field(), { clipboardData: { files, getData: () => "" } });
  });
}

/** Drops `files` on the field, as a file manager does. */
async function drop(files: Array<File>) {
  const dataTransfer = { dropEffect: "none", files, getData: () => "", types: ["Files"] };
  await act(async () => {
    fireEvent.dragEnter(field(), { dataTransfer });
    fireEvent.drop(field(), { dataTransfer });
  });
}

// Breaks caught: a paste the editor reads as text, so the image never attaches; a drop on the field
// the editor takes as a text file, which the page's drop target then skips as handled.
test.each([
  ["pasted in", paste],
  ["dropped on", drop],
])("a PNG %s the field attaches to the message, and types nothing", async (_how, give) => {
  await renderComposer(
    { session: "chat-1" },
    { attach: async () => THIRD.image!, sessions: [sessionRecord("chat-1")], value: "Look" },
  );

  await give([png("third.png")]);
  await settle();

  expect(thumbnails()).toEqual(["Remove third.png"]);
  expect(fieldText(field())).toBe("Look");
});

/** Presses Enter in the field, with Shift when `shift`. */
async function enter(shift = false) {
  await act(async () => {
    fireEvent.keyDown(field(), { key: "Enter", shiftKey: shift });
  });
}

/** A session's composer holding "Hi", Enter sending there when `sendsOnEnter`. */
const chat = (sendsOnEnter: boolean) =>
  renderComposer(
    { session: "chat-1", ...(sendsOnEnter ? { sendsOnEnter } : {}) },
    {
      // Refused, so that nothing is left waiting once the test ends.
      mutations: { "session.send": () => Promise.reject(refused("Not now.")) },
      sessions: [sessionRecord("chat-1")],
      value: "Hi",
    },
  );

test("Enter sends a session's message, and Shift+Enter does not", async () => {
  const { endpoint } = await chat(true);

  await enter(true);
  await settle();
  expect(endpoint.sent("session.send")).toHaveLength(0);

  await enter();
  await waitFor(() => expect(endpoint.sent("session.send")).toHaveLength(1));
  expect(endpoint.sent("session.send")[0]).toMatchObject({ session: "chat-1", text: "Hi" });
});

test("Enter sends nothing from a composer that does not send on Enter", async () => {
  const { endpoint } = await chat(false);

  await enter();
  await settle();

  expect(endpoint.sent("session.send")).toHaveLength(0);
});

test("under a finger, Enter adds a line even in a session: its keyboard has no Shift+Enter", async () => {
  const before = window.matchMedia;
  window.matchMedia = ((query: string) => ({
    addEventListener: () => {},
    matches: query === "(pointer: coarse)",
    removeEventListener: () => {},
  })) as unknown as typeof window.matchMedia;
  try {
    const { endpoint } = await chat(true);

    await enter();
    await settle();

    expect(endpoint.sent("session.send")).toHaveLength(0);
  } finally {
    window.matchMedia = before;
  }
});
