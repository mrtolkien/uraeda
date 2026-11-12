// Run by `nsh test`, without a display: when a list stops following its end, on the scroll events
// GTK sent while a long reply streamed into a session's transcript (ruling R519). Only a real
// platform sends them, so the rules are fed those events here, numbers as measured.
import { expect, test } from "nsh/test";
import { createFollow } from "./follow";

const VIEW = 448;

/** A list that follows from its end, with a clock the test moves and the jumps it asked for. */
function following() {
  let due: (() => void) | undefined;
  const backs: number[] = [];
  const follow = createFollow({
    atEnd: true,
    back: () => backs.push(1),
    later: (_, then) => {
      due = then;
      return () => (due = undefined);
    },
    offset: 0,
  });
  const at = (offset: number, content: number) => follow.scrolled({ content, offset, size: VIEW });
  const passes = () => {
    const then = due;
    due = undefined;
    then?.();
  };
  return { at, backs, follow, passes };
}

test("a reply that grows, its rows measured and clamped by GTK, is followed to the end", () => {
  const { at, backs, follow, passes } = following();
  at(0, 448);
  at(48, 496);
  // A block became a row of its own at its estimated height: GTK pulled the offset back 26 points
  // as the content grew 42 (the walk's `02-chat-07-streaming-2`).
  at(22, 538);
  passes();
  expect(follow.following()).toBe(true);
  expect(backs.length).toBe(1);
  // An offset past the end, pulled back to it.
  at(874, 1226);
  at(778, 1226);
  expect(follow.following()).toBe(true);
  expect(follow.pins()).toBe(true);
});

test("a wheel up that comes to rest away from the end stops following, and the list stays", () => {
  const { at, follow } = following();
  at(1000, 1448);
  at(942, 1460);
  // Let go while the scroll is in doubt: the reply grows under it, and nothing moves it. A slow
  // swipe's moves keep it in doubt longer than one wait.
  expect(follow.pins()).toBe(false);
  at(900, 1470);
  expect(follow.pins()).toBe(false);
  follow.ended();
  expect(follow.following()).toBe(false);
  at(942, 1520);
  expect(follow.following()).toBe(false);
  expect(follow.pins()).toBe(false);
  // Scrolled back down to the end, it follows again.
  at(1072, 1520);
  expect(follow.following()).toBe(true);
  expect(follow.pins()).toBe(true);
});

test("a hand on the list is the reader's at once; a key to another row, and G, are too", () => {
  const { at, follow } = following();
  at(1000, 1448);
  follow.hand(true);
  expect(follow.pins()).toBe(false);
  at(900, 1448);
  expect(follow.following()).toBe(false);
  follow.hand(false);
  follow.follows(true);
  expect(follow.pins()).toBe(true);
  at(1000, 1448);
  follow.follows(false);
  // Pulled back to the end as the content shrank under it, it stays let go.
  at(960, 1408);
  expect(follow.following()).toBe(false);
});
