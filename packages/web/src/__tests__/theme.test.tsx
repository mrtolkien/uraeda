// US1 of the layout and look: the colour scheme, Mocha, Latte, or the system's, picked in the
// settings' Appearance and kept on each browser. Mocha draws in Astryx's dark slot, Latte in its
// light one.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { renderPage } from "./helpers.tsx";

/** The side navigation, once the page shows it. */
const navShown = async () => within(await screen.findByRole("navigation", { name: "Navigation" }));

/** Whether the app is drawn in its dark slot, Mocha's. */
const dark = () => document.querySelector('[data-theme="dark"]') !== null;

/** The system's colour scheme, as the browser reports it, with the change it announces. */
function systemIs(scheme: "dark" | "light") {
  const { happyDOM } = window as unknown as {
    happyDOM: { settings: { device: { prefersColorScheme: string } } };
  };
  happyDOM.settings.device.prefersColorScheme = scheme;
  // happy-dom tells media query lists of a change when the window resizes.
  act(() => {
    window.dispatchEvent(new Event("resize"));
  });
}

afterEach(() => {
  systemIs("light");
});

/** The Appearance's colour scheme control. */
const schemes = async () =>
  within(await screen.findByRole("radiogroup", { name: "Colour scheme" }));

test("the sidebar has no colour scheme switch", async () => {
  await renderPage();
  await (await navShown()).findByRole("link", { name: "Settings" });

  expect(screen.queryByRole("radiogroup", { name: "Colour scheme" })).toBeNull();
});

/** US1.1 */
test("with no scheme picked, the app follows the system, Mocha when dark and Latte when light", async () => {
  await renderPage("/settings/appearance");
  const control = await schemes();

  expect(control.getAllByRole("radio").map((radio) => radio.textContent)).toEqual([
    "Mocha",
    "Latte",
    "System",
  ]);
  expect(control.getByRole("radio", { checked: true }).textContent).toBe("System");
  expect(dark()).toBe(false);

  systemIs("dark");
  expect(dark()).toBe(true);

  systemIs("light");
  expect(dark()).toBe(false);
});

/** US1.2 */
test("Latte stays when the system turns dark, and after a reload; System forgets it", async () => {
  const { repo, unmount: leave } = await renderPage("/settings/appearance");
  fireEvent.click((await schemes()).getByRole("radio", { name: "Latte" }));
  expect(window.localStorage.getItem("uraeda.theme")).toBe("latte");

  systemIs("dark");
  expect(dark()).toBe(false);

  // A reload of this browser, its system still dark.
  leave();
  const reloaded = await renderPage("/settings/appearance", repo);
  expect(dark()).toBe(false);
  expect((await schemes()).getByRole("radio", { checked: true }).textContent).toBe("Latte");

  // Mocha, then back to the system: nothing stays stored, and the dark system shows again.
  fireEvent.click((await schemes()).getByRole("radio", { name: "Mocha" }));
  expect(window.localStorage.getItem("uraeda.theme")).toBe("mocha");
  expect(dark()).toBe(true);
  reloaded.unmount();
  systemIs("light");
  await renderPage("/settings/appearance", repo);
  expect(dark()).toBe(true);
  const system = (await schemes()).getByRole("radio", { name: "System" });
  await act(async () => {
    fireEvent.click(system);
  });
  expect(window.localStorage.getItem("uraeda.theme")).toBeNull();
  expect(dark()).toBe(false);
});

/** US1 more 1, review focus 1 */
test("an earlier pick of dark reads as Mocha, and light as Latte, rewritten at the next pick", async () => {
  // The light system would show if the earlier pick read as System.
  window.localStorage.setItem("uraeda.theme", "dark");
  const { repo, unmount: leave } = await renderPage("/settings/appearance");
  expect((await schemes()).getByRole("radio", { checked: true }).textContent).toBe("Mocha");
  expect(dark()).toBe(true);

  leave();
  window.localStorage.setItem("uraeda.theme", "light");
  systemIs("dark");
  await renderPage("/settings/appearance", repo);
  expect((await schemes()).getByRole("radio", { checked: true }).textContent).toBe("Latte");
  expect(dark()).toBe(false);

  fireEvent.click((await schemes()).getByRole("radio", { name: "Mocha" }));
  expect(window.localStorage.getItem("uraeda.theme")).toBe("mocha");
  fireEvent.click((await schemes()).getByRole("radio", { name: "Latte" }));
  expect(window.localStorage.getItem("uraeda.theme")).toBe("latte");
});
