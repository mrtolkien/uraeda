// Every dialog dims the page behind it without blurring it: Astryx's backdrop blurs the whole
// window, which the browser draws again on every frame the dialog changes, about 45 ms of
// compositing per key typed in its field. The add form's dialog, the key map's, and a picker's
// carry `scrimStyles.unblurred`, which takes the blur off their `::backdrop`.
import * as stylex from "@stylexjs/stylex";
import { act, fireEvent, screen } from "@testing-library/react";
import { beforeEach, expect, test } from "vite-plus/test";
import { scrimStyles } from "../layout/scrim.ts";
import { atWidth, fixtureRepo, renderPage } from "./helpers.tsx";

beforeEach(() => {
  atWidth(1440);
});

/** The classes that unblur a backdrop. */
const unblurred = (stylex.props(scrimStyles.unblurred).className ?? "").split(" ").filter(Boolean);

/** Presses `keys` one after the other on the page, as the keyboard does. */
async function press(...keys: ReadonlyArray<string>) {
  for (const key of keys) {
    await act(async () => {
      fireEvent.keyDown(document.body, { key, shiftKey: key === "?" });
    });
  }
}

/** Checks that the open dialog named `name` dims the page without a blur. */
async function expectUnblurred(name: string | RegExp) {
  const dialog = await screen.findByRole("dialog", { name });
  expect(unblurred.length).toBeGreaterThan(0);
  for (const name of unblurred) {
    expect(dialog.classList.contains(name), name).toBe(true);
  }
}

// Break: drop `xstyle={scrimStyles.unblurred}` from `Overlay`'s dialog.
test("the add form's dialog dims the page without blurring it", async () => {
  await renderPage("/priorities", fixtureRepo());
  await screen.findByRole("heading", { name: "Priorities" });

  await press("a");

  await expectUnblurred("New proposal");
});

// Break: drop `scrimStyles.unblurred` from the key map's `xstyle`.
test("the key map dims the page without blurring it", async () => {
  await renderPage("/priorities", fixtureRepo());
  await screen.findByRole("heading", { name: "Priorities" });

  await press("?");

  await expectUnblurred("Keyboard shortcuts");
});

// Break: drop `xstyle={scrimStyles.unblurred}` from `KeyPicker`'s dialog.
test("a picker dims the page without blurring it", async () => {
  await renderPage("/priorities", fixtureRepo());
  await screen.findByRole("heading", { name: "Priorities" });

  await press(" ", " ");

  await expectUnblurred(/./);
});
