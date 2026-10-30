// The constitution and decisions page (US8, and US4 of the layout look), read-only: the list, the
// active pane, holds the principles, then every decision in the chosen order; the reader beside it
// is always open on wide and semi-wide screens, on the whole constitution until a decision is
// picked. On narrow ones, the reader replaces the list once an item is picked, with a way back.
// The keys move through the principles, then the decisions, the reader following (`useListKeys`);
// `/` or "Jump to…" opens the key picker over any of them (`KeyPicker`).
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Kbd } from "@astryxdesign/core/Kbd";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, use, useRef, useState } from "react";
import type { Ledger } from "uraeda-server/fate";
import { useAgent, useLedger } from "../data.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Panes } from "../layout/Panes.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { ListPaneContext } from "../lists/listPane.ts";
import { useListKeys } from "../lists/useListKeys.ts";
import { KeyPicker } from "../keys/KeyPicker.tsx";
import { useKeys, useSingleKeys } from "../keys/registry.tsx";
import { navigateHere, useRepoPath, useRestoreScroll } from "../routes.tsx";
import { NavTile, NavTiles } from "../layout/NavBar.tsx";
import { TopBarSlot } from "../layout/TopBarSlot.tsx";
import { useStartChat } from "../StartChat.tsx";
import { ConstitutionReader } from "./ConstitutionReader.tsx";
import { ConstitutionRegion } from "./ConstitutionRegion.tsx";
import { DecisionDetail } from "./DecisionDetail.tsx";
import { DecisionList } from "./DecisionList.tsx";
import { CheckButton, CheckMessage, DecisionsCheckBanner } from "./DecisionsCheckBanner.tsx";
import { jumpEntries, pickerItemOf } from "./jump.ts";
import { useSplit } from "./useSplit.ts";
import { proseStyles, READING_MEASURE } from "../Prose.tsx";
import { type DecisionSort, type LedgerDecision, sortDecisions, useDecisionSort } from "./model.ts";
import { WithSpecs } from "../layout/Missing.tsx";
import { Empty } from "../layout/Empty.tsx";

/** The list's column, about 40 characters a line at least, 60 at most, with its pane's inset. */
const LIST_LEAST = `calc(40ch + 2 * ${spacingVars["--spacing-6"]})`;
const LIST_MOST = `calc(60ch + 2 * ${spacingVars["--spacing-6"]})`;
/**
 * The reader's column, about 60 characters of prose a line at least, with its inset at its least,
 * to 80 with its whole inset.
 */
const READER_LEAST = `calc(0.75 * ${READING_MEASURE} + 2 * ${spacingVars["--spacing-4"]})`;
const READER_MOST = `calc(${READING_MEASURE} + 2 * (${spacingVars["--spacing-8"]} + ${spacingVars["--spacing-4"]}))`;
/**
 * The reader's inset: its whole, `--spacing-8`, in a pane with room for 80 characters and it; less,
 * down to `--spacing-4`, in a narrower one, the text keeping the room.
 */
const READER_INSET = `clamp(${spacingVars["--spacing-4"]}, calc((100% - ${READING_MEASURE}) / 2), ${spacingVars["--spacing-8"]})`;
/** Both least columns, and the reader's pane's inset: past it, they stand side by side. */
const TWO_LEAST = `calc(${LIST_LEAST} + ${READER_LEAST} + 2 * ${spacingVars["--spacing-2"]})`;

const styles = stylex.create({
  column: {
    // The list's column on wide screens: the reader's pane beside it has the same inset.
    paddingBlock: spacingVars["--spacing-3"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
  // The page's room, which `useSplit` measures.
  room: { position: "relative" },
  // The two columns' least widths together, unseen: past them, the list and the reader side by
  // side, about 40 characters a line in the list and 60 in the reader.
  least: (width: string) => ({
    position: "absolute",
    visibility: "hidden",
    width,
  }),
  // The reader alone on a wider screen than the phone's: its text at the reading measure, as in
  // its pane beside the list.
  alone: { marginInline: "auto" },
  // The reader's text in its pane, side by side with the list: its inset, not a page's column.
  reader: (inset: string) => ({
    paddingBlock: spacingVars["--spacing-6"],
    paddingInline: inset,
  }),
});

/** What is open in the reader: a decision by its file name, or the constitution, one page. */
export type LedgerOpen = { kind: "decision"; name: string } | { kind: "constitution" };

/** The constitution's one address: each of its principles' rows opens it. */
const CONSTITUTION = "/decisions/constitution";

/** The ledger, as the page reads it. */
type LedgerData = Pick<Ledger, "constitution" | "decisions" | "decisionsCheck">;

/** The address of each item, in the page's order: the principles, then the decisions as sorted. */
function itemPaths(ledger: LedgerData, decisions: ReadonlyArray<LedgerDecision>): Array<string> {
  return [
    ...(ledger.constitution?.principles ?? []).map(() => CONSTITUTION),
    ...decisions.map((decision) => `/decisions/${decision.name}`),
  ];
}

/**
 * The address of the item the reader is at: what is open, else the constitution, which the reader
 * starts on; none without one.
 */
function shownPath(ledger: LedgerData, open: LedgerOpen | undefined): string | undefined {
  if (open?.kind === "decision") {
    return `/decisions/${open.name}`;
  }
  return ledger.constitution ? CONSTITUTION : undefined;
}

/**
 * The picker's state, opened by "Jump to…" or by `/` anywhere on the page: the registry leaves it
 * to the page outside a text field and a layer, as the sort menu, whose keys are their own.
 */
function useJump() {
  const [isJumping, setJumping] = useState(false);
  useKeys([
    {
      hint: "/",
      icon: "search",
      keys: "/",
      label: "jump",
      run: () => setJumping(true),
    },
  ]);
  return { close: () => setJumping(false), isJumping, open: () => setJumping(true) };
}

/**
 * The list's pane: "Jump to…" and the check, then the constitution's principles, then the
 * decisions.
 */
function LedgerList({
  decisions,
  isSplit,
  ledger,
  onSort,
  open,
  paths,
  sort,
}: {
  decisions: ReadonlyArray<LedgerDecision>;
  /** Whether the reader is beside the list. */
  isSplit: boolean;
  ledger: LedgerData;
  onSort: (sort: DecisionSort) => void;
  open: LedgerOpen | undefined;
  paths: ReadonlyArray<string>;
  sort: DecisionSort;
}) {
  const here = useRepoPath();
  const pane = use(ListPaneContext);
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const check = ledger.decisionsCheck;
  const shown = shownPath(ledger, open);
  const jump = useJump();
  // `/` is a letter key: with the switch off it names no key (the button still opens the palette).
  // Hinted on wide screens only: the phone hints no key.
  const narrow = isNarrow(useWidthClass());
  const singleKeys = useSingleKeys() && !narrow;
  const { ref } = useListKeys({
    // What Escape does, on the status line: back to the constitution, or nothing when it shows.
    escapeLabel: open && pane ? "constitution" : null,
    // The reader stays open: Escape takes it back to the constitution, from anything else.
    onClose: () => {
      if (!open || !pane) {
        return false;
      }
      pane.close();
      return true;
    },
    // Nothing here is edited: Enter opens the row.
    onEdit: () => false,
    // Beside the list, the reader follows the selection; without it, only the focus moves.
    onSelect: (index) => (isSplit ? pane?.follow(here(paths[index])) : undefined),
    selected: paths.indexOf(shown ?? ""),
  });
  return (
    <ListFrame>
      <VStack gap={4}>
        <HStack align="center" gap={3} wrap="wrap">
          <Button
            aria-keyshortcuts={singleKeys ? "/" : undefined}
            endContent={singleKeys ? <Kbd keys="/" /> : undefined}
            icon={<Icon icon="search" />}
            label="Jump to…"
            onClick={jump.open}
            variant="secondary"
          />
          {agent ? <CheckButton chat={chat} check={check} /> : check === null && <CheckMessage />}
        </HStack>
        {check !== null && <DecisionsCheckBanner agent={agent} chat={chat} status={check} />}
        {chat.error && <AnnouncedBanner collapsible={false} status="error" title={chat.error} />}
        <div ref={ref}>
          <VStack gap={6}>
            <ConstitutionRegion constitution={ledger.constitution} />
            <DecisionList
              decisions={decisions}
              onSort={onSort}
              selected={open?.kind === "decision" ? open.name : undefined}
              sort={sort}
            />
          </VStack>
        </div>
      </VStack>
      <KeyPicker
        isOpen={jump.isJumping}
        items={jumpEntries(ledger, decisions).map(pickerItemOf)}
        label="Jump to a decision or principle"
        onClose={jump.close}
        onPick={(item) => navigateHere(item.path)}
        placeholder="Find a decision…"
        title="Jump to…"
      />
    </ListFrame>
  );
}

/**
 * The list's frame: its pane on wide and semi-wide screens; on the phone, where it is the whole
 * page, no pane, its content alone.
 */
function ListFrame({ children }: { children: ReactNode }) {
  const narrow = isNarrow(useWidthClass());
  return narrow ? (
    <section aria-label="Constitution and decisions">{children}</section>
  ) : (
    <Pane isActive level={1} title="Constitution and decisions">
      {children}
    </Pane>
  );
}

/** What the reader draws: a decision, or the whole constitution, at a principle or its top. */
function ReaderBody({ ledger, open }: { ledger: LedgerData; open: LedgerOpen | undefined }) {
  const { constitution } = ledger;
  if (open?.kind === "decision") {
    const decision = ledger.decisions.find((one) => one.name === open.name);
    return decision ? <DecisionDetail decision={decision} /> : <Empty>Nothing here.</Empty>;
  }
  return constitution ? (
    <ConstitutionReader constitution={constitution} />
  ) : (
    <Paragraph>There is no constitution to read: specs/CONSTITUTION.md is missing.</Paragraph>
  );
}

/**
 * The reader: beside the list, a pane named by the file it shows, the list's keys stepping through
 * it. Alone, a page: on the phone, its bottom bar goes back to the list and, on a decision, steps
 * to the previous and the next; on a wider screen, a way back above it.
 */
function Reader({
  isSplit,
  ledger,
  onClose,
  open,
  paths,
}: {
  isSplit: boolean;
  ledger: LedgerData;
  onClose: (() => void) | undefined;
  open: LedgerOpen | undefined;
  paths: ReadonlyArray<string>;
}) {
  const narrow = isNarrow(useWidthClass());
  const shown = shownPath(ledger, open);
  const index = shown === undefined ? -1 : paths.indexOf(shown);
  const file =
    open?.kind === "decision" ? `specs/decisions/${open.name}.md` : "specs/CONSTITUTION.md";
  if (isSplit) {
    return (
      <Pane title={file}>
        <div {...stylex.props(styles.reader(READER_INSET))}>
          <ReaderBody ledger={ledger} open={open} />
        </div>
      </Pane>
    );
  }
  return (
    <Page kind="rows">
      <div {...stylex.props(!narrow && [styles.alone, proseStyles.measure])}>
        {narrow ? (
          <ReaderBar
            onClose={onClose}
            {...(open?.kind === "decision"
              ? { steps: { next: paths[index + 1], previous: paths[index - 1] } }
              : {})}
          />
        ) : (
          onClose && (
            <Button
              icon={<Icon icon="chevronLeft" />}
              label="Constitution and decisions"
              onClick={onClose}
              variant="ghost"
            />
          )
        )}
        <ReaderBody ledger={ledger} open={open} />
      </div>
    </Page>
  );
}

/**
 * On the phone, the reader's bottom bar: the list, back to the constitution and decisions, at its
 * start; on a decision, `steps`, the previous and the next item, each dimmed at the list's ends.
 * The constitution, read top to bottom, has none.
 */
function ReaderBar({
  onClose,
  steps,
}: {
  onClose: (() => void) | undefined;
  steps?: { next: string | undefined; previous: string | undefined };
}) {
  return (
    <TopBarSlot>
      <NavTiles label="The constitution and decisions">
        <NavTile
          icon="uraeda:list"
          isDisabled={onClose === undefined}
          label="Constitution and decisions"
          onPress={() => onClose?.()}
        />
        {steps && (
          <NavTile
            icon="chevronLeft"
            isDisabled={steps.previous === undefined}
            label="Previous"
            onPress={() => steps.previous && navigateHere(steps.previous)}
          />
        )}
        {steps && (
          <NavTile
            icon="chevronRight"
            isDisabled={steps.next === undefined}
            label="Next"
            onPress={() => steps.next && navigateHere(steps.next)}
          />
        )}
      </NavTiles>
    </TopBarSlot>
  );
}

/**
 * The constitution and the decisions, the reader beside them where the list has about 40 characters a
 * line and the reader 60 (`useSplit`), on `open` or the constitution, the two centred together; narrower, the list,
 * or `open` alone with a way back, `onClose`.
 */
export function DecisionsPage(props: { onClose?: () => void; open?: LedgerOpen }) {
  // Without specs/, there is no ledger to read.
  return (
    <WithSpecs>
      <Ledger {...props} />
    </WithSpecs>
  );
}

/** The decisions page of a repository with `specs/`. */
function Ledger({ onClose, open }: { onClose?: () => void; open?: LedgerOpen }) {
  const ledger = useLedger();
  const room = useRef<HTMLDivElement>(null);
  const least = useRef<HTMLDivElement>(null);
  const isSplit = useSplit(room, least);
  const [sort, setSort] = useDecisionSort();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(ledger !== null && ledger !== undefined);
  if (!ledger) {
    return null;
  }
  const decisions = sortDecisions(ledger.decisions, sort);
  const paths = itemPaths(ledger, decisions);
  const list = (
    <LedgerList
      decisions={decisions}
      isSplit={isSplit}
      ledger={ledger}
      onSort={setSort}
      open={open}
      paths={paths}
      sort={sort}
    />
  );
  return (
    <div ref={room} {...stylex.props(styles.room)}>
      <div aria-hidden="true" ref={least} {...stylex.props(styles.least(TWO_LEAST))} />
      <Panes
        // The reader grows first, to its 80 characters, then the list takes the rest, to its own.
        columns={`minmax(${LIST_LEAST}, 1fr) minmax(${READER_LEAST}, ${READER_MOST})`}
        detail={
          !isSplit && !open ? undefined : (
            <Reader isSplit={isSplit} ledger={ledger} onClose={onClose} open={open} paths={paths} />
          )
        }
        detailKey={shownPath(ledger, open)}
        isSplit={isSplit}
        list={
          isSplit ? (
            <div {...stylex.props(styles.column)}>{list}</div>
          ) : (
            <Page kind="rows">{list}</Page>
          )
        }
        most={`calc(${LIST_MOST} + ${READER_MOST})`}
      />
    </div>
  );
}
