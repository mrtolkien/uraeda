import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { renderPage, sent } from "./helpers.tsx";

/** US7.1, SC-007 */
test("a missing file says so at once", async () => {
  sent.length = 0;
  await renderPage("/f/2026-10-11-web-ui/spec.md");

  expect(
    await screen.findByText("No file spec.md in 2026-10-11-web-ui.", {}, { timeout: 2000 }),
  ).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the feature" })).toBeTruthy();
  expect(
    sent.filter((body) => body.includes("2026-10-11-web-ui/spec.md")).length,
  ).toBeLessThanOrEqual(2);
});
