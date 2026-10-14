import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type ReactNode, type RefObject, useEffect, useRef } from "react";
import { useWidthClass } from "./useWidthClass.ts";

function overlayOf(state: unknown): string | undefined {
  return (state as { overlay?: string } | null)?.overlay;
}

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
  const pushed = useRef(false);
  const onCloseRef = useRef(onClose);
  useEffect(() => {
    onCloseRef.current = onClose;
  });

  useEffect(() => {
    if (!isOpen) {
      // Closed by its owner, after a form's success: its history entry goes too.
      if (pushed.current) {
        pushed.current = false;
        if (overlayOf(window.history.state) === label) {
          window.history.back();
        }
      }
      return;
    }
    if (overlayOf(window.history.state) !== label) {
      window.history.pushState({ overlay: label }, "");
    }
    pushed.current = true;
    const onPop = () => {
      if (overlayOf(window.history.state) !== label) {
        pushed.current = false;
        onCloseRef.current();
      }
    };
    window.addEventListener("popstate", onPop);
    return () => window.removeEventListener("popstate", onPop);
  }, [isOpen, label]);

  // Closing goes back over the overlay's own entry, which closes it.
  const close = () => {
    if (overlayOf(window.history.state) === label) {
      window.history.back();
    } else {
      onClose();
    }
  };
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

/**
 * Runs once the overlay `label` is closed, its history entry gone: a page opened, or another
 * overlay, while its entry is still there would be undone by the Back that closes it.
 */
export function afterOverlayCloses(label: string, run: () => void) {
  if (overlayOf(window.history.state) !== label) {
    run();
    return;
  }
  const onPop = () => {
    if (overlayOf(window.history.state) !== label) {
      window.removeEventListener("popstate", onPop);
      run();
    }
  };
  window.addEventListener("popstate", onPop);
}
