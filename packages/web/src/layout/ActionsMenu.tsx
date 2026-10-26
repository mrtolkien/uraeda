// The "…" that opens what can be done to a thing: a feature, a session, a card, a repository. Every
// such menu is drawn here, its glyph, size, and place the same on every page (UI coherence), and
// opens as the width asks (`useMenuPresentation`).
import type { DropdownMenuOption } from "@astryxdesign/core/DropdownMenu";
import { Icon } from "@astryxdesign/core/Icon";
import { MoreMenu } from "@astryxdesign/core/MoreMenu";
import type { Ref } from "react";
import { useMenuPresentation } from "./useWidthClass.ts";

/** The "…" glyph of every actions menu, its trigger's or a card's that only shows it. */
export const MORE_ICON = <Icon color="secondary" icon="moreHorizontal" />;

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
  const presentation = useMenuPresentation();
  return (
    <MoreMenu
      alignment="end"
      icon={MORE_ICON}
      items={items}
      label={label}
      presentation={presentation}
      size="sm"
      {...(isMenuOpen === undefined ? {} : { isMenuOpen })}
      {...(ref ? { ref } : {})}
    />
  );
}
