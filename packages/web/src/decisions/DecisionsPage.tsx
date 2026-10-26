// The constitution and decisions page (US8, and US4 of the layout look), read-only: the list, the
// active pane, holds the principles, then every decision in the chosen order; the reader beside it
// is always open on wide and semi-wide screens, on the whole constitution until a decision is
// picked. On narrow ones, the reader replaces the list once an item is picked, with a way back.
// The keys move through the principles, then the decisions, the reader following (`useListKeys`);
// `/` or "Jump to…" opens a palette that finds any of them (`JumpPalette`).

import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { useHotkeys } from "@astryxdesign/core/hooks";
import { Icon } from "@astryxdesign/core/Icon";
import { Kbd } from "@astryxdesign/core/Kbd";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { use, useState } from "react";
import type { Ledger } from "uraeda-server/fate";
import { useAgent, useLedger, useWorkspace } from "../data.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { Pane } from "../layout/Pane.tsx";
import { Panes } from "../layout/Panes.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { isNarrow, useWidthClass } from "../layout/useWidthClass.ts";
import { ListPaneContext } from "../lists/listPane.ts";
import { useListKeys } from "../lists/useListKeys.ts";
import { useRepoPath, useRestoreScroll } from "../routes.tsx";
import { useStartChat } from "../StartChat.tsx";
import { useStatusHints } from "../statusHints.tsx";
import { ConstitutionReader } from "./ConstitutionReader.tsx";
import { ConstitutionRegion } from "./ConstitutionRegion.tsx";
import { DecisionDetail } from "./DecisionDetail.tsx";
import { DecisionList } from "./DecisionList.tsx";
import { CheckButton, CheckMessage, DecisionsCheckBanner } from "./DecisionsCheckBanner.tsx";
import { JumpPalette } from "./JumpPalette.tsx";
import { jumpEntries } from "./jump.ts";
import { type DecisionSort, type LedgerDecision, sortDecisions, useDecisionSort } from "./model.ts";
import { NoSpecs } from "../layout/Missing.tsx";

const styles = stylex.create({
  column: {
    // The list's column on wide screens: the reader's pane beside it has the same inset.
    paddingBlock: spacingVars["--spacing-3"],
    paddingInlineStart: spacingVars["--spacing-2"],
  },
});

/** What is open in the reader: a decision by its file name, or a principle by its slug. */
export type LedgerOpen = { kind: "decision"; name: string } | { kind: "principle"; slug: string };

/** The ledger, as the page reads it. */
type LedgerData = Pick<Ledger, "constitution" | "decisions" | "decisionsCheck">;

/** The address of each item, in the page's order: the principles, then the decisions as sorted. */
function itemPaths(ledger: LedgerData, decisions: ReadonlyArray<LedgerDecision>): Array<string> {
  return [
    ...(ledger.constitution?.principles ?? []).map(
      (principle) => `/decisions/constitution/${principle.slug}`,
    ),
    ...decisions.map((decision) => `/decisions/${decision.name}`),
  ];
}

/**
 * The address of the item the reader is at: what is open, else the first principle, for the
 * reader starts on the constitution; none without one.
 */
function shownPath(ledger: LedgerData, open: LedgerOpen | undefined): string | undefined {
  if (open) {
    return open.kind === "decision"
      ? `/decisions/${open.name}`
      : `/decisions/constitution/${open.slug}`;
  }
  const first = ledger.constitution?.principles[0];
  return first && `/decisions/constitution/${first.slug}`;
}

/** The principle the list marks: the one open, else the first while the constitution is read. */
function markedPrinciple(ledger: LedgerData, open: LedgerOpen | undefined): string | undefined {
  if (open) {
    return open.kind === "principle" ? open.slug : undefined;
  }
  return ledger.constitution?.principles[0]?.slug;
}

/**
 * Whether a key pressed on `target` belongs to a layer: a dialog, a menu, or an open Selector, or
 * any part of them, owns its keys while it holds the focus, and a modal dialog while open. An
 * expanded disclosure, as the rail's logo, owns none: only a popup's owner does.
 */
function inLayer(target: EventTarget | null) {
  const layer =
    'dialog, [role="dialog"], [role="listbox"], [role="menu"], ' +
    '[aria-haspopup][aria-expanded="true"], [role="combobox"][aria-expanded="true"]';
  return (
    ((target as Partial<Element> | null)?.closest?.(layer) ?? null) !== null ||
    document.querySelector("dialog[open]") !== null
  );
}

/**
 * The palette's state, opened by "Jump to…" or by `/` anywhere on the page but in a text field or
 * an open layer, as the sort menu, whose keys are their own.
 */
function useJump() {
  const [isJumping, setJumping] = useState(false);
  useStatusHints([{ keys: "/", label: "jump" }]);
  useHotkeys([
    {
      isDisabled: isJumping,
      keys: "/",
      onPress: (event: KeyboardEvent) => {
        if (!inLayer(event.target)) {
          setJumping(true);
        }
      },
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
  ledger,
  onSort,
  open,
  paths,
  sort,
}: {
  decisions: ReadonlyArray<LedgerDecision>;
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
    // On wide screens the reader follows the selection; without it, only the focus moves.
    onSelect: (index) => pane?.follow(here(paths[index])),
    selected: paths.indexOf(shown ?? ""),
  });
  return (
    <Pane isActive level={1} title="Constitution and decisions">
      <VStack gap={4}>
        <HStack align="center" gap={3} wrap="wrap">
          <Button
            aria-keyshortcuts="/"
            endContent={<Kbd keys="/" />}
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
            <ConstitutionRegion
              constitution={ledger.constitution}
              selected={markedPrinciple(ledger, open)}
            />
            <DecisionList
              decisions={decisions}
              onSort={onSort}
              selected={open?.kind === "decision" ? open.name : undefined}
              sort={sort}
            />
          </VStack>
        </div>
      </VStack>
      <JumpPalette
        constitution={ledger.constitution}
        entries={jumpEntries(ledger, decisions)}
        isOpen={jump.isJumping}
        onClose={jump.close}
      />
    </Pane>
  );
}

/** What the reader draws: a decision, or the whole constitution, at a principle or its top. */
function ReaderBody({ ledger, open }: { ledger: LedgerData; open: LedgerOpen | undefined }) {
  const { constitution } = ledger;
  if (open?.kind === "decision") {
    const decision = ledger.decisions.find((one) => one.name === open.name);
    return decision ? <DecisionDetail decision={decision} /> : <Paragraph>Nothing here.</Paragraph>;
  }
  return constitution ? (
    <ConstitutionReader
      constitution={constitution}
      slug={open?.kind === "principle" ? open.slug : undefined}
    />
  ) : (
    <Paragraph>There is no constitution to read: specs/CONSTITUTION.md is missing.</Paragraph>
  );
}

/**
 * The reader's pane, named by the file it shows: on narrow screens, the way back to the list, and
 * the previous and next items of the list.
 */
function Reader({
  ledger,
  onClose,
  open,
  paths,
}: {
  ledger: LedgerData;
  onClose: (() => void) | undefined;
  open: LedgerOpen | undefined;
  paths: ReadonlyArray<string>;
}) {
  const here = useRepoPath();
  const narrow = isNarrow(useWidthClass());
  const shown = shownPath(ledger, open);
  const index = shown === undefined ? -1 : paths.indexOf(shown);
  const previous = index > 0 ? paths[index - 1] : undefined;
  const next = paths[index + 1];
  const step = (label: "Next" | "Previous", path: string | undefined) => (
    <Button
      href={path && here(path)}
      icon={<Icon icon={label === "Next" ? "chevronRight" : "chevronLeft"} />}
      isDisabled={path === undefined}
      isIconOnly
      label={label}
      variant="ghost"
    />
  );
  const file =
    open?.kind === "decision" ? `specs/decisions/${open.name}.md` : "specs/CONSTITUTION.md";
  return (
    <Pane title={file}>
      <Page>
        <VStack gap={4}>
          <HStack align="center" gap={1} justify="between" wrap="wrap">
            {narrow && onClose ? (
              <Button
                icon={<Icon icon="chevronLeft" />}
                label="Constitution and decisions"
                onClick={onClose}
                variant="ghost"
              />
            ) : (
              <span />
            )}
            <HStack gap={1}>
              {step("Previous", previous)}
              {step("Next", next)}
            </HStack>
          </HStack>
          <ReaderBody ledger={ledger} open={open} />
        </VStack>
      </Page>
    </Pane>
  );
}

/**
 * The constitution and the decisions, the reader beside them on wide and semi-wide screens, on
 * `open` or the constitution; on narrow ones, the list, or `open` alone with a way back, `onClose`.
 */
export function DecisionsPage({ onClose, open }: { onClose?: () => void; open?: LedgerOpen }) {
  const workspace = useWorkspace();
  const ledger = useLedger();
  const narrow = isNarrow(useWidthClass());
  const [sort, setSort] = useDecisionSort();
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(ledger !== null && ledger !== undefined);
  if (!workspace || !ledger) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <Page>
        <NoSpecs path={workspace.noSpecs} />
      </Page>
    );
  }
  const decisions = sortDecisions(ledger.decisions, sort);
  const paths = itemPaths(ledger, decisions);
  const list = (
    <LedgerList
      decisions={decisions}
      ledger={ledger}
      onSort={setSort}
      open={open}
      paths={paths}
      sort={sort}
    />
  );
  return (
    <Panes
      detail={
        narrow && !open ? undefined : (
          <Reader ledger={ledger} onClose={onClose} open={open} paths={paths} />
        )
      }
      detailKey={shownPath(ledger, open)}
      list={narrow ? <Page>{list}</Page> : <div {...stylex.props(styles.column)}>{list}</div>}
      listWidth="var(--size-ledger-list)"
    />
  );
}
