// A diagram is laid out with the fonts it is drawn in: Pele measures its labels with the page's
// `--pele-font` and `--pele-font-mono`, so a label never runs into the next one or past the
// diagram's edge, as it did with Pele's own metrics under the theme's wider monospace font.
import { render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { Diagram } from "../Diagram.tsx";

const renderAsync = vi.hoisted(() =>
  vi.fn(async () => ({
    height: 20,
    svg: "<svg></svg>",
    type: "flowchart",
    width: 40,
  })),
);

vi.mock("pele/lazy", () => ({ renderAsync }));

/** The theme's fonts, as the page resolves them: happy-dom resolves no theme's custom property. */
const FONTS: Record<string, string> = { "--pele-font": "Reading", "--pele-font-mono": "Code" };

// Break: call `renderAsync` without `fontFamily` and `fontFamilyMono`.
test("a diagram is measured in the fonts the page draws it in", async () => {
  const computed = window.getComputedStyle.bind(window);
  vi.spyOn(window, "getComputedStyle").mockImplementation((element) => {
    const style = computed(element);
    const read = style.getPropertyValue.bind(style);
    style.getPropertyValue = (name: string) => FONTS[name] ?? read(name);
    return style;
  });
  render(<Diagram source={"flowchart LR\n  a --> b"} />);

  await screen.findByRole("group", { name: "Flowchart diagram" });
  expect(renderAsync).toHaveBeenCalledWith(
    "flowchart LR\n  a --> b",
    expect.objectContaining({ fontFamily: "Reading", fontFamilyMono: "Code" }),
  );
});
