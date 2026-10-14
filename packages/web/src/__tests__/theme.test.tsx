import { act, fireEvent, screen } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import { renderPage } from "./helpers.tsx";

/** US6.7 */
test("the theme switch picks dark, kept by the browser, and back to the system", async () => {
  const { repo, unmount } = await renderPage();

  fireEvent.click(await screen.findByRole("radio", { name: "Dark" }));
  expect(document.querySelector('[data-theme="dark"]')).toBeTruthy();
  expect(window.localStorage.getItem("uraeda.theme")).toBe("dark");

  unmount();
  await renderPage("/", repo);
  expect(document.querySelector('[data-theme="dark"]')).toBeTruthy();

  const system = await screen.findByRole("radio", { name: "System" });
  await act(async () => {
    fireEvent.click(system);
  });
  expect(window.localStorage.getItem("uraeda.theme")).toBeNull();
});
