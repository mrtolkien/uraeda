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

const startButton = () => screen.getByRole("button", { name: "Start the change" });

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
  expect(screen.getByText("The session is archived: unarchive it to send.")).toBeTruthy();
});

test("a custom send stays pending once, keeps a refused draft, and clears only images on success", async () => {
  const calls: Array<[string, ReadonlyArray<string>]> = [];
  let answer = controlled<boolean>();
  const { draft, endpoint } = await renderComposer(
    {
      onSend: (text, images) => {
        calls.push([text, images.map((image) => image.name)]);
        return answer.promise;
      },
      sendLabel: "Start the change",
    },
    { images: [FIRST], value: "A change" },
  );

  await act(async () => fireEvent.click(startButton()));
  await act(async () => fireEvent.click(startButton()));
  await ctrlEnter();

  expect(calls).toEqual([["A change", ["first.png"]]]);
  expect(draft()).toEqual({ images: [FIRST], value: "A change" });

  await act(async () => answer.resolve(false));
  expect(draft()).toEqual({ images: [FIRST], value: "A change" });

  answer = controlled<boolean>();
  await act(async () => fireEvent.click(startButton()));
  await act(async () => answer.resolve(true));

  expect(calls).toHaveLength(2);
  // The caller owns the text: it clears it once its page is done with it.
  expect(draft()).toEqual({ images: [], value: "A change" });
  expect(endpoint.requests.filter((request) => request.kind === "mutation")).toEqual([]);
});

test("an upload in progress blocks Send and Ctrl+Enter until it is saved", async () => {
  const upload = controlled<{ height: number; id: string; width: number }>();
  const { draft, endpoint } = await renderComposer(
    { session: "chat-1" },
    {
      attach: () => upload.promise,
      mutations: { "session.send": () => sessionRecord("chat-1") },
      sessions: [sessionRecord("chat-1")],
      value: "Look",
    },
  );

  await pick([png("login.png")]);
  await waitFor(() =>
    expect(endpoint.requests).toContainEqual({ kind: "attach", name: "login.png" }),
  );

  expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(true);
  await ctrlEnter();
  // The held upload keeps a request open: wait for the page's next task instead of every answer.
  await act(() => new Promise((resolve) => setTimeout(resolve)));
  expect(endpoint.sent("session.send")).toEqual([]);
  expect(draft().value).toBe("Look");

  await act(async () => upload.resolve(FIRST.image!));
  await waitFor(() =>
    expect(screen.getByRole("button", { name: "Send" }).hasAttribute("disabled")).toBe(false),
  );
  await ctrlEnter();
  await waitFor(() =>
    expect(endpoint.sent("session.send")).toEqual([
      { images: [FIRST.image], session: "chat-1", text: "Look" },
    ]),
  );
});

test("a workflow's message is sent without the draft's images, which stay for the next one", async () => {
  const { draft, endpoint } = await renderComposer(
    { session: "feature-1", workflow: { step: "plan", trigger: "manual" } },
    {
      images: [FIRST, SECOND],
      mutations: { "session.send": () => sessionRecord("feature-1") },
      sessions: [sessionRecord("feature-1")],
      value: "Plan it.",
    },
  );
  expect(
    screen.getByText(
      "The workflow's message takes no images: they stay here for your next message.",
    ),
  ).toBeTruthy();

  await act(async () => fireEvent.click(screen.getByRole("button", { name: /^Start the agent/ })));
  await settle();

  expect(endpoint.sent("session.send")).toEqual([
    { session: "feature-1", text: "Plan it.", workflow: { step: "plan", trigger: "manual" } },
  ]);
  expect(draft()).toEqual({ images: [FIRST, SECOND], value: "" });
});

test("a thumbnail removed while saved stays removed, and its saved file is deleted", async () => {
  const upload = controlled<{ height: number; id: string; width: number }>();
  const { draft, endpoint } = await renderComposer(
    { session: "chat-1" },
    { attach: () => upload.promise, sessions: [sessionRecord("chat-1")] },
  );
  await pick([png("login.png")]);
  await waitFor(() =>
    expect(endpoint.requests).toContainEqual({ kind: "attach", name: "login.png" }),
  );

  await act(async () => fireEvent.click(screen.getByRole("button", { name: "Remove login.png" })));
  await act(async () => upload.resolve(SECOND.image!));
  await settle();

  expect(draft().images).toEqual([]);
  expect(thumbnails()).toEqual([]);
  expect(endpoint.requests).toContainEqual({
    kind: "delete",
    path: `/r/test/chat-images/${SECOND.image!.id}`,
  });
});
