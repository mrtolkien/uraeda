// The registry's layer rule on what only a browser has, the Popover API (review focus 6): an open
// popover holds the keys and takes the hints away, and the toasts' manual popover, open on every
// page, holds nothing. happy-dom has no popovers, so the tests of the rule's other layers are there.
import { cleanup, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { afterEach, expect, test } from "vite-plus/test";
import { KeysProvider, useHints, useKeys } from "../keys/registry.tsx";

afterEach(() => {
  cleanup();
  document.body.replaceChildren();
});

const ran: Array<string> = [];

function Page() {
  useKeys([{ hint: "j", keys: "j", label: "move", run: () => void ran.push("j") }]);
  return <p aria-label="Hints">{useHints().map((hint) => `${hint.keys} ${hint.label}`)}</p>;
}

/** Adds a popover of `kind` to the page, not yet shown. */
function popover(kind: "auto" | "manual") {
  const element = document.createElement("div");
  element.setAttribute("popover", kind);
  element.textContent = "A popover";
  document.body.append(element);
  return element;
}

const hints = () => screen.getByLabelText("Hints").textContent;

test("an open popover holds the keys and takes the hints away, closed it gives them back", async () => {
  ran.length = 0;
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  const menu = popover("auto");
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j"]);

  menu.showPopover();
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j"]);
  await waitFor(() => expect(hints()).toBe(""));

  menu.hidePopover();
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j", "j"]);
  await waitFor(() => expect(hints()).toBe("j move"));
});

test("a manual popover, as the toasts' region, holds nothing", async () => {
  ran.length = 0;
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  popover("manual").showPopover();
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j"]);
  expect(hints()).toBe("j move");
});

test("a dialog left in the page with `hidden` is no layer, and an alert dialog shown is", () => {
  ran.length = 0;
  render(
    <KeysProvider>
      <Page />
    </KeysProvider>,
  );
  const dialog = document.createElement("div");
  dialog.setAttribute("role", "dialog");
  dialog.setAttribute("hidden", "");
  document.body.append(dialog);
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j"]);
  dialog.setAttribute("role", "alertdialog");
  dialog.removeAttribute("hidden");
  fireEvent.keyDown(document.body, { key: "j" });
  expect(ran).toEqual(["j"]);
});
