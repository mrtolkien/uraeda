import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import type { ReactNode, RefObject } from "react";
import { useBackCloses } from "./useBackCloses.ts";
import { useWidthClass } from "./useWidthClass.ts";

/**
 * A short form over the page: a dialog on wide screens, a bottom sheet on narrow ones, tall unless
 * told otherwise, each with a visible Close. Opening it adds a history entry, so Back closes it.
 */
export function Overlay({
  children,
  isModal = true,
  isOpen,
  label,
  onClose,
  sheetHeight = "tall",
  sheetRef,
}: {
  children: ReactNode;
  /** On narrow screens, whether the page behind the sheet is blocked, and dimmed. */
  isModal?: boolean;
  isOpen: boolean;
  label: string;
  onClose: () => void;
  /** On narrow screens, the sheet's height: Astryx's `tall` (92%) or `capped` (62%). */
  sheetHeight?: "tall" | "capped";
  /** On narrow screens, the sheet's panel, as drawn on screen. */
  sheetRef?: RefObject<HTMLDivElement | null>;
}) {
  const wide = useWidthClass() === "wide";
  const close = useBackCloses(label, isOpen, onClose);
  const onOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };

  if (wide) {
    return (
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} padding={4} purpose="form">
        <DialogHeader hasDivider={false} onOpenChange={onOpenChange} title={label} />
        {isOpen && children}
      </Dialog>
    );
  }
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
    </BottomSheet>
  );
}

export { afterOverlayCloses } from "./useBackCloses.ts";
