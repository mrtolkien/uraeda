// The key map's opening (the help-keybindings change): `?` lists the keys of where the focus was, a
// row's own keys with it on the row, and Escape closes it. What it lists is `keys-map.test.ts`'s.
import { act, cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { useKeyMap } from "../keys/KeyMap.tsx";
import { KeysProvider, useKeys } from "../keys/registry.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

/** A page with a row whose `o` acts only with the focus on it, and the map's keys. */
function Page() {
  const { bindings, keyMap } = useKeyMap();
  useKeys([
    ...bindings,
    {
      keys: "o",
      label: "add below",
      run: () => {},
      when: (target) => (target as Element | null)?.id === "row",
    },
  ]);
  return (
    <>
      {/* oxlint-disable-next-line react/forbid-elements -- a row the test focuses, nothing drawn */}
      <button id="row" type="button">
        A row
      </button>
      {keyMap}
    </>
  );
}

/** Presses `?` on an element, as the keyboard does. */
async function pressHelp(element: Element) {
  await act(async () => {
    fireEvent.keyDown(element, { key: "?", shiftKey: true });
  });
}

const map = () => screen.queryByRole("dialog", { name: "Keyboard shortcuts" });

// Break: a map read with the page's body as the target leaves the row's keys out.
test("? on a row lists the row's keys, and on the page leaves them out", async () => {
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  const row = screen.getByRole("button", { name: "A row" });
  row.focus();
  await pressHelp(row);
  await waitFor(() => expect(map()?.textContent).toContain("Add below"));
  expect(map()?.textContent).toContain("Keyboard shortcuts…");

  await act(async () => {
    fireEvent.keyDown(screen.getByRole("textbox", { name: "Search the keys" }), {
      key: "Escape",
    });
  });
  await waitFor(() => expect(map()).toBeNull());

  row.blur();
  await pressHelp(document.body);
  await waitFor(() => expect(map()?.textContent).toContain("Keyboard shortcuts…"));
  expect(map()?.textContent).not.toContain("Add below");
});
