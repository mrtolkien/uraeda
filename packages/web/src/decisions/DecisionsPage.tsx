import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Kbd } from "@astryxdesign/core/Kbd";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useEffect, useRef, useState } from "react";
import { Page } from "../layout/Page.tsx";
import { Panes } from "../layout/Panes.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { ConstitutionRegion } from "./ConstitutionRegion.tsx";
import { DecisionDetail, PrincipleDetail } from "./DecisionDetail.tsx";
import { DecisionList } from "./DecisionList.tsx";
import {
  type Constitution,
  type DecisionDocument,
  type DecisionSort,
  type DecisionSummary,
  type Selection,
  selectionKey,
  sortDecisions,
} from "./model.ts";

type Props = {
  constitution: Constitution;
  decisions: Array<DecisionSummary>;
  /** Each decision's content by its slug: what its pane draws past its summary. */
  documents: Record<string, DecisionDocument>;
  /** What is open at first; in the app, from the URL. */
  initialSelection?: Selection;
  initialSort?: DecisionSort;
};

/** Whether a key press belongs to a field or a control's own keys, never to the page's shortcuts. */
function isOwnKeys(target: EventTarget | null): boolean {
  const element = target as Element | null;
  return (
    typeof element?.closest === "function" &&
    element.closest(
      'input, textarea, [contenteditable="true"], [role="combobox"], [role="listbox"], [role="dialog"]',
    ) !== null
  );
}

/** The page's items in their drawn order: the principles, then the decisions as sorted. */
function itemsOf(constitution: Constitution, decisions: Array<DecisionSummary>): Array<Selection> {
  return [
    ...constitution.principles.map((one): Selection => ({
      kind: "principle",
      numeral: one.numeral,
    })),
    ...decisions.map((one): Selection => ({ kind: "decision", slug: one.slug })),
  ];
}

/** Focuses an item by its key, the row or card itself, once it is drawn. */
function focusItem(key: string) {
  const item = document.querySelector<HTMLElement>(`[data-item="${key}"]`);
  const target =
    item?.querySelector<HTMLElement>('a, button, [role="button"], [tabindex="0"]') ?? item;
  target?.focus();
  target?.scrollIntoView({ block: "nearest" });
}

/**
 * ↑ ↓ or j k move the selection through every item, opening each in the pane; Esc closes it.
 * Never while a field or a control's own keys have the focus.
 */
function useItemKeys(items: Array<Selection>, selection: Selection | undefined, select: Select) {
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.defaultPrevented || event.altKey || event.ctrlKey || event.metaKey) {
        return;
      }
      if (isOwnKeys(event.target)) {
        return;
      }
      if (event.key === "Escape" && selection) {
        event.preventDefault();
        select(undefined);
        return;
      }
      const step = { ArrowDown: 1, ArrowUp: -1, j: 1, k: -1 }[event.key];
      if (step === undefined || items.length === 0) {
        return;
      }
      event.preventDefault();
      const at = selection
        ? items.findIndex((one) => selectionKey(one) === selectionKey(selection))
        : -1;
      const next = at === -1 ? (step > 0 ? 0 : items.length - 1) : at + step;
      const item = items[Math.max(0, Math.min(items.length - 1, next))];
      select(item, true);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [items, selection, select]);
}

type Select = (selection: Selection | undefined, byKeys?: boolean) => void;

/** Words between keys of the hint. */
function words(text: string) {
  return (
    <Text color="secondary" type="supporting">
      {text}
    </Text>
  );
}

/** The keys of the page, shown once under its title. */
function KeyHint() {
  return (
    <HStack align="center" gap={1} wrap="wrap">
      <Kbd keys="up" />
      <Kbd keys="down" />
      {words("or")}
      <Kbd keys="j" />
      <Kbd keys="k" />
      {words("to move ·")}
      <Kbd keys="esc" />
      {words("to close")}
    </HStack>
  );
}

/** What the pane draws for a selection: a principle, or a decision. */
function Detail({
  constitution,
  decisions,
  documents,
  selection,
}: Pick<Props, "constitution" | "decisions" | "documents"> & { selection: Selection }) {
  if (selection.kind === "principle") {
    const principle = constitution.principles.find((one) => one.numeral === selection.numeral);
    return principle && <PrincipleDetail principle={principle} version={constitution.version} />;
  }
  const decision = decisions.find((one) => one.slug === selection.slug);
  return decision && <DecisionDetail decision={decision} document={documents[decision.slug]} />;
}

/**
 * The constitution and the decisions, read-only: the principles first, then every decision in the
 * chosen order. An item opens in a pane beside them on wide screens, and as its own page on narrow
 * ones, with a way back.
 */
export function DecisionsPage({
  constitution,
  decisions,
  documents,
  initialSelection,
  initialSort = "latest-first",
}: Props) {
  const wide = useWidthClass() === "wide";
  const [sort, setSort] = useState<DecisionSort>(initialSort);
  const [selection, setSelection] = useState<Selection | undefined>(initialSelection);
  const focusNext = useRef<string | undefined>(undefined);
  const sorted = sortDecisions(decisions, sort);
  const items = itemsOf(constitution, sorted);
  const select: Select = (next, byKeys = false) => {
    focusNext.current = byKeys && next ? selectionKey(next) : undefined;
    setSelection(next);
  };
  useItemKeys(items, selection, select);
  useEffect(() => {
    if (focusNext.current) {
      focusItem(focusNext.current);
      focusNext.current = undefined;
    }
  }, [selection]);
  const list = (
    <Page>
      <VStack gap={6}>
        <VStack gap={2}>
          <Heading level={1}>Constitution and decisions</Heading>
          {wide && <KeyHint />}
        </VStack>
        <ConstitutionRegion
          constitution={constitution}
          onOpen={(numeral) => select({ kind: "principle", numeral })}
          selected={selection?.kind === "principle" ? selection.numeral : undefined}
        />
        <DecisionList
          decisions={sorted}
          onOpen={(slug) => select({ kind: "decision", slug })}
          onSort={setSort}
          selected={selection?.kind === "decision" ? selection.slug : undefined}
          sort={sort}
        />
      </VStack>
    </Page>
  );
  const detail = selection && (
    <Page>
      <VStack gap={4}>
        {!wide && (
          <HStack>
            <Button
              icon={<Icon icon="chevronLeft" />}
              label="Constitution and decisions"
              onClick={() => select(undefined)}
              variant="ghost"
            />
          </HStack>
        )}
        <Detail
          constitution={constitution}
          decisions={decisions}
          documents={documents}
          selection={selection}
        />
      </VStack>
    </Page>
  );
  return <Panes detail={detail} list={list} onCloseDetail={() => select(undefined)} />;
}
