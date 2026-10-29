// An activity row's target: whole when it fits three lines, else cut in its middle around "[...]",
// between words, which shows it whole, its lines kept; with a fold to open, "[...]" opens it.
import { fireEvent, render, within } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { CallTarget } from "../session/CallTarget.tsx";

const SHORT = "git status --short";

/** A command of a script inline, far past three lines of the 40 characters a line guessed. */
const LONG = [
  "python3 - <<'EOF'",
  "import re",
  "s = open('spec.md').read()",
  ...Array.from({ length: 12 }, (_, line) => `s = s.replace('old ${line}', 'new ${line}')`),
  "open('spec.md', 'w').write(s)",
  "EOF",
].join("\n");

test("a short target shows whole, with no mark", () => {
  const { container } = render(<CallTarget label={SHORT} />);
  expect(container.textContent).toBe(SHORT);
  expect(within(container).queryByText("[...]")).toBeNull();
});

test("a long target keeps its start and its end around [...], cut between words", () => {
  const { container } = render(<CallTarget label={LONG} />);
  const shown = container.textContent ?? "";
  expect(shown.startsWith("python3 - <<'EOF' import re")).toBe(true);
  expect(shown.endsWith("open('spec.md', 'w').write(s) EOF")).toBe(true);
  expect(shown).toContain(" [...] ");
  expect(shown.length).toBeLessThan(LONG.length);
  // Neither side ends inside a word: each cut falls at a space or a mark between a command's parts.
  const [head, tail] = shown.split(" [...] ");
  expect(LONG.replaceAll(/\s+/g, " ")).toContain(head);
  expect(LONG.replaceAll(/\s+/g, " ")).toContain(tail);
});

test("[...] shows the target whole, its lines kept", () => {
  const { container } = render(<CallTarget label={LONG} />);
  fireEvent.click(within(container).getByLabelText("Show it whole"));
  expect(within(container).queryByText("[...]")).toBeNull();
  expect(container.textContent).toBe(LONG);
});

test("with a fold to open, [...] opens it rather than showing it in place", () => {
  const onWhole = vi.fn();
  const { container } = render(<CallTarget label={LONG} onWhole={onWhole} />);
  fireEvent.click(within(container).getByLabelText("Show it whole"));
  expect(onWhole).toHaveBeenCalledTimes(1);
  expect(within(container).getByText("[...]")).toBeTruthy();
});
