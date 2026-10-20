// The sandbox's picker: the skill's pick script, loaded at the top of the sandbox's page, picks the
// element a click means, inside the app's open dialogs and sheets too.
import { Button } from "@astryxdesign/core/Button";
import { Theme } from "@astryxdesign/core/theme";
import { render } from "@testing-library/react";
import { expect, test } from "vite-plus/test";
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

  picks.start();
  await userEvent.click(page.getByRole("button", { name: "Save" }));

  expect(await picks.next()).toMatchObject({ name: "Save", role: "button" });
});
