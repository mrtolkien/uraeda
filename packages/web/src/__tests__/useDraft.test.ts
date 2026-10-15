import { expect, test } from "vite-plus/test";
import { type Draft, storyCommentsInto } from "../useDraft.ts";

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
