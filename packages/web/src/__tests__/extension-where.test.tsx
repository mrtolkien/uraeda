// An extension's switch in Settings: turned off, then on again, it is back in the repositories it
// was on in, not on everywhere.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { expect, test, vi } from "vite-plus/test";
import type { OnIn } from "../settings/extensions.ts";
import { WhereControls } from "../settings/ExtensionWhere.tsx";
import { sampleExtensions } from "../settings/sampleExtensions.ts";

const wiki = sampleExtensions.extensions.find((row) => row.name === "wiki")!;

/** Flips the wiki's switch. */
const toggle = () => fireEvent.click(screen.getByRole("switch", { name: "Wiki on" }));

// Break: the switch turning it on for every repository, losing its "Only in…" list.
test("the switch turns it back on where it was", async () => {
  const setOn = vi.fn((_: OnIn) => {});
  const draw = (on: ReadonlyArray<string>) => (
    <WhereControls
      isPicking={false}
      onPick={() => {}}
      row={{ ...wiki, on: [...on], onAll: false }}
      setOn={setOn}
    />
  );
  const { rerender } = render(draw(["uraeda"]));
  await act(async () => toggle());
  expect(setOn).toHaveBeenLastCalledWith([]);
  rerender(draw([]));
  await act(async () => toggle());
  expect(setOn).toHaveBeenLastCalledWith(["uraeda"]);
});
