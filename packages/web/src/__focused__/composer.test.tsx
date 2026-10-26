import { act, fireEvent, screen, waitFor } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  controlled,
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
