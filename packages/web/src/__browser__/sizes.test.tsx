// US6 scenarios 1 and 2: text and controls follow the width, from the theme's tokens.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { atSize, show } from "./helpers.tsx";

// The phone's 17 px text is the layout checks' `checkTextSizes`, at each size.
atSize("desktop");

test("text and controls follow the width (US6 1, 2)", async () => {
  await show("/priorities", "Git listener process");
  const paragraph = Number.parseFloat(
    getComputedStyle(document.body).getPropertyValue("--text-reading-size"),
  );
  const button = screen.getAllByRole("button")[0]!.getBoundingClientRect().height;
  expect(paragraph).toBe(19);
  expect(button).toBeGreaterThanOrEqual(38);
});
