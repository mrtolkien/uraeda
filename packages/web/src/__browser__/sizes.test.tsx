// US6 scenarios 1 and 2: text and controls follow the width, from the theme's tokens.
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { show } from "./helpers.tsx";

test("text and controls follow the width (US6 1, 2)", async () => {
  await show("/priorities", "Git listener process");
  const paragraph = parseFloat(
    getComputedStyle(document.body).getPropertyValue("--text-reading-size"),
  );
  const button = screen.getAllByRole("button")[0]!.getBoundingClientRect().height;
  if (window.innerWidth >= 1024) {
    expect(paragraph).toBe(19);
    expect(button).toBeGreaterThanOrEqual(38);
  } else {
    expect(paragraph).toBe(17);
  }
});
