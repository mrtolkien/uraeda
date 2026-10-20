// The sandbox's picker: the skill's pick script, loaded at the top of the sandbox's page, picks the
// element a click means, inside the app's open dialogs and sheets too, or the focused element on
// Enter or Space; it names the element's source and HTML, and leaves ignored elements to the page.
import { Button } from "@astryxdesign/core/Button";
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
