import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { renderPage, sent } from "./helpers.tsx";

/** US7.1, SC-007 */
test("a missing file says so at once", async () => {
  await renderPage("/f/2026-10-11-web-ui/spec.md");

  expect(await screen.findByText("No file spec.md in 2026-10-11-web-ui.")).toBeTruthy();
  expect(screen.getByRole("link", { name: "Open the feature" })).toBeTruthy();
  expect(
    sent.filter((body) => body.includes("2026-10-11-web-ui/spec.md")).length,
  ).toBeLessThanOrEqual(2);
});

/** US7.1, SC-007, final review: a folder that is not a feature's settles the same way. */
test("a file of an unknown folder says so at once", async () => {
  await renderPage("/f/2026-10-11-nope/spec.md");

  expect(await screen.findByText("No file spec.md in 2026-10-11-nope.")).toBeTruthy();
  expect(
    sent.filter((body) => body.includes("2026-10-11-nope/spec.md")).length,
  ).toBeLessThanOrEqual(2);
});

/** Final review: the page of an unknown folder settles too. */
test("an unknown folder's page says so at once", async () => {
  await renderPage("/f/2026-10-11-nope");

  expect(await screen.findByText(/No feature 2026-10-11-nope/)).toBeTruthy();
  expect(sent.filter((body) => body.includes("2026-10-11-nope")).length).toBeLessThanOrEqual(2);
});
