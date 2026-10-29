import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, type RefObject, useRef } from "react";
import { useCoverStatusLine } from "../statusHints.tsx";
import { Sheet } from "./Sheet.tsx";
import { useBackCloses } from "./useBackCloses.ts";
import { useFieldFocus } from "./useFieldFocus.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  // The dialog's content, laid out by the dialog: a box only to find its field in.
  body: { display: "contents" },
});

/**
 * A short form over the page: a dialog on wide screens, a bottom sheet on narrow ones, tall unless
 * told otherwise (`Sheet`), each with a visible Close. Opening it adds a history entry, so Back closes it.
 */
export function Overlay({
  canClose,
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
  /**
   * Asked before Close, Escape, or a tap outside closes it: `false` keeps it open, as a form with
   * text does when the human keeps it. Back closes it without asking.
   */
  canClose?: () => Promise<boolean>;
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
  // On wide screens, the dialog's field takes the focus, not its Close (the sheet's does it).
  const body = useRef<HTMLDivElement>(null);
  useFieldFocus(body, wide && isOpen);
  // A sheet that is no modal is not in the top layer: the shell's status line would cover its foot.
  useCoverStatusLine(!wide && !isModal && isOpen);
  const closing = async () => {
    if (!canClose || (await canClose())) {
      close();
    }
  };
  const onOpenChange = (open: boolean) => {
    if (!open) {
      void closing();
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
        <div ref={body} {...stylex.props(styles.body)}>
          {isOpen && children}
        </div>
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
      onClose={() => void closing()}
      purpose={purpose}
      ref={sheetRef}
    >
      {children}
    </Sheet>
  );
}

export { afterOverlayCloses } from "./useBackCloses.ts";
