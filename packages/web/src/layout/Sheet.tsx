// The phone's one sheet, for whatever rises from the bottom: a dialog's form, a picker, a "…"'s
// actions. Each has its title on top and a Close, over the frosted glass of what floats over the
// page.
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode, RefObject } from "react";
import { glassStyles } from "./glass.ts";

const styles = stylex.create({
  // Astryx paints its surface on the sheet, its scrolling body, and its handle's band: taken away
  // inside the sheet, the glass under them shows.
  sheet: {
    [colorVars["--color-background-surface"]]: "transparent",
  },
  // The sheet's heading over its content, which takes the rest of the sheet's height: a part of it
  // that scrolls on its own stays in the sheet, under the parts after it.
  fill: {
    display: "flex",
    flexDirection: "column",
    height: "100%",
    minHeight: 0,
  },
  // A sheet whose content brings its own inset, a picker's: its title row takes the sheet's.
  inset: {
    paddingBlockStart: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-4"],
  },
});

/**
 * A bottom sheet titled `label`, with a Close that calls `onClose`, in frosted glass. `isPadded`
 * false leaves its content at the sheet's edges, a picker's list, its title row still inset.
 */
export function Sheet({
  children,
  fills = false,
  hasScrim = true,
  height = "tall",
  isOpen,
  isPadded = true,
  label,
  onClose,
  purpose = "info",
  ref,
}: {
  children: ReactNode;
  /** Whether the content fills the sheet's height, as a flex column's item. */
  fills?: boolean;
  /** Whether the page behind the sheet is blocked, and dimmed. */
  hasScrim?: boolean;
  /** Astryx's `tall` (92%), `capped` (62%), or `hug`, as tall as its content, up to 92%. */
  height?: "tall" | "capped" | "hug";
  isOpen: boolean;
  isPadded?: boolean;
  label: string;
  onClose: () => void;
  /** `form` closes only on Close, Back, or Escape; `info` also on a tap outside, or a swipe. */
  purpose?: "form" | "info";
  ref?: RefObject<HTMLDivElement | null>;
}) {
  const content = (
    <>
      <HStack align="center" gap={2} justify="between" xstyle={isPadded ? undefined : styles.inset}>
        <Heading level={2}>{label}</Heading>
        <Button
          icon={<Icon icon="close" />}
          isIconOnly
          label="Close"
          onClick={onClose}
          variant="ghost"
        />
      </HStack>
      {isOpen && children}
    </>
  );
  return (
    <BottomSheet
      hasScrim={hasScrim}
      height={height}
      isOpen={isOpen}
      label={label}
      onOpenChange={(open: boolean) => {
        if (!open) {
          onClose();
        }
      }}
      padding={isPadded ? 4 : 0}
      purpose={purpose}
      ref={ref}
      xstyle={[glassStyles.surface, glassStyles.docked, styles.sheet]}
    >
      {fills ? <div {...stylex.props(styles.fill)}>{content}</div> : content}
    </BottomSheet>
  );
}
