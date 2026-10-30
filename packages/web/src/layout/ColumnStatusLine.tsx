// On the phone, a page's column outside its page: the status line's buttons, the page's own, and
// the sheets they open over the page, the open one kept in the address (`useSheetTab`). The
// questions page's, the spec's and the plan's, the session's, the feature's, and the draft editor's
// bottom bars are drawn here.
import { HStack } from "@astryxdesign/core/HStack";
import * as stylex from "@stylexjs/stylex";
import type { ComponentProps, ReactNode } from "react";
import { Overlay } from "./Overlay.tsx";
import { TopBarSlot } from "./TopBarSlot.tsx";
import type { SheetState } from "./useSheetTab.ts";

const styles = stylex.create({
  // The bar's whole width and height, where its tiles draw their glass (`NavBar.tsx`).
  fill: { alignSelf: "stretch", flexGrow: 1 },
});

/** A sheet of the status line: its tab's key, its overlay's label, its panel, and its height. */
export type ColumnSheet = {
  /** `capped` for a sheet with no field to type in: the page shows above it. */
  height?: ComponentProps<typeof Overlay>["sheetHeight"];
  key: string;
  label: string;
  panel: ReactNode;
};

/**
 * The status line's `buttons`, then `sheets`, the one `sheet` names open over the page, closed by
 * its Close, Back, or a tap outside it.
 */
export function ColumnStatusLine({
  buttons,
  sheet: [open, setOpen],
  sheets,
}: {
  buttons: ReactNode;
  sheet: SheetState;
  sheets: ReadonlyArray<ColumnSheet>;
}) {
  return (
    <>
      <TopBarSlot>
        <HStack align="center" gap={1} xstyle={styles.fill}>
          {buttons}
        </HStack>
      </TopBarSlot>
      {sheets.map(({ height, key, label, panel }) => (
        <Overlay
          isOpen={open === key}
          key={key}
          label={label}
          onClose={() => setOpen()}
          sheetHeight={height}
        >
          {panel}
        </Overlay>
      ))}
    </>
  );
}
