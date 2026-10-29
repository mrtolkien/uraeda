// The "…" that opens what can be done to a thing: a feature, a session, a card, a repository. Every
// such menu is drawn here, its glyph, size, and place the same on every page (UI coherence): a
// popover on wide screens, and on the phone its actions listed in the phone's one sheet (`Sheet`),
// titled, with a Close, as a dialog's form and a picker are.
import { Button } from "@astryxdesign/core/Button";
import type { DropdownMenuItemData, DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { List, ListItem } from "@astryxdesign/core/List";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import { colorVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type Ref, useState } from "react";
import { afterOverlayCloses } from "./Overlay.tsx";
import { Sheet } from "./Sheet.tsx";
import { useBackCloses } from "./useBackCloses.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  destructive: {
    "--_item-label-color": colorVars["--color-error"],
    color: colorVars["--color-error"],
  },
});

/** The "…" glyph of every actions menu, its trigger's or a card's that only shows it. */
const MORE_ICON = <Icon color="secondary" icon="moreHorizontal" />;

/**
 * A "…" named `label` that opens `items`, aligned to its end. `isMenuOpen` and `ref` let a page
 * open it and give the focus back to it, as the session's actions do.
 */
export function ActionsMenu({
  isMenuOpen,
  items,
  label,
  ref,
}: {
  isMenuOpen?: boolean;
  items: Array<DropdownMenuOption>;
  label: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  if (isNarrow(useWidthClass())) {
    return <SheetMenu isMenuOpen={isMenuOpen} items={items} label={label} ref={ref} />;
  }
  return (
    <MoreMenu
      alignment="end"
      icon={MORE_ICON}
      items={items}
      label={label}
      presentation="popover"
      size="sm"
      {...(isMenuOpen === undefined ? {} : { isMenuOpen })}
      {...(ref ? { ref } : {})}
    />
  );
}

/**
 * The phone's "…": its actions in the sheet, each a row. A tap runs its action once the sheet's
 * history entry is gone, so that a dialog it opens is not closed by the Back that closes the sheet.
 */
function SheetMenu({
  isMenuOpen = false,
  items,
  label,
  ref,
}: {
  isMenuOpen?: boolean;
  items: Array<DropdownMenuOption>;
  label: string;
  ref?: Ref<HTMLButtonElement>;
}) {
  const [open, setOpen] = useState(isMenuOpen);
  const close = useBackCloses(label, open, () => setOpen(false));
  const pick = (item: DropdownMenuItemData) => {
    close();
    const run = item.onClick;
    if (run) {
      afterOverlayCloses(label, () => run());
    }
  };
  const actions = items.flatMap((option) =>
    "type" in option ? (option.type === "section" ? option.items : []) : [option],
  );
  return (
    <>
      <Button
        icon={MORE_ICON}
        isIconOnly
        label={label}
        onClick={() => setOpen(true)}
        ref={ref}
        size="sm"
        variant="ghost"
      />
      <Sheet height="hug" isOpen={open} label={label} onClose={close}>
        <List density="spacious">
          {actions.map((item, index) => (
            <ListItem
              isDisabled={item.isDisabled}
              key={item.id ?? index}
              label={item.label}
              onClick={() => pick(item)}
              startContent={item.icon}
              xstyle={item.variant === "destructive" && styles.destructive}
            />
          ))}
        </List>
      </Sheet>
    </>
  );
}
