// The titled pane that folds, as the round's Today and Under the hood do: its title is a button that
// tells whether it is open, and folded, its content is not mounted, as the UI behaviour decision
// asks; a line in its body can open it too.
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
