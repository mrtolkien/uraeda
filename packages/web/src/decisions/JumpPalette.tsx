// The decisions page's palette (US4 3 of the layout look): a search over the constitution's
// principles and the decisions, grouped so, with the entry under the cursor previewed beside the
// list on wide and semi-wide screens. Astryx's `CommandPalette` draws the search and the list, inline
// in a dialog of our own, so the preview can sit beside them: an Astryx gap (plan, Complexity
// tracking), for the palette has no preview slot. A part in its footer reads the cursor from the
// palette's context, puts it on the first result after each letter, so Enter opens it, and lifts
// it to the preview (rulings R1 and R28). On narrow screens it is a sheet, its list
// alone. Opening it adds a history entry, so Back closes it.
import { BottomSheet } from "@astryxdesign/core/BottomSheet";
import {
  CommandPalette,
  CommandPaletteFooter,
  CommandPaletteInput,
  useCommandPaletteContext,
} from "@astryxdesign/core/CommandPalette";
import { Dialog } from "@astryxdesign/core/Dialog";
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
} from "@astryxdesign/core/theme/tokens.stylex";
import type { SearchableItem, SearchSource } from "@astryxdesign/core/Typeahead";
import * as stylex from "@stylexjs/stylex";
import { useEffect, useEffectEvent, useMemo, useRef, useState } from "react";
import { Blocks } from "../Blocks.tsx";
import { afterOverlayCloses } from "../layout/Overlay.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useBackCloses } from "../layout/useBackCloses.ts";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { navigateHere } from "../routes.tsx";
import { decisionIcon } from "../theme/icons.ts";
import { DecisionRules } from "./DecisionRules.tsx";
import { type LedgerConstitution, ruleCount, rulesOf } from "./ConstitutionRegion.tsx";
import { type JumpEntry, searchEntries } from "./jump.ts";

/** The palette's name, and its history entry's. */
const LABEL = "Jump to…";

/** How many of a decision's rules the preview shows. */
const FIRST_RULES = 3;

const styles = stylex.create({
  body: {
    display: "grid",
    gridTemplateColumns: "var(--size-palette-list) minmax(0, 1fr)",
    maxHeight: "var(--size-palette-height)",
    minHeight: 0,
  },
  list: {
    // The palette's own surface would read as a card inside the dialog.
    boxShadow: "none",
    // As wide as the sheet or the dialog's column: Astryx's dialog also keeps a gutter from the
    // window's edges, which inside the phone's sheet left a strip on its right.
    maxWidth: "100%",
    minWidth: 0,
  },
  mark: {
    color: colorVars["--color-text-secondary"],
    display: "inline-flex",
    fontWeight: fontWeightVars["--font-weight-semibold"],
    minWidth: spacingVars["--spacing-6"],
  },
  preview: {
    borderInlineStartColor: colorVars["--color-border"],
    borderInlineStartStyle: "solid",
    borderInlineStartWidth: borderVars["--border-width"],
    maxHeight: "var(--size-palette-height)",
    minWidth: 0,
    overflowY: "auto",
    paddingBlock: spacingVars["--spacing-4"],
    paddingInline: spacingVars["--spacing-5"],
  },
});

/** An entry as the palette's list holds it: its address is its id, its group its heading. */
type JumpItem = SearchableItem<{ entry: JumpEntry; group: string }>;

const toItem = (entry: JumpEntry): JumpItem => ({
  auxiliaryData: { entry, group: entry.kind === "principle" ? "Constitution" : "Decisions" },
  id: entry.path,
  label: entry.title,
});

/** A principle's numeral, or a decision's icon, in one column. */
function Mark({ entry }: { entry: JumpEntry }) {
  return (
    <span {...stylex.props(styles.mark)}>
      {entry.kind === "principle" ? (
        entry.principle.number
      ) : (
        <Icon icon={decisionIcon(entry.decision.icon)} size="sm" />
      )}
    </span>
  );
}

/**
 * The palette's footer, its keys, which also follows the cursor: it puts it on the first result
 * when a search left none, and tells `onCursor` the entry under it. When the entries change while
 * it is open, as a decision is committed, it runs the search again, for the palette searches only
 * as it opens and as a letter is typed.
 */
function CursorFooter({
  onCursor,
  source,
}: {
  onCursor: (path: string | undefined) => void;
  source: SearchSource<JumpItem>;
}) {
  const palette = useCommandPaletteContext();
  const searched = useRef(source);
  const searchAgain = useEffectEvent(() => palette?.setSearch(palette.search));
  useEffect(() => {
    if (searched.current !== source) {
      searched.current = source;
      searchAgain();
    }
  }, [source]);
  const index = palette?.highlightedIndex ?? -1;
  const items = palette?.selectableItems ?? [];
  const setHighlighted = palette?.setHighlightedIndex;
  const count = items.length;
  const path = items[index]?.value;
  useEffect(() => {
    if (index === -1 && count > 0) {
      setHighlighted?.(0);
    }
  }, [count, index, setHighlighted]);
  useEffect(() => {
    onCursor(path);
  }, [onCursor, path]);
  return <CommandPaletteFooter />;
}

/** A principle's rules, as the reader draws them: the lists under its heading. */
function PrincipleRules({
  constitution,
  entry,
}: {
  constitution: LedgerConstitution;
  entry: Extract<JumpEntry, { kind: "principle" }>;
}) {
  const { blocks } = constitution.document;
  const lists = entry.principle.blocks.filter((id) => blocks[id]?.kind === "list");
  return <Blocks document={constitution.document} ids={lists} />;
}

/** The entry under the cursor: its title, its first sentence, and its first rules. */
function Preview({
  constitution,
  entry,
}: {
  constitution: LedgerConstitution | null;
  entry: JumpEntry | undefined;
}) {
  if (!entry) {
    return <section aria-label="Preview" {...stylex.props(styles.preview)} />;
  }
  const rules =
    entry.kind === "principle"
      ? constitution
        ? rulesOf(constitution, entry.principle).length
        : 0
      : entry.decision.rules.length;
  const more = entry.kind === "decision" ? rules - FIRST_RULES : 0;
  return (
    <section aria-label="Preview" {...stylex.props(styles.preview)}>
      <VStack gap={3}>
        <VStack gap={1}>
          <HStack align="center" gap={2}>
            <Mark entry={entry} />
            <Heading level={2}>{entry.title}</Heading>
          </HStack>
          <Text color="secondary" type="supporting">
            {entry.kind === "principle" ? "Constitution" : "Decision"} · {ruleCount(rules)}
          </Text>
        </VStack>
        {entry.kind === "decision" && entry.decision.summary && (
          <Paragraph>{entry.decision.summary}</Paragraph>
        )}
        {entry.kind === "decision" ? (
          <DecisionRules parts={entry.decision.rules.slice(0, FIRST_RULES)} />
        ) : (
          constitution && <PrincipleRules constitution={constitution} entry={entry} />
        )}
        {more > 0 && (
          <Text color="secondary" type="supporting">
            and {more} more · ⏎ to open
          </Text>
        )}
      </VStack>
    </section>
  );
}

/** The palette's search and list, inline, its cursor told to `onCursor`. */
function Search({
  entries,
  maxHeight,
  onCursor,
  onJump,
  onOpenChange,
}: {
  entries: ReadonlyArray<JumpEntry>;
  /** The palette's height at most: the dialog's, or the sheet's whole. */
  maxHeight: string;
  onCursor: (path: string | undefined) => void;
  onJump: (path: string) => void;
  onOpenChange: (open: boolean) => void;
}) {
  const field = useRef<HTMLInputElement>(null);
  // The page builds the entries again at each render: they are kept until their content changes,
  // and the source with them.
  const signature = JSON.stringify(entries);
  const [kept, setKept] = useState({ entries, signature });
  if (kept.signature !== signature) {
    setKept({ entries, signature });
  }
  const source = useMemo<SearchSource<JumpItem>>(
    () => ({
      bootstrap: () => kept.entries.map(toItem),
      search: (query: string) => searchEntries(kept.entries, query).map(toItem),
    }),
    [kept],
  );
  // Inline, the palette leaves the focus where it is: the dialog around it is what opened.
  useEffect(() => {
    const frame = requestAnimationFrame(() => field.current?.focus());
    return () => cancelAnimationFrame(frame);
  }, []);
  return (
    <CommandPalette<JumpItem>
      emptySearchText="Nothing matches."
      footer={<CursorFooter onCursor={onCursor} source={source} />}
      input={
        <CommandPaletteInput
          label="Jump to a decision or principle"
          placeholder="Find a decision…"
          ref={field}
        />
      }
      isInline
      isOpen
      label="Principles and decisions"
      maxHeight={maxHeight}
      onOpenChange={onOpenChange}
      onValueChange={onJump}
      renderItem={(item: JumpItem) => (
        <HStack align="center" gap={2}>
          {item.auxiliaryData && <Mark entry={item.auxiliaryData.entry} />}
          <span>{item.label}</span>
        </HStack>
      )}
      role="group"
      searchSource={source}
      width="100%"
      xstyle={styles.list}
    />
  );
}

/**
 * The palette over the decisions page while `isOpen`: Enter or a tap on an entry opens it,
 * Escape, Back, or a tap outside closes it, `onClose`.
 */
export function JumpPalette({
  constitution,
  entries,
  isOpen,
  onClose,
}: {
  constitution: LedgerConstitution | null;
  entries: ReadonlyArray<JumpEntry>;
  isOpen: boolean;
  onClose: () => void;
}) {
  const narrow = isNarrow(useWidthClass());
  const [cursor, setCursor] = useState<string>();
  const close = useBackCloses(LABEL, isOpen, onClose);
  // Escape reaches the palette's field and the dialog's both: the first closes it.
  const closing = useRef(false);
  useEffect(() => {
    closing.current = !isOpen;
  }, [isOpen]);
  const onOpenChange = (open: boolean) => {
    if (!open && !closing.current) {
      closing.current = true;
      close();
    }
  };
  // The entry opens once the palette's history entry is gone, which Back would otherwise undo.
  const onJump = (path: string) => afterOverlayCloses(LABEL, () => navigateHere(path));
  const search = isOpen && (
    <Search
      entries={entries}
      maxHeight={narrow ? "100%" : "var(--size-palette-height)"}
      onCursor={setCursor}
      onJump={onJump}
      onOpenChange={onOpenChange}
    />
  );
  if (narrow) {
    return (
      <BottomSheet
        height="tall"
        isOpen={isOpen}
        label={LABEL}
        onOpenChange={onOpenChange}
        padding={0}
      >
        {search}
      </BottomSheet>
    );
  }
  return (
    <Dialog
      aria-label={LABEL}
      isOpen={isOpen}
      maxHeight="var(--size-palette-height)"
      onOpenChange={onOpenChange}
      padding={0}
      width="var(--size-palette)"
    >
      {search && (
        <div {...stylex.props(styles.body)}>
          {search}
          <Preview
            constitution={constitution}
            entry={entries.find((entry) => entry.path === cursor)}
          />
        </div>
      )}
    </Dialog>
  );
}
