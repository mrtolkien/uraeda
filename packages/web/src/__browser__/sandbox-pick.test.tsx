// The sandbox's picker: the skill's pick script, loaded at the top of the sandbox's page, picks the
// element a click means, inside the app's open dialogs, sheets, and popovers too, or the focused
// element on Enter or Space; it names the element's source and HTML, and leaves ignored elements to
// the page.
import { Button } from "@astryxdesign/core/Button";
import { DropdownMenu } from "@astryxdesign/core/DropdownMenu";
import { TextInput } from "@astryxdesign/core/TextInput";
import { Theme } from "@astryxdesign/core/theme";
import { render } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import { page, userEvent } from "vite-plus/test/browser";
import { Overlay } from "../layout/Overlay.tsx";
import { uraedaTheme } from "../theme/built/uraeda.js";
import { pickScriptOnPage } from "./helpers.tsx";

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
