// The theme picker, `Space u t` (US2): the app is drawn in the theme under the cursor, Escape puts
// back the theme in use, and a theme of the other mode picked with Enter becomes that mode's theme,
// the mode switching to it. The themes are the shipped ones, which the tests' server reads.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, quiet, renderPage } from "./helpers.tsx";

/** The published pages of Catppuccin Mocha and Nord, `base` and `nord0`. */
const MOCHA_PAGE = "#1e1e2e";
const NORD_PAGE = "#2e3440";

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
});

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The page's colour the palette rule's dark block sets. */
function darkPage() {
  const rule = document.getElementById("uraeda-palette")?.textContent ?? "";
  const dark = /\[data-theme="dark"\] \{([^}]*)\}/.exec(rule)?.[1] ?? "";
  return /--color-background-body: (#[\da-f]+);/i.exec(dark)?.[1];
}

/** The home in dark mode, its themes served, and the picker opened by `Space u t`. */
async function openPicker() {
  window.localStorage.setItem("uraeda.theme", "dark");
  await renderPage("/");
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
  await waitFor(() => expect(darkPage()).toBe(MOCHA_PAGE));
  press(" ");
  press("u");
  press("t");
  const field = await screen.findByRole("combobox", { name: "Find a theme" });
  await waitFor(() => expect(screen.getAllByRole("option").length).toBeGreaterThan(20));
  return field;
}

/** Moves the cursor down until its row is the theme `name`. */
async function moveTo(field: HTMLElement, name: string) {
  for (let step = 0; step < 40; step += 1) {
    // The row under the cursor, which the field names, as a combobox does.
    const active = field.getAttribute("aria-activedescendant");
    const cursor = active ? document.getElementById(active) : null;
    if (cursor && within(cursor).queryByText(name, { exact: true })) {
      return;
    }
    await act(async () => void fireEvent.keyDown(field, { key: "ArrowDown" }));
  }
  throw new Error(`The cursor never reached ${name}.`);
}

// Breaks: the preview kept after closing.
test("Escape puts back the theme in use", async () => {
  const field = await openPicker();

  await moveTo(field, "Nord");
  await waitFor(() => expect(darkPage()).toBe(NORD_PAGE));

  await act(async () => void fireEvent.keyDown(field, { key: "Escape" }));
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Find a theme" })).toBeNull());
  await waitFor(() => expect(darkPage()).toBe(MOCHA_PAGE));
  expect(window.localStorage.getItem("uraeda.theme.dark")).toBeNull();
});

// Breaks: the dark pick overwritten.
test("a light theme picked in dark mode becomes the light theme, in Light mode", async () => {
  const field = await openPicker();

  await moveTo(field, "Rosé Pine Dawn");
  await act(async () => void fireEvent.keyDown(field, { key: "Enter" }));

  await waitFor(() =>
    expect(window.localStorage.getItem("uraeda.theme.light")).toBe("rose-pine-dawn"),
  );
  expect(window.localStorage.getItem("uraeda.theme")).toBe("light");
  expect(window.localStorage.getItem("uraeda.theme.dark")).toBeNull();
  await waitFor(() => expect(screen.queryByRole("combobox", { name: "Find a theme" })).toBeNull());
});
