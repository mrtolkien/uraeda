// The theme picker, `Space u t` (US2): the app is drawn in the theme under the cursor, Escape puts
// back the theme in use, and a theme of the other mode picked with Enter becomes that mode's theme,
// the mode switching to it. The themes are the shipped ones, which the tests' server reads.
import { act, fireEvent, screen, waitFor, within } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { atWidth, quiet, renderPage } from "./helpers.tsx";

/** The published pages of Catppuccin Mocha and Latte and of Nord, `base` and `nord0`. */
const MOCHA_PAGE = "#1e1e2e";
const LATTE_PAGE = "#eff1f5";
const NORD_PAGE = "#2e3440";

beforeEach(() => {
  atWidth(1440);
  window.localStorage.clear();
});

const press = (key: string) => fireEvent.keyDown(document.body, { key });

/** The page's colour the palette rule's block of `mode` sets. */
function page(mode: "dark" | "light") {
  const rule = document.getElementById("uraeda-palette")?.textContent ?? "";
  const block = new RegExp(`\\[data-theme="${mode}"\\] \\{([^}]*)\\}`).exec(rule)?.[1] ?? "";
  return /--color-background-body: (#[\da-f]+);/i.exec(block)?.[1];
}

const darkPage = () => page("dark");

/** The row under the cursor, which the field names, as a combobox does. */
function cursorRow(field: HTMLElement) {
  const active = field.getAttribute("aria-activedescendant");
  return active ? document.getElementById(active) : null;
}

/** The home in `mode`, dark by default, its themes served, and the picker opened by `Space u t`. */
async function openPicker(mode: "dark" | "light" = "dark") {
  window.localStorage.setItem("uraeda.theme", mode);
  await renderPage("/");
  await screen.findByRole("navigation", { name: "Navigation" });
  await quiet();
  await waitFor(() => expect(page(mode)).toBe(mode === "dark" ? MOCHA_PAGE : LATTE_PAGE));
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
    const cursor = cursorRow(field);
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

// Breaks: the cursor starting on the first row, Catppuccin Mocha, a dark theme (R20).
test("opened in light mode, the cursor starts on the theme in use, and the page stays light", async () => {
  const field = await openPicker("light");

  await waitFor(() => expect(cursorRow(field)).not.toBeNull());
  expect(within(cursorRow(field)!).getByText("Catppuccin Latte", { exact: true })).toBeTruthy();
  expect(page("light")).toBe(LATTE_PAGE);
  expect(document.documentElement.dataset.theme).toBe("light");
});

// Breaks: the layer left open without the focus, every page key dropped and Escape out of reach.
test("the focus leaving the list for the page, as Tab moves it, closes it and puts back the theme in use", async () => {
  const field = await openPicker();
  await moveTo(field, "Nord");
  await waitFor(() => expect(darkPage()).toBe(NORD_PAGE));

  // The focus in the field, as the picker puts it, then on the page's first link.
  await act(async () => field.focus());
  expect(screen.getByRole("dialog", { name: "Theme" }).contains(document.activeElement)).toBe(true);
  const navigation = screen.getByRole("navigation", { name: "Navigation" });
  await act(async () => within(navigation).getAllByRole("link")[0].focus());

  await waitFor(() => expect(screen.queryByRole("dialog", { name: "Theme" })).toBeNull());
  await waitFor(() => expect(darkPage()).toBe(MOCHA_PAGE));
  expect(window.localStorage.getItem("uraeda.theme.dark")).toBeNull();
});

// Breaks: the faded list woken by a pointer move alone, at 10% under a letter typed or a tap.
test("a letter wakes the faded list, and so does a press in it", async () => {
  const field = await openPicker();
  const layer = screen.getByRole("dialog", { name: "Theme" });
  const opacity = () => Number(getComputedStyle(layer).opacity);
  const faded = () => expect(opacity()).toBe(0.1);

  await waitFor(faded, { timeout: 3000 });
  await act(async () => void fireEvent.keyDown(field, { key: "n" }));
  expect(opacity()).not.toBe(0.1);

  await waitFor(faded, { timeout: 3000 });
  await act(async () => void fireEvent.pointerDown(screen.getAllByRole("option")[0]));
  expect(opacity()).not.toBe(0.1);
});

/** The page colour of `mode` in the drawn cache the first paint draws. */
function cachedPage(mode: "dark" | "light") {
  const drawn = JSON.parse(window.localStorage.getItem("uraeda.theme.drawn") ?? "{}");
  return drawn[mode]?.["--color-background-body"];
}

// Breaks: a stale tab rewriting the cache from the picks it read at load, so another tab's reload
// flashes the old theme.
test("a theme picked in another tab is drawn here, and the cache follows", async () => {
  await openPicker();
  await act(async () => void fireEvent.keyDown(document.activeElement!, { key: "Escape" }));
  await waitFor(() => expect(cachedPage("dark")).toBe(MOCHA_PAGE));

  // Another tab picks Nord: this one hears of it through the storage event.
  window.localStorage.setItem("uraeda.theme.dark", "nord");
  await act(async () => {
    window.dispatchEvent(
      new StorageEvent("storage", { key: "uraeda.theme.dark", newValue: "nord" }),
    );
  });
  await waitFor(() => expect(darkPage()).toBe(NORD_PAGE));
  expect(cachedPage("dark")).toBe(NORD_PAGE);
});
