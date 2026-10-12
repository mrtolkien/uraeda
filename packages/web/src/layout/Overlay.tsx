import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { type ReactNode, useEffect, useRef } from "react";
import { useWidthClass } from "./useWidthClass.ts";

function overlayOf(state: unknown): string | undefined {
  return (state as { overlay?: string } | null)?.overlay;
}

/**
 * A short form over the page: a dialog on wide screens, a tall bottom sheet on narrow ones, each
 * with a visible Close. Opening it adds a history entry, so Back closes it.
 */
export function Overlay({
  label,
  isOpen,
  onClose,
  children,
}: {
  label: string;
  isOpen: boolean;
  onClose: () => void;
  children: ReactNode;
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
      <Dialog isOpen={isOpen} onOpenChange={onOpenChange} purpose="form" padding={4}>
        <DialogHeader title={label} onOpenChange={onOpenChange} hasDivider={false} />
        {isOpen && children}
      </Dialog>
    );
  }
  return (
    <BottomSheet
      label={label}
      isOpen={isOpen}
      onOpenChange={onOpenChange}
      purpose="form"
      height="tall"
      padding={4}
    >
      <HStack justify="between" align="center" gap={2}>
        <Heading level={2}>{label}</Heading>
        <Button
          variant="ghost"
          label="Close"
          isIconOnly
          icon={<Icon icon="close" />}
          onClick={close}
        />
      </HStack>
      {isOpen && children}
    </BottomSheet>
  );
}
