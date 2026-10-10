// TEMPORARY: replaced by the web UI feature.
import { mkdirSync, mkdtempSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { fixture, renderPage } from "./helpers.tsx";

test("lists folders newest first", async () => {
  await renderPage();

  const headings = await screen.findAllByRole("heading", { level: 2 });
  expect(headings.map((heading) => heading.textContent)).toEqual([
    "2026-13-99-not-a-date",
    "2026-10-12-keyboard-shortcuts",
    "2026-10-10-stack-decision",
    "2026-10-06-recurring-tasks",
  ]);
});

test("shows an invalid file", async () => {
  await renderPage();

  expect(await screen.findByText('Invalid: unknown status "done"')).toBeTruthy();
});

test("shows a folder without workflow files", async () => {
  await renderPage();

  expect(await screen.findByText("No workflow files yet")).toBeTruthy();
});

test("shows the empty state", async () => {
  await renderPage(fixture("no-features/specs"));

  expect(await screen.findByText("No feature folders in specs/")).toBeTruthy();
});

test("shows when the server cannot be reached", async () => {
  await renderPage(fixture("specs"), () => Promise.reject(new TypeError("Failed to fetch")));

  expect(await screen.findByText("Could not reach the Uraeda server.")).toBeTruthy();
});

test("lists more folders than fate's default page", async () => {
  const specs = mkdtempSync(join(tmpdir(), "uraeda-"));
  for (let day = 1; day <= 25; day++) {
    mkdirSync(join(specs, `2026-10-${String(day).padStart(2, "0")}-feature`));
  }

  await renderPage(specs);

  expect(await screen.findAllByRole("heading", { level: 2 })).toHaveLength(25);
});
