import type { SetStateAction } from "react";
import type { ChatImage } from "uraeda-server/fate";
import { expect, test } from "vite-plus/test";
import type { DraftImage } from "../attach/chatImages.ts";
import { type Draft, storyCommentsInto, takeBackInto } from "../useDraft.ts";

/** The composer's text after a story's comment line is added to `text`. */
async function withComment(text: string, line: string): Promise<string> {
  let now = text;
  const draft = {
    setText: (next: string | ((before: string) => string)) => {
      now = typeof next === "function" ? next(now) : next;
    },
  } as unknown as Draft;
  await storyCommentsInto(draft, "session").save(undefined as never, line);
  return now;
}

/** US4.3: a comment on a story in the chat goes on a line of its own, with no blank line. */
test("a story's comment ends the composer's text on a line of its own", async () => {
  const line = "Story SidebarHandle.stories.tsx#Dragging: Larger hit area.";
  expect(await withComment("", line)).toBe(line);
  expect(await withComment("Also, the colours.", line)).toBe(`Also, the colours.\n${line}`);
  expect(await withComment("Also, the colours.\n\n  ", line)).toBe(`Also, the colours.\n${line}`);
});

/** An image of a chat message, by the id its test tells it by. */
const chatImage = (id: string) => ({ id }) as unknown as ChatImage;

/** The draft's text and images after `back` and `images` are taken back into it. */
function takenBack(
  now: { images: ReadonlyArray<DraftImage>; text: string },
  back: string,
  images: ReadonlyArray<ChatImage>,
) {
  const state = { images: now.images, text: now.text };
  const draft = {
    setImages: (next: SetStateAction<ReadonlyArray<DraftImage>>) => {
      state.images = typeof next === "function" ? next(state.images) : next;
    },
    setText: (next: SetStateAction<string>) => {
      state.text = typeof next === "function" ? next(state.text) : next;
    },
  } as unknown as Draft;
  takeBackInto(draft)(back, images);
  return state;
}

/** The ids of the chat images a draft holds, in order. */
const idsOf = (images: ReadonlyArray<DraftImage>) =>
  images.map((one) => (one.image as unknown as { id: string }).id);

test.each([
  { back: "Use the existing helper", expected: "Use the existing helper", now: "" },
  { back: "Use the existing helper", expected: "Use the existing helper", now: " \n " },
  {
    back: "Use the existing helper",
    expected: "Use the existing helper\nAlso, the colours.",
    now: "Also, the colours.",
  },
  { back: " \n", expected: "Also, the colours.", now: "Also, the colours." },
  { back: "", expected: "", now: "" },
])("taking back $back before the text $now gives $expected", ({ back, expected, now }) => {
  expect(takenBack({ images: [], text: now }, back, []).text).toBe(expected);
});

test("taken-back images go before the images the draft already holds", () => {
  const typed = [{ image: chatImage("typed"), key: "k", name: "Image" }];

  const { images } = takenBack({ images: typed, text: "" }, "", [chatImage("a"), chatImage("b")]);

  expect(idsOf(images)).toEqual(["a", "b", "typed"]);
});

test("no taken-back image leaves the draft's images as they are", () => {
  const typed = [{ image: chatImage("typed"), key: "k", name: "Image" }];

  expect(takenBack({ images: typed, text: "" }, "Text", []).images).toEqual(typed);
});
