// The check of an outside behaviour the decisions palette relies on: Astryx's `CommandPalette` has
// no preview slot, so a preview can follow the cursor only if something reports the highlighted
// item. `renderItem`'s `isSelected` does not: it is the picker's chosen value, never the highlight.
// The palette's public context does, read from inside one of its slots. Typing clears the
// highlight, so Enter picks nothing until ↓, unless a slot highlights the first result: the
// second test checks that it can (see the layout-look rulings, R1).
import { atSize } from "./helpers.tsx";
import { CommandPalette, useCommandPaletteContext } from "@astryxdesign/core/CommandPalette";
import { Theme } from "@astryxdesign/core/theme";
import { createStaticSource } from "@astryxdesign/core/Typeahead";
import { render, screen } from "@testing-library/react";
import { useEffect, useState } from "react";
import { expect, test } from "vite-plus/test";
import { userEvent } from "vite-plus/test/browser";
import { uraedaTheme } from "../theme/built/uraeda.js";

atSize("desktop");

const source = createStaticSource([
  { id: "first", label: "First" },
  { id: "second", label: "Second" },
  { id: "third", label: "Third" },
]);

/** The item under the cursor, read from the palette's context; or, asked to, the first result. */
function Preview({ firstByDefault }: { firstByDefault: boolean }) {
  const palette = useCommandPaletteContext();
  const index = palette?.highlightedIndex ?? -1;
  const count = palette?.selectableItems.length ?? 0;
  const setHighlighted = palette?.setHighlightedIndex;
  useEffect(() => {
    if (firstByDefault && index === -1 && count > 0) {
      setHighlighted?.(0);
    }
  }, [firstByDefault, index, count, setHighlighted]);
  const item = palette?.selectableItems[index];
  return <p>Preview: {item?.label ?? "nothing"}</p>;
}

/** A palette whose footer previews the highlighted item, and that shows the item picked. */
function PreviewedPalette({ firstByDefault = false }: { firstByDefault?: boolean }) {
  const [open, setOpen] = useState(true);
  const [picked, setPicked] = useState("nothing");
  return (
    <Theme mode="light" theme={uraedaTheme}>
      <p>Picked: {picked}</p>
      <CommandPalette
        footer={<Preview firstByDefault={firstByDefault} />}
        isOpen={open}
        onOpenChange={setOpen}
        onValueChange={setPicked}
        searchSource={source}
      />
    </Theme>
  );
}

test("the palette's context reports the highlighted item, so a preview can follow the cursor", async () => {
  render(<PreviewedPalette />);
  await screen.findByRole("option", { name: "Third" });
  expect(screen.getByText("Preview: nothing")).toBeVisible();
  await userEvent.keyboard("{ArrowDown}");
  expect(await screen.findByText("Preview: First")).toBeVisible();
  await userEvent.keyboard("{ArrowDown}");
  expect(await screen.findByText("Preview: Second")).toBeVisible();
});

test("a slot can highlight the first result, so typing then Enter picks it", async () => {
  render(<PreviewedPalette firstByDefault />);
  expect(await screen.findByText("Preview: First")).toBeVisible();
  await userEvent.keyboard("thi");
  expect(await screen.findByText("Preview: Third")).toBeVisible();
  await userEvent.keyboard("{Enter}");
  expect(await screen.findByText("Picked: third")).toBeVisible();
});
