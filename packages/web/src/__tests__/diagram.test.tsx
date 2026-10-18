// The diagrams' error handling: a `pele` that fails to load, as offline, shows the diagram's source
// as code under "This diagram could not be drawn.", as a source that does not parse does.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";

vi.mock("pele/lazy", () => {
  throw new Error("Failed to fetch dynamically imported module");
});

test("a pele that fails to load shows the source under the line", async () => {
  render(<Diagram source={"flowchart LR\n  a --> b"} />);
  const line = await screen.findByText("This diagram could not be drawn.");
  expect(line.closest("div")!.querySelector("pre")?.textContent).toContain("a --> b");
  expect(screen.queryByText("Drawing the diagram…")).toBeNull();
});
