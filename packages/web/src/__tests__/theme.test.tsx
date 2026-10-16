// US5 of the settings page: the theme leaves the sidebar for the Appearance category, still kept on
// each browser.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { renderPage } from "./helpers.tsx";

/** The side navigation, once the page shows it. */
const navShown = async () =>
  within(await screen.findByRole("navigation", { name: "Side navigation" }));

/** Whether the app is drawn in its dark theme. */
const dark = () => document.querySelector('[data-theme="dark"]') !== null;

/** US5.1 */
test("the sidebar has no theme switch", async () => {
  await renderPage();
  await (await navShown()).findByRole("link", { name: "Settings" });

  expect(screen.queryByRole("radiogroup", { name: "Theme" })).toBeNull();
});

/** US5.2, US5.3 */
test("Dark in Appearance turns the app dark, kept by this browser; another follows its system", async () => {
  const { repo, unmount: leave } = await renderPage("/settings/appearance");
  const theme = within(await screen.findByRole("radiogroup", { name: "Theme" }));

  fireEvent.click(theme.getByRole("radio", { name: "Dark" }));
  expect(dark()).toBe(true);
  expect(window.localStorage.getItem("uraeda.theme")).toBe("dark");

  // A reload of this browser.
  leave();
  const reloaded = await renderPage("/settings/appearance", repo);
  expect(dark()).toBe(true);
  expect(await screen.findByRole("radio", { checked: true, name: "Dark" })).toBeTruthy();

  // Another browser, with nothing stored.
  reloaded.unmount();
  window.localStorage.clear();
  const other = await renderPage("/settings/appearance", repo);
  expect(dark()).toBe(false);
  expect(await screen.findByRole("radio", { checked: true, name: "System" })).toBeTruthy();

  // Back to the system, on the first browser: nothing stays stored.
  window.localStorage.setItem("uraeda.theme", "dark");
  other.unmount();
  await renderPage("/settings/appearance", repo);
  const system = await screen.findByRole("radio", { name: "System" });
  await act(async () => {
    fireEvent.click(system);
  });
  expect(window.localStorage.getItem("uraeda.theme")).toBeNull();
});
