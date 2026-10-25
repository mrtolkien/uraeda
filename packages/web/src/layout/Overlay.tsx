import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode, RefObject } from "react";
import { useCoverStatusLine } from "../statusHints.tsx";
import { useBackCloses } from "./useBackCloses.ts";
import { isNarrow, useWidthClass } from "./useWidthClass.ts";

const styles = stylex.create({
  // The sheet's heading over its content, which takes the rest of the sheet's height: a part of it
  // that scrolls on its own stays in the sheet, under the parts after it.
  fill: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
});

/**
 * A short form over the page: a dialog on wide screens, a bottom sheet on narrow ones, tall unless
 * told otherwise, each with a visible Close. Opening it adds a history entry, so Back closes it.
 */
export function Overlay({
  children,
  fills = false,
  isModal = true,
  isOpen,
  label,
  onClose,
  sheetHeight = "tall",
  sheetRef,
  width,
}: {
  children: ReactNode;
  /**
   * On narrow screens, whether the content fills the sheet's height, as a flex column's item, rather
   * than the sheet scrolling it whole: the session's column's split, whose parts scroll.
   */
  fills?: boolean;
  /** On narrow screens, whether the page behind the sheet is blocked, and dimmed. */
  isModal?: boolean;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  /**
   * On narrow screens, the sheet's height: Astryx's `tall` (92%), `capped` (62%), or `hug`, as tall
   * as its content, up to 92%.
   */
  sheetHeight?: "tall" | "capped" | "hug";
  /** On narrow screens, the sheet's panel, as drawn on screen. */
  sheetRef?: RefObject<HTMLDivElement | null>;
  /** On wide screens, the dialog's width, when Astryx's default is too narrow for its buttons. */
  width?: string;
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
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} padding={4} purpose="form" width={width}>
        <DialogHeader hasDivider={false} onOpenChange={onOpenChange} title={label} />
        {isOpen && children}
      </Dialog>
    );
  }
  const sheet = (
    <>
      <HStack align="center" gap={2} justify="between">
        <Heading level={2}>{label}</Heading>
        <Button
          icon={<Icon icon="close" />}
          isIconOnly
          label="Close"
          onClick={close}
          variant="ghost"
        />
      </HStack>
      {isOpen && children}
    </>
  );
  return (
    <BottomSheet
      hasScrim={isModal}
      height={sheetHeight}
      isOpen={isOpen}
      label={label}
      onOpenChange={onOpenChange}
      padding={4}
      purpose="form"
      ref={sheetRef}
    >
      {fills ? <div {...stylex.props(styles.fill)}>{sheet}</div> : sheet}
    </BottomSheet>
  );
}

export { afterOverlayCloses } from "./useBackCloses.ts";
