// The titled pane that folds, as the round's Today and Under the hood do: its title is a button that
// tells whether it is open, and folded, its content is not mounted, as the UI behaviour decision
// asks; a line in its body can open it too.
import { Button } from "@astryxdesign/core/Button";
import { render, screen, within } from "@testing-library/react";
import { useState } from "react";
import { expect, test } from "vite-plus/test";
import { Pane } from "../layout/Pane.tsx";
import { click } from "./helpers.tsx";

/** A pane folded at first, holding a paragraph, with a line to open it when `folded` is given. */
function Folding({ folded }: { folded?: string }) {
  const [isOpen, setOpen] = useState(false);
  return (
    <Pane fold={{ folded, isOpen, onOpenChange: setOpen }} title="Today">
      <p>Every human step happens in a text editor.</p>
    </Pane>
  );
}

test("a folded pane is named by its title, and its content is not mounted", async () => {
  render(<Folding />);

  const title = screen.getByRole("button", { name: "Today" });
  expect(title.getAttribute("aria-expanded")).toBe("false");
  expect(screen.queryByText("Every human step happens in a text editor.")).toBeNull();
  expect(screen.getByRole("region", { name: "Today" })).toBeTruthy();

  await click(title);

  expect(title.getAttribute("aria-expanded")).toBe("true");
  expect(screen.getByText("Every human step happens in a text editor.")).toBeTruthy();

  await click(title);

  expect(screen.queryByText("Every human step happens in a text editor.")).toBeNull();
});

test("a folded pane's line opens it", async () => {
  render(<Folding folded="3 choices in the code only" />);
  const pane = within(screen.getByRole("region", { name: "Today" }));

  await click(pane.getByRole("button", { name: "3 choices in the code only" }));

  expect(pane.getByRole("button", { name: "Today" }).getAttribute("aria-expanded")).toBe("true");
  expect(pane.getByText("Every human step happens in a text editor.")).toBeTruthy();
  expect(pane.queryByRole("button", { name: "3 choices in the code only" })).toBeNull();
});

test("a folding pane's chevron comes before its title, as the app's other folds draw it", () => {
  render(<Folding />);

  const title = screen.getByRole("button", { name: "Today" });
  const chevron = title.querySelector("svg")!;
  const name = within(title).getByText("Today");
  expect(chevron.compareDocumentPosition(name) & Node.DOCUMENT_POSITION_FOLLOWING).toBeTruthy();
});

test("a folding pane's button is named by its title and its count, as it shows them", () => {
  render(
    <Pane count={3} fold={{ isOpen: false, onOpenChange: () => {} }} title="Under the hood">
      <p>Inside.</p>
    </Pane>,
  );

  expect(screen.getByRole("button", { name: "Under the hood · 3" })).toBeTruthy();
  // The pane itself is named by its title alone.
  expect(screen.getByRole("region", { name: "Under the hood" })).toBeTruthy();
});

test("a pane's actions sit in its border, and its region is named by its title alone", async () => {
  let isFull = false;
  render(
    <Pane
      actions={<Button label="Full screen" onClick={() => (isFull = true)} />}
      title="live · today"
      tone="live"
    >
      <p>Inside.</p>
    </Pane>,
  );
  const pane = within(screen.getByRole("region", { name: "live · today" }));

  await click(pane.getByRole("button", { name: "Full screen" }));

  expect(isFull).toBe(true);
});

test("a pane's suffix reads after its title, outside the region's name", () => {
  render(
    <Pane title="live · today" titleSuffix="· 1440 × 900 · 49%" tone="live">
      <p>Inside.</p>
    </Pane>,
  );

  const pane = screen.getByRole("region", { name: "live · today" });
  const heading = within(pane).getByRole("heading");
  expect(heading.textContent).toBe("live · today· 1440 × 900 · 49%");
});
