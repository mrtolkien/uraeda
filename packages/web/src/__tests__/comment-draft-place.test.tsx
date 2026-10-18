// The last tapped block keeps its place on screen as the comment form leaves it: closing the
// comment, or starting another, puts the block back where it was read.
import { act, renderHook } from "@testing-library/react";
import type { Block } from "uraeda-binding";
import { afterEach, beforeEach, expect, test, vi } from "vite-plus/test";
import { frame } from "../keepPlace.ts";
import { useCommentDraft } from "../useCommentDraft.ts";

/** The tapped block's top on screen, in px, which the tests move as the page's layout would. */
let top = 0;

/** A block drawn at `top`, on screen. */
function drawn() {
  const element = document.createElement("div");
  element.getBoundingClientRect = () => ({ bottom: top + 20, top }) as DOMRect;
  document.body.append(element);
  return element;
}

const block = { endLine: 3, heading: "Story", id: 1, startLine: 3 } as unknown as Block;

beforeEach(() => {
  top = 100;
  vi.spyOn(window, "scrollBy").mockImplementation((() => undefined) as typeof window.scrollBy);
});

afterEach(() => {
  vi.restoreAllMocks();
  document.body.replaceChildren();
});

/** Two frames, which a kept place waits for, then what follows them. */
async function settle() {
  await act(async () => {
    await frame();
    await frame();
    await Promise.resolve();
  });
}

const scrolled = () => vi.mocked(window.scrollBy).mock.calls.map(([options]) => options);

/** US7 1 of the spec redesign: the block keeps its place as the form closes under it. */
test("closing the comment scrolls the tapped block back to where it was", async () => {
  const { result } = renderHook(() => useCommentDraft(true, () => undefined));
  act(() => result.current.tap(block, drawn()));
  await settle();
  expect(scrolled()).toEqual([]);

  act(() => result.current.close());
  // The page moves the block 60 px down as the form goes.
  top = 160;
  await settle();

  expect(scrolled()).toEqual([{ behavior: "instant", top: 60 }]);
});

test("starting a general comment while a block is tapped keeps that block in place too", async () => {
  const { result } = renderHook(() => useCommentDraft(true, () => undefined));
  act(() => result.current.tap(block, drawn()));
  await settle();

  act(() => result.current.start({ kind: "general" }));
  top = 70;
  await settle();

  expect(scrolled()).toEqual([{ behavior: "instant", top: -30 }]);
});
