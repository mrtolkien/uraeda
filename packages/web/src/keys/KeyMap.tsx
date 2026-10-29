// The key map, `?`: every key that works where the human is, as the registry declares them
// (`keyMap.ts`), with a search over them. A reference, not a palette: its rows run nothing, for a
// page's key acts on the selection the map covers, and the leader menu already runs the sequences.
// On wide and semi-wide screens, a dialog on the frosted glass of what floats over the page, square,
// over the page dimmed by the dialog's backdrop, lightly (`--glass-dim`), so the glass's text reads
// at 4.5:1 or more over any page; on narrow screens, the phone's sheet (`Sheet`), already glass over
// a dimmed page. Opening it adds a history entry, so Back closes it, as Escape and a click outside
// do, and the focus returns to where it was.
import { Dialog, DialogHeader } from "@astryxdesign/core/Dialog";
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Fragment, type ReactNode, useRef, useState } from "react";
import { glassStyles } from "../layout/glass.ts";
import { glassVars } from "../layout/glass.stylex.ts";
import { GroupTitle } from "../layout/GroupTitle.tsx";
import { Sheet } from "../layout/Sheet.tsx";
import { useBackCloses } from "../layout/useBackCloses.ts";
import { useFieldFocus } from "../layout/useFieldFocus.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { KeyCap } from "./KeyCap.tsx";
import { type KeyRow, keyMapSections, type KeySection, searchKeyMap, written } from "./keyMap.ts";
import { menuVars } from "./menu.stylex.ts";
import { useListed, useSingleKeys } from "./registry.tsx";
import type { Binding } from "./store.ts";

/** What the key map is called: its dialog, its sheet, and its history entry. */
export const KEY_MAP_TITLE = "Keyboard shortcuts";

/** What the keys that open it are called, in the menu and in the map itself. */
const OPENS = `${KEY_MAP_TITLE}…`;

const styles = stylex.create({
  body: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-3"],
    minHeight: 0,
  },
  // The sections side by side where the room allows, each kept whole in its column.
  columns: {
    columnGap: spacingVars["--spacing-6"],
    columnWidth: menuVars["--key-map-section"],
  },
  // A box only to find the search in: the dialog lays its content out.
  contents: { display: "contents" },
  // Square, as every glass is, and as tall whatever the search finds, so the search never moves.
  glass: {
    borderRadius: 0,
    [colorVars["--color-overlay"]]: glassVars["--glass-dim"],
    height: "var(--size-palette-height)",
  },
  keys: {
    display: "inline-flex",
    flexShrink: 0,
    flexWrap: "wrap",
    gap: spacingVars["--spacing-2"],
    minWidth: menuVars["--key-map-keys"],
  },
  list: {
    listStyle: "none",
    margin: 0,
    padding: 0,
  },
  row: {
    alignItems: "baseline",
    display: "flex",
    gap: spacingVars["--spacing-2"],
    paddingBlock: spacingVars["--spacing-0-5"],
  },
  // The list scrolls under the search, which stays.
  scroll: {
    minHeight: 0,
    overflowY: "auto",
  },
  section: {
    breakInside: "avoid",
    paddingBlockEnd: spacingVars["--spacing-3"],
  },
  // The leader menu's words, at the body's 16 px.
  text: {
    fontSize: menuVars["--menu-text"],
  },
});

/** A row: its keys, each sequence as typed, then its icon and what they do. */
function Row({ row }: { row: KeyRow }) {
  return (
    <li {...stylex.props(styles.row)}>
      <span {...stylex.props(styles.keys)}>
        {row.keys.map((tokens) => (
          <span key={tokens.join(" ")}>
            {tokens.map((token, index) => (
              <Fragment key={`${index} ${token}`}>
                {index > 0 && " "}
                <KeyCap>{written(token)}</KeyCap>
              </Fragment>
            ))}
          </span>
        ))}
      </span>
      {row.icon !== undefined && <Icon icon={row.icon} size="sm" />}
      <Text color="primary" type="supporting" xstyle={styles.text}>
        {row.label}
      </Text>
    </li>
  );
}

/** The search, then the sections it finds, which scroll under it. */
function Body({ sections }: { sections: ReadonlyArray<KeySection> }) {
  const [query, setQuery] = useState("");
  const found = searchKeyMap(sections, query);
  return (
    <div {...stylex.props(styles.body)}>
      <TextInput
        hasAutoFocus
        isLabelHidden
        label="Search the keys"
        onChange={setQuery}
        placeholder="Search…"
        value={query}
      />
      {/* Tabbed to, the list scrolls by the arrows, as a page does. */}
      <section aria-label="Keys" tabIndex={0} {...stylex.props(styles.scroll)}>
        {found.length === 0 ? (
          <Text color="secondary" type="supporting">
            No key matches.
          </Text>
        ) : (
          <div {...stylex.props(styles.columns)}>
            {found.map((section) => (
              <div key={section.title} {...stylex.props(styles.section)}>
                <GroupTitle level={3}>{section.title}</GroupTitle>
                <ul {...stylex.props(styles.list)}>
                  {section.rows.map((row) => (
                    <Row key={row.label} row={row} />
                  ))}
                </ul>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}

/** The key map over `sections` while they are given; `onClose` once Escape, Back, or a click closes it. */
export function KeyMap({
  onClose,
  sections,
}: {
  onClose: () => void;
  sections: ReadonlyArray<KeySection> | null;
}) {
  const narrow = isNarrow(useWidthClass());
  const isOpen = sections !== null;
  const close = useBackCloses(KEY_MAP_TITLE, isOpen, onClose);
  // On wide screens, the search takes the focus, not the dialog's title (the sheet's does it).
  const inner = useRef<HTMLDivElement>(null);
  useFieldFocus(inner, !narrow && isOpen);
  const onOpenChange = (open: boolean) => {
    if (!open) {
      close();
    }
  };
  const body = sections !== null && <Body sections={sections} />;
  if (narrow) {
    return (
      <Sheet isOpen={isOpen} label={KEY_MAP_TITLE} onClose={close}>
        {body}
      </Sheet>
    );
  }
  return (
    <Dialog
      isOpen={isOpen}
      maxHeight="var(--size-palette-height)"
      onOpenChange={onOpenChange}
      padding={4}
      purpose="info"
      width="var(--size-palette)"
      xstyle={[glassStyles.surface, glassStyles.floating, styles.glass]}
    >
      {/* Its title only while open: a closed dialog's heading stays in the page, among its own. */}
      {isOpen && (
        <>
          <DialogHeader hasDivider={false} onOpenChange={onOpenChange} title={KEY_MAP_TITLE} />
          <div ref={inner} {...stylex.props(styles.contents)}>
            {body}
          </div>
        </>
      )}
    </Dialog>
  );
}

/**
 * The key map's keys, `?` and `Space ?`, and the map they open, for the shell to declare and draw.
 * It lists the keys of where the focus is as it opens: a click on the hint keeps the focus there.
 */
export function useKeyMap(): { bindings: Array<Binding>; keyMap: ReactNode } {
  const listed = useListed();
  const singleKeys = useSingleKeys();
  const [sections, setSections] = useState<ReadonlyArray<KeySection> | null>(null);
  const open = () =>
    setSections(keyMapSections(listed(), document.activeElement ?? document.body, singleKeys));
  return {
    bindings: [
      // Second in the status line, after the menu: "? keys".
      { hint: "?", hintLabel: "keys", icon: "uraeda:keyboard", keys: "?", label: OPENS, run: open },
      // The same from the menu, which the chord opens with the single keys off.
      { icon: "uraeda:keyboard", keys: "space ?", label: OPENS, run: open },
    ],
    keyMap: <KeyMap onClose={() => setSections(null)} sections={sections} />,
  };
}
