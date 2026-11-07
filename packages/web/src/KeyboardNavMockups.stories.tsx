// Mockups of the keyboard cursor (specs/2026-11-07-keyboard-nav), as the spec approved them, kept
// frozen: the real spec and round pages, with the cursor drawn where the keys would put it, a
// list's picked look and the keys of what it holds under it. They were drawn before the cursor
// existed, and paint its look by hand; the real cursor is in `cursor/`. The block's range and the
// picked option are the pages' own states.
import * as stylex from "@stylexjs/stylex";
import { Button } from "@astryxdesign/core/Button";
import type { Meta, StoryObj } from "@storybook/react-vite";
import { createElement, useEffect, useState } from "react";
import { createPortal } from "react-dom";
import { userEvent, within } from "storybook/test";
import { QUESTIONS_PAGES, SPEC_PAGES } from "../.storybook/checkouts.ts";
import { inRepositoryFolder } from "../.storybook/inRepositoryFolder.tsx";
import { FilePage } from "./FilePage.tsx";
import { KeyCap } from "./keys/KeyCap.tsx";
import { pickedStyles } from "./layout/picked.ts";
import { useTimedToast } from "./layout/useTimedToast.tsx";
import { type BarAction, RowBar } from "./lists/RowBar.tsx";
import { CommentNote } from "./ReviewComments.tsx";

/** How long a mockup's toast stays: long enough to review it, where the app's stays 5 seconds. */
const REVIEW_MS = 600_000;

const nothing = () => undefined;

/** The classes of a stylex style, to put on an element the page drew. */
const classesOf = (style: stylex.StyleXStyles) =>
  (stylex.props(style).className ?? "").split(" ").filter(Boolean);

/** The keys under the cursor, as a list's selected row shows them. */
const keysOf = (pairs: ReadonlyArray<[string, string]>): Array<BarAction> =>
  pairs.map(([keys, label]) => ({ keys, label, run: nothing }));

/**
 * The first element `selector` matches whose text holds `text`, once the page has drawn it, and a
 * slot right after it, for what the cursor shows under it.
 */
function useTarget(selector: string, text: string, isInside = false) {
  const [found, setFound] = useState<{ slot: HTMLElement; target: HTMLElement }>();
  useEffect(() => {
    let slot: HTMLElement | undefined;
    const timer = window.setInterval(() => {
      const target = [...document.querySelectorAll<HTMLElement>(selector)].find((element) =>
        element.textContent?.includes(text),
      );
      if (target) {
        window.clearInterval(timer);
        slot = document.createElement("div");
        if (isInside) {
          target.append(slot);
        } else {
          target.after(slot);
        }
        setFound({ slot, target });
      }
    }, 100);
    return () => {
      window.clearInterval(timer);
      slot?.remove();
    };
  }, [isInside, selector, text]);
  return found;
}

/**
 * The cursor on the element `selector` matches whose text holds `text`: the picked look on a block,
 * the ring on a whole pane, `isPane`, and `keys` under it, inside a pane.
 */
function Cursor({
  isPane = false,
  keys,
  selector,
  text,
}: {
  isPane?: boolean;
  keys: ReadonlyArray<[string, string]>;
  selector: string;
  text: string;
}) {
  const found = useTarget(selector, text, isPane);
  useEffect(() => {
    if (!found) {
      return;
    }
    const { target } = found;
    const classes = classesOf(isPane ? pickedStyles.pane : pickedStyles.picked);
    target.classList.add(...classes);
    target.scrollIntoView({ block: isPane ? "start" : "center" });
    return () => target.classList.remove(...classes);
  }, [found, isPane]);
  return found ? createPortal(<RowBar actions={keysOf(keys)} />, found.slot) : null;
}

/** A pending comment under `text`'s block, the cursor on it, with its keys. */
function CommentCursor({ text }: { text: string }) {
  const found = useTarget("[data-lines]", text);
  const [note, setNote] = useState<HTMLElement>();
  useEffect(() => {
    if (!note) {
      return;
    }
    note.classList.add(...classesOf(pickedStyles.picked));
    note.scrollIntoView({ block: "center" });
  }, [note]);
  return found
    ? createPortal(
        <>
          <div ref={(element) => setNote(element?.firstElementChild as HTMLElement | undefined)}>
            <CommentNote
              label="Lines 51–52, under “US1: Make a task repeat (P1)”"
              name="Your comment on lines 51–52"
              text="Add “weekends” next to “weekdays”: I water the garden on weekends."
            />
          </div>
          <RowBar
            actions={keysOf([
              ["⏎", "edit"],
              ["d", "delete"],
            ])}
          />
        </>,
        found.slot,
      )
    : null;
}

/** The toast `d` shows once it removed a pending comment, with its Undo. */
function RemovedToast() {
  const showToast = useTimedToast();
  useEffect(() => {
    showToast({
      autoHideDuration: REVIEW_MS,
      body: "Removed your comment on lines 51–52",
      endContent: createElement(Button, {
        endContent: createElement(KeyCap, null, "u"),
        label: "Undo",
        variant: "ghost",
      }),
    });
    // oxlint-disable-next-line react-hooks/exhaustive-deps -- once, as `d` shows it
  }, []);
  return null;
}

const meta = {
  args: { folder: SPEC_PAGES.waiting, name: "spec.md" },
  component: FilePage,
  decorators: [inRepositoryFolder],
  parameters: { layout: "fullscreen" },
  title: "Mockups/Keyboard nav",
} satisfies Meta<typeof FilePage>;

export default meta;

type Story = StoryObj<typeof meta>;

/** The spec's review, the cursor on US1's opening paragraph, its keys under it. */
export const ReviewCursor: Story = {
  render: (args) => (
    <>
      <FilePage {...args} />
      <Cursor
        keys={[
          ["⏎", "comment"],
          ["J K", "range"],
          ["s", "ask"],
        ]}
        selector="[data-lines]"
        text="In a task's edit panel, a repeat menu offers"
      />
    </>
  ),
};

/**
 * `J` on US2's first key scenario: the comment's range covers both scenarios, in the review's
 * yellow, the cursor on the second, and Enter opens the comment field under it.
 */
export const ReviewRange: Story = {
  play: async ({ canvasElement }) => {
    const page = within(canvasElement);
    await userEvent.click(await page.findByText(/the user completes it on Thursday the 8th/));
    await userEvent.click(await page.findByText(/the user taps undo within 5/));
  },
  render: (args) => (
    <>
      <FilePage {...args} />
      <Cursor
        keys={[
          ["J K", "stretch"],
          ["⏎", "comment"],
          ["esc", "drop"],
        ]}
        selector="[data-lines]"
        text="the user taps undo within 5"
      />
    </>
  ),
};

/** The cursor on a pending comment, under its block: Enter edits it, `d` deletes it at once. */
export const CommentRow: Story = {
  render: (args) => (
    <>
      <FilePage {...args} />
      <CommentCursor text="In a task's edit panel, a repeat menu offers" />
    </>
  ),
};

/** `d` on that comment: it goes, and the toast says so, which `u` takes back. */
export const CommentDeleted: Story = {
  render: (args) => (
    <>
      <FilePage {...args} />
      <RemovedToast />
    </>
  ),
};

/**
 * The round, the cursor on Q2, answered A: its letters pick, a second `a` unpicks, and its keys
 * show under the card.
 */
export const RoundCursor: Story = {
  args: { folder: QUESTIONS_PAGES.waiting, name: "clarifications-01.md" },
  render: (args) => (
    <>
      <FilePage {...args} />
      <Cursor
        isPane
        keys={[
          ["a b", "pick"],
          ["i", "comment"],
          ["s", "ask"],
          ["n", "unanswered"],
        ]}
        selector="section#Q2 > *"
        text="Where does a new chat work?"
      />
    </>
  ),
};

/** The cursor on a settled point: Enter comments on it, as on a review's block. */
export const SettledCursor: Story = {
  args: { folder: QUESTIONS_PAGES.waiting, name: "clarifications-01.md" },
  render: (args) => (
    <>
      <FilePage {...args} />
      <Cursor
        keys={[
          ["⏎", "comment"],
          ["s", "ask"],
        ]}
        selector="[data-lines]"
        text="loses rename and archive, like every change"
      />
    </>
  ),
};
