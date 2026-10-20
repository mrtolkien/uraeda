// The sandbox's picker: the skill's pick script, loaded at the top of the sandbox's page, picks the
// element a click means, inside the app's open dialogs, sheets, and popovers too, or the focused
// element on Enter or Space; it names the element's source and HTML, and leaves ignored elements to
// the page.
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Theme } from "@astryxdesign/core/theme";
import { render } from "@testing-library/react";
import { expect, onTestFinished, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { Overlay } from "../layout/Overlay.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { mountSandboxBar } from "../sandbox/mountSandboxBar.tsx";
import { colorScheme, pickScriptOnPage } from "./helpers.tsx";

test("the pick script, at the top of a page, picks a button inside an open dialog", async () => {
  const picks = await pickScriptOnPage();
  render(
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen label="Rename" onClose={() => {}}>
        <Button label="Save" />
      </Overlay>
    </Theme>,
  );

  await picks.start();
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  expect(await picks.next()).toMatchObject({ name: "Save", role: "button" });
});

test("the pick script picks an item of an open popover menu, which it does not run", async () => {
  const picks = await pickScriptOnPage();
  const moved = vi.fn();
  render(
    <Theme mode="light" theme={uraedaTheme}>
      <DropdownMenu
        button={{ label: "Move" }}
        items={[{ label: "Now", onClick: moved }]}
        presentation="popover"
      />
    </Theme>,
  );
  await userEvent.click(page.getByRole("button", { name: "Move" }));

  await picks.start();
  await userEvent.click(page.getByRole("menuitem", { name: "Now" }));

  expect(await picks.next()).toMatchObject({ name: "Now", role: "menuitem" });
  expect(moved).not.toHaveBeenCalled();
});

test("Enter in pick mode picks the focused text box, and the page gets no Enter", async () => {
  const picks = await pickScriptOnPage();
  const submitted = vi.fn((event: SubmitEvent) => event.preventDefault());
  render(
    <form onSubmit={(event) => submitted(event.nativeEvent as SubmitEvent)}>
      <TextInput label="Title" onChange={() => {}} value="" />
    </form>,
  );
  page.getByRole("textbox", { name: "Title" }).element().focus();

  await picks.start();
  await userEvent.keyboard("{Enter}");

  expect(await picks.next()).toMatchObject({ name: "Title", role: "textbox" });
  expect(submitted).not.toHaveBeenCalled();
});

test("Space in pick mode picks the focused button, and the page gets no Space", async () => {
  const picks = await pickScriptOnPage();
  const pressed = vi.fn();
  const released = vi.fn();
  render(<Button label="Save" onClick={pressed} />);
  const button = page.getByRole("button", { name: "Save" }).element() as HTMLElement;
  button.addEventListener("keyup", released);
  button.focus();

  await picks.start();
  await userEvent.keyboard(" ");

  expect(await picks.next()).toMatchObject({ name: "Save", role: "button" });
  expect(pressed).not.toHaveBeenCalled();
  expect(released).not.toHaveBeenCalled();
  expect(picks.taken()).toHaveLength(1);
});

test("pick mode left on by a test", async () => {
  const picks = await pickScriptOnPage();

  await picks.start();
});

test("is off in the next test, whose click reaches its button", async () => {
  const picks = await pickScriptOnPage();
  const pressed = vi.fn();
  render(<Button label="Save" onClick={pressed} />);

  await userEvent.click(page.getByRole("button", { name: "Save" }));

  expect(pressed).toHaveBeenCalledOnce();
  expect(picks.taken()).toEqual([]);
});

test("an ignored element is not picked, and its click reaches it", async () => {
  const picks = await pickScriptOnPage();
  const pressed = vi.fn();
  render(
    <div data-uraeda-pick-ignore>
      <Button label="Stop" onClick={pressed} />
    </div>,
  );

  await picks.start();
  await userEvent.click(page.getByRole("button", { name: "Stop" }));

  expect(pressed).toHaveBeenCalledOnce();
  expect(picks.taken()).toEqual([]);
});

test("a pick names the nearest source and the element's HTML", async () => {
  const picks = await pickScriptOnPage();
  render(
    <div data-insp-path="packages/web/src/X.tsx:3:5">
      <p>Hi</p>
    </div>,
  );

  await picks.start();
  await userEvent.click(page.getByText("Hi"));

  expect(await picks.next()).toMatchObject({
    html: "<p>Hi</p>",
    source: "packages/web/src/X.tsx:3:5",
  });
});

test("Enter on a focused ignored button reaches it, and picks nothing", async () => {
  const picks = await pickScriptOnPage();
  const pressed = vi.fn();
  render(
    <div data-uraeda-pick-ignore>
      <Button label="Stop" onClick={pressed} />
    </div>,
  );
  page.getByRole("button", { name: "Stop" }).element().focus();

  await picks.start();
  await userEvent.keyboard("{Enter}");

  expect(pressed).toHaveBeenCalledOnce();
  expect(picks.taken()).toEqual([]);
});

/** A paragraph to pick by a click, which then shows that no key picked before it. */
function Marker() {
  return <p>Marker</p>;
}

test("Enter with nothing focused picks nothing, and leaves pick mode on", async () => {
  const picks = await pickScriptOnPage();
  render(<Marker />);
  (document.activeElement as HTMLElement | null)?.blur();

  await picks.start();
  await userEvent.keyboard("{Enter}");
  await userEvent.click(page.getByText("Marker"));

  expect(await picks.next()).toMatchObject({ role: "paragraph", text: "Marker" });
});

test("a key with a modifier, or composing text, picks nothing, and reaches the page", async () => {
  const picks = await pickScriptOnPage();
  const keys = vi.fn();
  render(
    <>
      <TextInput label="Title" onChange={() => {}} value="" />
      <Marker />
    </>,
  );
  const box = page.getByRole("textbox", { name: "Title" }).element() as HTMLElement;
  box.addEventListener("keydown", (event) => keys(event.key));
  box.focus();

  await picks.start();
  await userEvent.keyboard("{Control>}{Enter}{/Control}");
  await userEvent.keyboard("{Shift>}{Enter}{/Shift}");
  box.dispatchEvent(
    new KeyboardEvent("keydown", { bubbles: true, isComposing: true, key: "Enter" }),
  );
  await userEvent.click(page.getByText("Marker"));

  expect(await picks.next()).toMatchObject({ text: "Marker" });
  expect(keys.mock.calls.filter(([key]) => key === "Enter")).toHaveLength(3);
});

test("the picking key's repeats, until its key up, do not reach the page", async () => {
  const picks = await pickScriptOnPage();
  const keys = vi.fn();
  render(<Button label="Save" />);
  const button = page.getByRole("button", { name: "Save" }).element() as HTMLElement;
  button.addEventListener("keydown", (event) => keys(event.type));
  button.addEventListener("keyup", (event) => keys(event.type));
  button.focus();

  await picks.start();
  button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  expect(await picks.next()).toMatchObject({ name: "Save" });
  button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " ", repeat: true }));
  button.dispatchEvent(new KeyboardEvent("keyup", { bubbles: true, key: " " }));
  // The press is over: the next one is the page's.
  button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));

  expect(keys.mock.calls).toEqual([["keydown"]]);
});

test("once the window loses focus, the picking key's key up is the page's", async () => {
  const picks = await pickScriptOnPage();
  const released = vi.fn();
  render(
    <>
      <Button label="Save" />
      <TextInput label="Title" onChange={() => {}} value="" />
    </>,
  );
  const button = page.getByRole("button", { name: "Save" }).element() as HTMLElement;
  const box = page.getByRole("textbox", { name: "Title" }).element() as HTMLElement;
  box.addEventListener("keyup", released);
  button.focus();

  await picks.start();
  // A Space pressed, then focus gone before its key up: the key up comes elsewhere, or never.
  button.dispatchEvent(new KeyboardEvent("keydown", { bubbles: true, key: " " }));
  expect(await picks.next()).toMatchObject({ name: "Save" });
  window.dispatchEvent(new Event("blur"));
  box.focus();
  await userEvent.keyboard(" ");

  expect(released).toHaveBeenCalledOnce();
});

test("a pick's HTML is cut at 2000 characters", async () => {
  const picks = await pickScriptOnPage();
  render(<p>{"word ".repeat(1000)}</p>);

  await picks.start();
  await userEvent.click(page.getByRole("paragraph"));

  expect((await picks.next()).html).toHaveLength(2000);
});

/**
 * The sandbox's bar mounted over the test's page, with the pick script loaded, and a clipboard
 * that keeps what it is given, or refuses it: headless browsers keep their clipboard to themselves.
 */
async function sandboxPage({ clipboard = "kept" }: { clipboard?: "kept" | "refused" } = {}) {
  await pickScriptOnPage();
  const copied: Array<string> = [];
  const original = Object.getOwnPropertyDescriptor(navigator, "clipboard");
  Object.defineProperty(navigator, "clipboard", {
    configurable: true,
    value: {
      writeText: (text: string) =>
        clipboard === "refused"
          ? Promise.reject(new DOMException("denied", "NotAllowedError"))
          : Promise.resolve(void copied.push(text)),
    },
  });
  const unmount = mountSandboxBar({ document, window });
  onTestFinished(async () => {
    unmount();
    if (original) {
      Object.defineProperty(navigator, "clipboard", original);
    } else {
      Reflect.deleteProperty(navigator, "clipboard");
    }
    // The script stays loaded: a pick mode left on would take the next test's clicks.
    window.postMessage({ on: false, uraeda: "pick" }, "*");
    await new Promise((resolve) => setTimeout(resolve));
  });
  return { copied };
}

test("a click copies the pick, and the bar names it", async () => {
  const { copied } = await sandboxPage();
  render(<Button label="Submit answers" />);

  await userEvent.click(page.getByRole("button", { name: "Pick an element" }));
  await expect
    .element(page.getByText("Click an element to copy it. Escape to stop."))
    .toBeVisible();
  await userEvent.click(page.getByRole("button", { name: "Submit answers" }));

  await expect
    .element(page.getByText("Copied button “Submit answers”. Paste it to your agent."))
    .toBeVisible();
  expect(copied).toHaveLength(1);
  expect(copied[0]).toMatch(/^Sandbox pick: .+\nElement: button “Submit answers”\nSource: /);
  expect(copied[0]).toContain(`\nViewport: ${window.innerWidth} × ${window.innerHeight}, light`);
  expect(copied[0]).toContain(`Sandbox pick: ${window.location.href}\n`);
});

test("the pick's theme is the app's colour mode", async () => {
  await colorScheme("dark");
  const { copied } = await sandboxPage();
  render(<Button label="Save" />);

  await userEvent.click(page.getByRole("button", { name: "Pick an element" }));
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  await expect.element(page.getByText(/^Copied button/)).toBeVisible();
  expect(copied[0]).toMatch(/, dark$/);
});

test("Escape stops pick mode, and the page gets no Escape", async () => {
  await sandboxPage();
  const closed = vi.fn();
  const dialog = (isOpen: boolean) => (
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen={isOpen} label="Rename" onClose={closed}>
        <Button label="Save" />
      </Overlay>
    </Theme>
  );
  render(dialog(true));
  await expect.element(page.getByRole("dialog", { name: "Rename" })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Pick an element" });
  await userEvent.click(toggle);
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");

  await userEvent.keyboard("{Escape}");

  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  await expect
    .element(page.getByText("Click an element to copy it. Escape to stop."))
    .not.toBeInTheDocument();
  await expect.element(page.getByRole("dialog", { name: "Rename" })).toBeVisible();
  expect(closed).not.toHaveBeenCalled();
});

test("a refused clipboard shows the text to copy by hand", async () => {
  await sandboxPage({ clipboard: "refused" });
  render(<Button label="Save" />);

  await userEvent.click(page.getByRole("button", { name: "Pick an element" }));
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  await expect
    .element(page.getByText("Could not copy. Select the text below and copy it."))
    .toBeVisible();
  await expect.element(page.getByText(/^Sandbox pick: /)).toBeVisible();
  await expect.element(page.getByText(/Element: button “Save”/)).toBeVisible();
});

test("a missing clipboard shows the text to copy by hand", async () => {
  await sandboxPage();
  Object.defineProperty(navigator, "clipboard", { configurable: true, value: undefined });
  render(<Button label="Save" />);

  await userEvent.click(page.getByRole("button", { name: "Pick an element" }));
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  await expect
    .element(page.getByText("Could not copy. Select the text below and copy it."))
    .toBeVisible();
});

test("a click on the bar's toggle in pick mode turns pick mode off, and picks nothing", async () => {
  const { copied } = await sandboxPage();
  const toggle = page.getByRole("button", { name: "Pick an element" });
  await userEvent.click(toggle);
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");

  await userEvent.click(toggle);

  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
  expect(copied).toEqual([]);
  // Pick mode is off in the script too: a click reaches the page.
  const pressed = vi.fn();
  render(<Button label="Save" onClick={pressed} />);
  await userEvent.click(page.getByRole("button", { name: "Save" }));
  expect(pressed).toHaveBeenCalledOnce();
});

/** The keyboard shortcut that turns pick mode on and off, from anywhere on the page. */
const PICK_SHORTCUT = "{Alt>}{Shift>}P{/Shift}{/Alt}";

/** Whether a click at the element's centre reaches it, and it takes focus: neither if inert. */
function reachable(element: HTMLElement): boolean {
  const { height, left, top, width } = element.getBoundingClientRect();
  const hit = document.elementFromPoint(left + width / 2, top + height / 2);
  element.focus();
  return element.contains(hit) && document.activeElement === element;
}

test("in an open modal dialog, the shortcut starts pick mode, and the bar stays usable", async () => {
  const { copied } = await sandboxPage();
  render(
    <Theme mode="light" theme={uraedaTheme}>
      <Overlay isOpen label="Rename" onClose={() => {}}>
        <Button label="Save" />
      </Overlay>
    </Theme>,
  );
  await expect.element(page.getByRole("dialog", { name: "Rename" })).toBeVisible();
  const toggle = page.getByRole("button", { name: "Pick an element" });

  await userEvent.keyboard(PICK_SHORTCUT);
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  await expect
    .element(page.getByText("Copied button “Save”. Paste it to your agent."))
    .toBeVisible();
  expect(copied[0]).toContain("Element: button “Save”");
  expect(reachable(toggle.element() as HTMLElement)).toBe(true);
});

test("the shortcut starts pick mode without closing an open popover menu", async () => {
  const { copied } = await sandboxPage();
  render(
    <Theme mode="light" theme={uraedaTheme}>
      <DropdownMenu button={{ label: "Move" }} items={[{ label: "Now" }]} presentation="popover" />
    </Theme>,
  );
  await userEvent.click(page.getByRole("button", { name: "Move" }));
  await expect.element(page.getByRole("menuitem", { name: "Now" })).toBeVisible();

  await userEvent.keyboard(PICK_SHORTCUT);
  await expect
    .element(page.getByRole("button", { name: "Pick an element" }))
    .toHaveAttribute("aria-pressed", "true");
  await userEvent.click(page.getByRole("menuitem", { name: "Now" }));

  await expect.element(page.getByText(/^Copied menuitem “Now”/)).toBeVisible();
  expect(copied[0]).toContain("Element: menuitem “Now”");
});

test("the shortcut turns pick mode off again, and is named on the toggle", async () => {
  await sandboxPage();
  const toggle = page.getByRole("button", { name: "Pick an element" });
  await expect.element(toggle).toHaveAttribute("aria-keyshortcuts", "Alt+Shift+P");

  await userEvent.keyboard(PICK_SHORTCUT);
  await expect.element(toggle).toHaveAttribute("aria-pressed", "true");
  await userEvent.keyboard(PICK_SHORTCUT);

  await expect.element(toggle).toHaveAttribute("aria-pressed", "false");
});
