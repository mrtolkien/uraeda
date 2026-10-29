import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import type { ReactNode, RefObject } from "react";
import { useCoverStatusLine } from "../statusHints.tsx";
import { Sheet } from "./Sheet.tsx";
import { useBackCloses } from "./useBackCloses.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

/**
 * A short form over the page: a dialog on wide screens, a bottom sheet on narrow ones, tall unless
 * told otherwise (`Sheet`), each with a visible Close. Opening it adds a history entry, so Back closes it.
 */
export function Overlay({
  children,
  fills = false,
  isModal = true,
  isOpen,
  label,
  onClose,
  purpose = "form",
  sheetHeight = "tall",
  sheetRef,
  size,
}: {
  children: ReactNode;
  /**
   * On narrow screens, whether the content fills the sheet's height, as a flex column's item,
   * rather than the sheet scrolling it whole: the session's column's split, whose parts scroll.
   */
  fills?: boolean;
  /** On narrow screens, whether the page behind the sheet is blocked, and dimmed. */
  isModal?: boolean;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  /** `info` also closes on a click outside; `form`, the default, only on Close, Back, or Escape. */
  purpose?: "form" | "info";
  /**
   * On narrow screens, the sheet's height: Astryx's `tall` (92%), `capped` (62%), or `hug`, as tall
   * as its content, up to 92%.
   */
  sheetHeight?: "tall" | "capped" | "hug";
  /** On narrow screens, the sheet's panel, as drawn on screen. */
  sheetRef?: RefObject<HTMLDivElement | null>;
  /**
   * On wide screens, the dialog's width, when Astryx's default is too narrow for its buttons, and
   * its tallest height: it is as tall as its content, up to it.
   */
  size?: { height?: string; width?: string };
}) {
  const wide = !isNarrow(useWidthClass());
  const close = useBackCloses(label, isOpen, onClose);
  // A sheet that is no modal is not in the top layer: the shell's status line would cover its foot.
  useCoverStatusLine(!wide && !isModal && isOpen);
  const onOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };

  if (wide) {
    return (
      <Dialog
        isOpen={isOpen}
        maxHeight={size?.height}
        onOpenChange={onOpenChange}
        padding={4}
        purpose={purpose}
        width={size?.width}
      >
        <DialogHeader hasDivider={false} onOpenChange={onOpenChange} title={label} />
        {isOpen && children}
      </Dialog>
    );
  }
  return (
    <Sheet
      fills={fills}
      hasScrim={isModal}
      height={sheetHeight}
      isOpen={isOpen}
      label={label}
      onClose={close}
      purpose={purpose}
      ref={sheetRef}
    >
      {children}
    </Sheet>
  );
}

export { afterOverlayCloses } from "./useBackCloses.ts";
