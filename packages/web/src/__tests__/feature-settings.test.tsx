// US8: a feature's name and colour in the sidebar, from its card's "…".
import { screen, waitFor, within } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
import {
  atRepo,
  atWidth,
  click,
  fakeAgent,
  fixtureRepo,
  refreshUntil,
  renderPage,
  type,
} from "./helpers.tsx";

const CLI = "2026-10-12-cli-tuis";

/** The side navigation, as drawn on a wide screen. */
function nav() {
  return within(screen.getByRole("navigation", { name: "Side navigation" }));
}

/** Opens cli-tuis's settings, and returns the dialog's name field. */
async function openSettings(name = "cli-tuis") {
  await click(await screen.findByRole("button", { name: `Settings of ${name}` }));
  return screen.findByRole("textbox", { name: "Name in the sidebar" });
}

/** US8.1, US8.5 */
test("a name and a colour rename the card, and leave the feature's slug", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });

  await type(await openSettings(), "Sidebar");
  await click(screen.getByRole("radio", { name: "Purple" }));
  await click(screen.getByRole("button", { name: "Save" }));

  await refreshUntil(() =>
    expect(nav().getByRole("link", { name: /^Sidebar, CLI TUIs, / })).toBeTruthy(),
  );
  await click(nav().getByRole("link", { name: /^Sidebar, / }));
  await waitFor(() => expect(window.location.pathname).toBe(atRepo(`/f/${CLI}`)));
});

/** US8.2 */
test("an empty name shows the slug again", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await type(await openSettings(), "Sidebar");
  await click(screen.getByRole("button", { name: "Save" }));
  await refreshUntil(() => expect(nav().getByRole("link", { name: /^Sidebar, / })).toBeTruthy());

  await type(await openSettings("Sidebar"), "");
  await click(screen.getByRole("button", { name: "Save" }));

  await refreshUntil(() => expect(nav().getByRole("link", { name: /^cli-tuis, / })).toBeTruthy());
});

/** US8.3 */
test("Save waits for a change, which says it is unsaved", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  const field = await openSettings();
  const save = screen.getByRole("button", { name: "Save" });
  expect(save.hasAttribute("disabled") || save.getAttribute("aria-disabled") === "true").toBe(true);
  expect(screen.queryByText("Unsaved changes")).toBeNull();

  await type(field, "Sidebar");

  expect(screen.getByText("Unsaved changes")).toBeTruthy();
});

/** US8.4 */
test("a name keeps its first 40 characters", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  const field = await openSettings();

  await type(field, "a".repeat(41));

  expect((field as HTMLInputElement).value).toBe("a".repeat(40));
});

/** US8.6 */
test("on the phone, a card's settings open from the drawer, without a pointer", async () => {
  atWidth(402);
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await click(await screen.findByRole("button", { name: "Open navigation" }));

  await click(await screen.findByRole("button", { name: "Settings of cli-tuis" }));

  expect(await screen.findByRole("textbox", { name: "Name in the sidebar" })).toBeTruthy();
});

/** US2.6 */
test("search finds a card by its name", async () => {
  await renderPage("/", fixtureRepo(), { agent: await fakeAgent() });
  await type(await openSettings(), "Sidebar");
  await click(screen.getByRole("button", { name: "Save" }));
  await refreshUntil(() => expect(nav().getByRole("link", { name: /^Sidebar, / })).toBeTruthy());

  await type(await screen.findByRole("searchbox", { name: "Search sessions" }), "sidebar");

  await refreshUntil(() => expect(nav().queryByRole("link", { name: /^web-ui, / })).toBeNull());
  expect(nav().getByRole("link", { name: /^Sidebar, / })).toBeTruthy();
});
