// A row of the settings form, as the mockup draws it: the setting's icon, its name, a line of help
// under it, what the page says about it, then its control at the end; on narrow screens, the
// control under the text. The rows of a section are a list, so a screen reader counts them.
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import {
  borderVars,
  colorVars,
  fontWeightVars,
  spacingVars,
  typeScaleVars,
} from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import type { Setting } from "./categories.ts";

const styles = stylex.create({
  body: {
    flexGrow: 1,
    minWidth: 0,
  },
  control: {
    flexShrink: 0,
    maxWidth: "100%",
  },
  icon: {
    color: colorVars["--color-text-secondary"],
    // Level with the name's line.
    lineHeight: typeScaleVars["--text-body-leading"],
  },
  list: {
    listStyleType: "none",
    margin: 0,
    padding: 0,
  },
  name: {
    fontSize: typeScaleVars["--text-body-size"],
    fontWeight: fontWeightVars["--font-weight-semibold"],
    lineHeight: typeScaleVars["--text-body-leading"],
  },
  row: {
    borderBlockEndColor: colorVars["--color-border"],
    borderBlockEndStyle: "solid",
    borderBlockEndWidth: { ":last-child": 0, default: borderVars["--border-width"] },
    paddingBlock: spacingVars["--spacing-3"],
    paddingInline: spacingVars["--spacing-3"],
  },
});

/** A section's rows, as a list. */
export function SettingRows({ children }: { children: ReactNode }) {
  return (
    <VStack as="ul" xstyle={styles.list}>
      {children}
    </VStack>
  );
}

/**
 * A setting's row: its icon, its name as a heading under its section's, its help under it, then
 * `notes`, what the page says of its value, and `children`, its control.
 */
export function SettingRow({
  children,
  notes,
  setting: { help, icon, label },
}: {
  children?: ReactNode;
  notes?: ReactNode;
  setting: Pick<Setting, "help" | "icon" | "label">;
}) {
  const narrow = isNarrow(useWidthClass());
  const text = (
    <HStack align="start" gap={3} xstyle={styles.body}>
      <Text xstyle={styles.icon}>
        <Icon icon={icon} size="sm" />
      </Text>
      <VStack gap={1} xstyle={styles.body}>
        <Heading level={3} xstyle={styles.name}>
          {label}
        </Heading>
        <Text color="secondary">{help}</Text>
        {notes}
      </VStack>
    </HStack>
  );
  const control = children && <VStack xstyle={styles.control}>{children}</VStack>;
  if (narrow) {
    return (
      <VStack as="li" gap={3} xstyle={styles.row}>
        {text}
        {control}
      </VStack>
    );
  }
  return (
    <HStack align="center" as="li" gap={4} xstyle={styles.row}>
      {text}
      {control}
    </HStack>
  );
}
