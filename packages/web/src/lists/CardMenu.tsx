// A `…` menu, as a category's pane draws one: a note or a priority has none, as its row's keys and
// bar do all of it. The button shows on hover, on the selected card, on keyboard focus within the
// card, and always when the pointer cannot hover, by the card's `--menu-opacity`.
import { DropdownMenu, type DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import * as stylex from "@stylexjs/stylex";
import { useContext, useState } from "react";
import { useMenuPresentation } from "../layout/useWidthClass.ts";
import { MenuStateContext } from "./Card.tsx";
import { MORE_ICON } from "../layout/ActionsMenu.tsx";

const styles = stylex.create({
  // The card's variable, shown while the menu is open, though the pointer left the card for it.
  open: { opacity: 1 },
  // With a mouse, a button well inside the card, never touching its borders: a one-line card is as
  // tall as an `sm` button. A touch screen keeps the control's own size, as its target.
  trigger: {
    height: { "@media (hover: hover)": "1.5rem", default: null },
    minHeight: { "@media (hover: hover)": 0, default: null },
    minWidth: { "@media (hover: hover)": 0, default: null },
    opacity: "var(--menu-opacity, 1)",
    width: { "@media (hover: hover)": "1.5rem", default: null },
  },
});

/**
 * What `…` opens: `items` under `label`, as a popover, or a bottom sheet on a narrow screen. In a
 * card, the list holds whether it is open, so the `m` key opens it as the button does.
 */
export function CardMenu({
  items,
  label,
  onOpen,
}: {
  items: Array<DropdownMenuOption>;
  label: string;
  onOpen?: () => void;
}) {
  const presentation = useMenuPresentation();
  const held = useContext(MenuStateContext);
  const [isOwnOpen, setOwnOpen] = useState(false);
  const isOpen = held?.isOpen ?? isOwnOpen;
  return (
    <DropdownMenu
      alignment="end"
      button={{
        icon: MORE_ICON,
        isIconOnly: true,
        label,
        size: "sm",
        variant: "ghost",
        xstyle: [styles.trigger, isOpen && styles.open],
      }}
      hasChevron={false}
      isMenuOpen={held?.isOpen}
      items={items}
      onOpenChange={(next: boolean) => {
        setOwnOpen(next);
        held?.onOpenChange(next);
        if (next) {
          onOpen?.();
        }
      }}
      placement="below"
      presentation={presentation}
    />
  );
}
