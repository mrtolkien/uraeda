// The sandbox's bar, mockups of the UI sandbox's picker: the marker and the pick toggle at rest,
// pick mode on, a pick copied, a copy the browser refused, which shows the pick's text to select by
// hand, and the bar hidden but its marker.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { type PickStatus, SandboxBar } from "./SandboxBar.tsx";

/** What a pick of the round page's submit button copies. */
const PICK = `Sandbox pick: http://127.0.0.1:4410/r/sample/f/2026-10-11-web-ui/round
Element: button “Submit answers”
Source: packages/web/src/RoundSubmit.tsx:215:11
Text: Submit answers
HTML: <button type="submit" class="x1n2onr6 x9f619">Submit answers</button>
Viewport: 1440 × 900, dark`;

function Bar({ last, picking, shown }: { last: PickStatus; picking: boolean; shown?: boolean }) {
  return <SandboxBar last={last} onPickingChange={() => {}} picking={picking} shown={shown} />;
}

const meta = {
  component: Bar,
  parameters: { layout: "fullscreen" },
  title: "Sandbox/Bar",
} satisfies Meta<typeof Bar>;

export default meta;

type Story = StoryObj<typeof meta>;

/** At rest: the marker, and the toggle off. */
export const Idle: Story = { args: { last: { kind: "idle" }, picking: false } };

/** Pick mode on: the hint, until a click or Escape. */
export const Picking: Story = { args: { last: { kind: "idle" }, picking: true } };

/** A pick copied: pick mode stops, and the line names the element. */
export const Copied: Story = {
  args: { last: { element: "button “Submit answers”", kind: "copied" }, picking: false },
};

/** The browser refused the clipboard: the pick's text, to select and copy by hand. */
export const CopyFailed: Story = { args: { last: { kind: "failed", text: PICK }, picking: false } };

/** Hidden by its marker, which shows it again: the page's corner is free, and picks still copy. */
export const Collapsed: Story = { args: { last: { kind: "idle" }, picking: false, shown: false } };
