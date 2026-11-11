// The keys that cross into a session's column (`layout/columnKeys.ts`): `l` enters it, unfolding it
// first, `h` gives the focus back, `j` `k` move through its stops, whatever its rows are, and reach
// its tabs, where `h` `l` open the previous and the next one. On a bare registry, with the column a
// session's page draws, its keys pressed on the focused element as a user's reach the window.
import { Button } from "@astryxdesign/core/Button";
import { act, cleanup, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, expect, test } from "vite-plus/test";
import { KeysProvider, useHints } from "../keys/registry.tsx";
import { ScrollKeys } from "../keys/scroll.ts";
import { type ColumnPanel, DocumentColumn } from "../layout/DocumentColumn.tsx";
import { useSessionColumnWidth } from "../layout/documentColumnWidth.ts";
import { atWidth } from "./helpers.tsx";

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
  window.history.replaceState(null, "", "/");
});

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** Presses a key where the focus is, as a user's reaches the window. */
const press = (key: string) =>
  act(() => void fireEvent.keyDown(document.activeElement ?? document.body, { key }));

/** The focused element's name: its text, or its label. */
const focused = () => {
  const active = document.activeElement;
  return active === document.body
    ? "the page"
    : (active?.getAttribute("aria-label") ?? active?.textContent);
};

const PANELS: ReadonlyArray<ColumnPanel> = [
  {
    content: (
      <>
        <p>Calls</p>
        <Button label="First call" />
        <a href="/second">Second call</a>
        <Button isDisabled label="Off" />
      </>
    ),
    icon: "uraeda:activity",
    key: "activity",
    label: "Activity",
  },
  {
    content: (
      <section aria-label="The agents" tabIndex={0}>
        <a href="/agent">An agent</a>
      </section>
    ),
    icon: "uraeda:users",
    key: "subagents",
    label: "Sub-agents",
  },
  {
    content: (
      <section aria-label="The log" tabIndex={0}>
        Lines
      </section>
    ),
    icon: "uraeda:git-compare",
    key: "log",
    label: "Log",
  },
];

/** The status line's hints, as text. */
function Hints() {
  return <output>{useHints().map((hint) => `${hint.keys} ${hint.label}`)}</output>;
}

/** A session's page: a button and a field, with the session's column beside them. */
function Page() {
  return (
    <DocumentColumn
      column={useSessionColumnWidth()}
      content={
        <>
          <Button label="In the page" />
          <div
            aria-label="Message"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
            tabIndex={0}
          />
        </>
      }
      footer={<a href="/plan">The plan</a>}
      hasKeys
      isBeside
      label="The session's column"
      panels={PANELS}
    />
  );
}

const show = () =>
  render(
    <KeysProvider>
      <ScrollKeys />
      <Page />
      <Hints />
    </KeysProvider>,
  );

test("`l` enters the column at its first row, `j` `k` move through its rows, and `h` gives the focus back", () => {
  show();
  screen.getByRole("button", { name: "In the page" }).focus();
  press("l");
  expect(focused()).toBe("First call");
  press("j");
  expect(focused()).toBe("Second call");
  // A button that is off is no stop: the foot's link is the next.
  press("ArrowDown");
  expect(focused()).toBe("The plan");
  press("j");
  expect(focused()).toBe("The plan");
  press("k");
  press("ArrowUp");
  expect(focused()).toBe("First call");
  press("h");
  expect(focused()).toBe("In the page");
  // From the page itself, the arrows do the same, and `h` leaves no focus behind.
  (document.activeElement as HTMLElement).blur();
  press("ArrowRight");
  expect(focused()).toBe("First call");
  press("ArrowLeft");
  expect(focused()).toBe("the page");
});

test("`h` in the page, and the keys in a text field, are not the column's", () => {
  show();
  const field = screen.getByRole("textbox", { name: "Message" });
  field.focus();
  press("l");
  expect(document.activeElement).toBe(field);
  screen.getByRole("button", { name: "In the page" }).focus();
  press("h");
  press("j");
  expect(focused()).toBe("In the page");
});

test("`l` unfolds a folded column, and enters it", () => {
  show();
  act(() => screen.getByRole("button", { name: "Hide the session's column" }).click());
  expect(screen.queryByRole("tab", { name: "Activity" })).toBeNull();
  press("l");
  expect(screen.getByRole("tab", { name: "Activity" })).toBeTruthy();
  expect(focused()).toBe("First call");
});

test("`k` past the first row reaches the tabs, where `l` and `h` open the next and the previous", () => {
  show();
  press("l");
  press("k");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Activity" }));
  press("l");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Sub-agents" }));
  expect(window.location.search).toBe("?tab=subagents");
  // A part that holds rows is no stop: its first row is.
  press("j");
  expect(focused()).toBe("An agent");
  press("k");
  press("l");
  expect(window.location.search).toBe("?tab=log");
  // The last tab has none after it; a part with no row is a stop itself.
  press("l");
  expect(window.location.search).toBe("?tab=log");
  press("j");
  expect(focused()).toBe("The log");
  press("k");
  press("h");
  press("h");
  expect(document.activeElement).toBe(screen.getByRole("tab", { name: "Activity" }));
  expect(window.location.search).toBe("?tab=activity");
  // Past the first tab, `h` is back to the page.
  press("h");
  expect(focused()).toBe("the page");
});

test("the status line names `h l column`, and the phone, with no column, has no such keys", () => {
  const { container, unmount } = show();
  expect(container.querySelector("output")?.textContent).toContain("h l column");
  unmount();
  atWidth(402);
  const phone = show();
  expect(phone.container.querySelector("output")?.textContent).not.toContain("h l");
  screen.getByRole("button", { name: "In the page" }).focus();
  press("l");
  expect(focused()).toBe("In the page");
});
