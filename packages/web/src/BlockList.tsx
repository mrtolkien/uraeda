import { colorVars, fontWeightVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { Block, Span } from "uraeda-binding";
import type { BlockContext } from "./Blocks.tsx";
import { isNarrow, useWidthClass } from "./layout/useWidthClass.ts";
import { markVars } from "./marks.stylex.ts";
import { proseStyles } from "./Prose.tsx";
import { Selectable } from "./Selection.tsx";
import { sentences } from "./sentences.ts";
import { SinceWords } from "./sinceMarks.tsx";
import { Spans } from "./Spans.tsx";

/** The sign a typed item shows, by its kind. */
const SIGNS: Record<string, string> = {
  ask: "?",
  con: "−",
  important: "!",
  note: "&",
  pro: "+",
  question: "?",
  warning: "⚠",
};

/** A list's styles, its items' too, shared with an item drawn alone (see `Blocks`). */
export const listStyles = stylex.create({
  con: { color: colorVars["--color-error"] },
  // A typed item's sign as its marker, in its colour and bold.
  conMarker: {
    "::marker": {
      color: colorVars["--color-error"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  disc: { listStyleType: "disc" },
  // On narrow screens, a dash, the narrowest marker, which hangs in the page's margin, close to its
  // text: a quarter of an em after it.
  dashed: { listStyleType: '"- "' },
  // On narrow screens, the markers hang in the page's margin, as far as its inset allows: the
  // text of a list on the paragraphs' edge when the inset holds the markers' whole room.
  hanging: (room: string) => ({
    // The room as a property of its own, as the token lint takes a `var()` only whole, not in a
    // calc.
    "--list-hanging": `max(0px, calc(${room} - var(--page-inset, ${spacingVars["--spacing-3"]})))`,
    paddingInlineStart: "var(--list-hanging)",
  }),
  important: { color: colorVars["--color-warning"] },
  importantMarker: {
    "::marker": {
      color: colorVars["--color-warning"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  item: {
    // A list item's room under it, but the last's, and its marker in the secondary colour.
    "::marker": { color: colorVars["--color-text-secondary"] },
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-2"] },
    whiteSpace: "normal",
  },
  list: {
    // A list's margin, but last in its item or callout, which end with it.
    marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-3"] },
  },
  // A list, the browser's: its markers in `room` before its items' text, outside it, so that a
  // wrapped line hangs under the text, not under the marker.
  native: (room: string) => ({
    listStylePosition: "outside",
    marginBlockStart: 0,
    paddingInlineStart: room,
  }),
  numbered: { listStyleType: "decimal" },
  plainSignMarker: { "::marker": { fontWeight: fontWeightVars["--font-weight-bold"] } },
  pro: { color: colorVars["--color-success"] },
  proMarker: {
    "::marker": {
      color: colorVars["--color-success"],
      fontWeight: fontWeightVars["--font-weight-bold"],
    },
  },
  // A typed item's sign in a numbered list, after its number, in its colour and bold.
  sign: {
    fontWeight: fontWeightVars["--font-weight-bold"],
    minWidth: spacingVars["--spacing-4"],
  },
  // A typed item's marker: its sign, in place of the list's bullet.
  signMarker: (sign: string) => ({ listStyleType: sign }),
  // An item's other sentences, a list under its first, closer together than the items.
  split: { marginBlockEnd: 0, marginBlockStart: spacingVars["--spacing-1"] },
  splitItem: { marginBlockEnd: { ":last-child": 0, default: spacingVars["--spacing-1"] } },
  warning: { color: colorVars["--color-warning"] },
});

/** Each typed item's sign's colour, by its kind. */
const SIGN_STYLES: Record<string, stylex.StyleXStyles> = {
  con: listStyles.con,
  important: listStyles.important,
  pro: listStyles.pro,
  warning: listStyles.warning,
};

/** Each typed item's marker style, its sign's colour, by its kind; bold for every kind. */
const SIGN_MARKERS: Record<string, stylex.StyleXStyles> = {
  ask: listStyles.plainSignMarker,
  con: listStyles.conMarker,
  important: listStyles.importantMarker,
  note: listStyles.plainSignMarker,
  pro: listStyles.proMarker,
  question: listStyles.plainSignMarker,
  task: listStyles.plainSignMarker,
  warning: listStyles.importantMarker,
};

/** The sign a typed bullet or a task item shows in place of its marker. */
function signOf(block: Block) {
  const marker = block.marker ?? "plain";
  if (marker === "task") {
    return block.checked ? "☑" : "☐";
  }
  return marker in SIGNS ? SIGNS[marker] : undefined;
}

/**
 * A list as the page's text draws it: the browser's own `<ul>` or `<ol>`, whose markers sit on the
 * baseline of their item's first line at any size and line height, the item's wrapped lines hanging
 * under its text. A bullet is a disc, a dash on narrow screens, where the markers hang in the
 * page's margin; a typed item's marker is its sign, in its colour, after its number in a numbered
 * list. `nested` draws what an item holds under its text: its blocks.
 */
export function ListNode({
  block,
  context,
  nested,
}: {
  block: Block;
  context: BlockContext;
  nested: (item: Block) => ReactNode;
}) {
  const items = context.children.get(block.id) ?? [];
  const isHanging = isNarrow(useWidthClass());
  const parent = block.parent === undefined ? undefined : context.document.blocks[block.parent];
  const isNested = parent?.kind === "item";
  const Tag = block.ordered ? "ol" : "ul";
  const digits = String((block.start ?? 1) + Math.max(items.length - 1, 0)).length;
  // The markers' room: a bullet's, or the longest number's with its dot.
  const room = block.ordered
    ? `calc(${digits}ch + ${markVars["--mark-list-room"]})`
    : markVars["--mark-list-room"];
  return (
    <Tag
      {...(block.ordered && (block.start ?? 1) !== 1 ? { start: block.start } : {})}
      {...stylex.props(
        listStyles.list,
        listStyles.native(room),
        block.ordered ? listStyles.numbered : isHanging ? listStyles.dashed : listStyles.disc,
        isHanging && !isNested && listStyles.hanging(room),
      )}
    >
      {items.map((item) => {
        const marker = item.marker ?? "plain";
        const sign = signOf(item);
        const isSignMarker = sign !== undefined && !block.ordered;
        return (
          <li
            key={item.id}
            {...stylex.props(
              proseStyles.reading,
              listStyles.item,
              isSignMarker && listStyles.signMarker(`"${sign} "`),
              isSignMarker && SIGN_MARKERS[marker],
            )}
          >
            <Selectable block={item} isInList selection={context.selection}>
              <div>
                {sign !== undefined && block.ordered && (
                  <span aria-hidden="true" {...stylex.props(listStyles.sign, SIGN_STYLES[marker])}>
                    {sign}{" "}
                  </span>
                )}
                <SinceWords block={item}>
                  <ItemText
                    isHanging={isHanging}
                    spans={item.spans}
                    splits={context.splitsItems === true}
                  />
                </SinceWords>
                {nested(item)}
              </div>
            </Selectable>
          </li>
        );
      })}
    </Tag>
  );
}

/**
 * A list item's text: its first sentence, then, with `splits`, each of its other sentences a
 * bullet under it, so a point of several reads as its claim and its reasons.
 */
function ItemText({
  isHanging,
  spans,
  splits,
}: {
  isHanging: boolean;
  spans: ReadonlyArray<Span>;
  splits: boolean;
}) {
  const [first, ...others] = splits ? sentences(spans) : [spans];
  return (
    <>
      <Spans spans={first ?? []} />
      {others.length > 0 && (
        <ul
          {...stylex.props(
            listStyles.native(markVars["--mark-list-room"]),
            isHanging ? listStyles.dashed : listStyles.disc,
            listStyles.split,
          )}
        >
          {others.map((sentence, index) => (
            <li
              key={index}
              {...stylex.props(proseStyles.reading, listStyles.item, listStyles.splitItem)}
            >
              <Spans spans={sentence} />
            </li>
          ))}
        </ul>
      )}
    </>
  );
}
