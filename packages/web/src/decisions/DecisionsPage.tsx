// The constitution and decisions page (US8), read-only: the principles first, as cards, then every
// decision in the chosen order. An item opens in a pane beside them on wide screens, and as its own
// page on narrow ones; the keys move through the principles, then the decisions, the pane
// following (see `useListKeys`).
import { Banner } from "@astryxdesign/core/Banner";
import { Button } from "@astryxdesign/core/Button";
import { Heading } from "@astryxdesign/core/Heading";
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { VStack } from "@astryxdesign/core/VStack";
import { use } from "react";
import type { Ledger } from "uraeda-server/fate";
import { useAgent, useLedger, useWorkspace } from "../data.ts";
import { useStartChat } from "../StartChat.tsx";
import { CheckButton, CheckMessage, DecisionsCheckBanner } from "./DecisionsCheckBanner.tsx";
import { Page } from "../layout/Page.tsx";
import { Panes } from "../layout/Panes.tsx";
import { Paragraph } from "../layout/Paragraph.tsx";
import { useWidthClass } from "../layout/useWidthClass.ts";
import { ListPaneContext } from "../lists/listPane.ts";
import { useListKeys } from "../lists/useListKeys.ts";
import { useRepoPath, useRestoreScroll } from "../routes.tsx";
import { ConstitutionRegion } from "./ConstitutionRegion.tsx";
import { DecisionDetail, PrincipleDetail } from "./DecisionDetail.tsx";
import { DecisionList } from "./DecisionList.tsx";
import { type LedgerDecision, sortDecisions, useDecisionSort } from "./model.ts";

/** What is open in the pane: a decision by its file name, or a principle by its slug. */
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

/** The address of what is open. */
function openPath(open: LedgerOpen | undefined): string | undefined {
  if (!open) {
    return undefined;
  }
  return open.kind === "decision"
    ? `/decisions/${open.name}`
    : `/decisions/constitution/${open.slug}`;
}

/** The list: the title, the constitution's region, then the decisions, under one keyboard. */
function LedgerList({ ledger, open }: { ledger: LedgerData; open: LedgerOpen | undefined }) {
  const here = useRepoPath();
  const pane = use(ListPaneContext);
  const [sort, setSort] = useDecisionSort();
  const agent = useAgent()?.available === true;
  const chat = useStartChat();
  const check = ledger.decisionsCheck;
  const decisions = sortDecisions(ledger.decisions, sort);
  const paths = itemPaths(ledger, decisions);
  const { ref } = useListKeys({
    onClose: () => {
      pane?.close();
      return pane !== null;
    },
    // Nothing here is edited: Enter opens the row.
    onEdit: () => false,
    // On wide screens the pane follows the selection; without a pane, only the focus moves.
    onSelect: (index) => pane?.follow(here(paths[index])),
    selected: paths.indexOf(openPath(open) ?? ""),
  });
  return (
    <Page>
      <VStack gap={6}>
        <HStack align="center" gap={3} justify="between" wrap="wrap">
          <Heading level={1}>Constitution and decisions</Heading>
          {agent && <CheckButton chat={chat} check={check} />}
        </HStack>
        {!agent && check === null && <CheckMessage />}
        {check !== null && <DecisionsCheckBanner agent={agent} chat={chat} status={check} />}
        {chat.error && <Banner collapsible={false} status="error" title={chat.error} />}
        <div ref={ref}>
          <VStack gap={6}>
            <ConstitutionRegion
              constitution={ledger.constitution}
              selected={open?.kind === "principle" ? open.slug : undefined}
            />
            <DecisionList
              decisions={decisions}
              onSort={setSort}
              selected={open?.kind === "decision" ? open.name : undefined}
              sort={sort}
            />
          </VStack>
        </div>
      </VStack>
    </Page>
  );
}

/** What the pane draws for what is open: a principle, or a decision. */
function LedgerDetail({ ledger, open }: { ledger: LedgerData; open: LedgerOpen }) {
  const { constitution } = ledger;
  if (open.kind === "principle") {
    const principle = constitution?.principles.find((one) => one.slug === open.slug);
    return constitution && principle ? (
      <PrincipleDetail constitution={constitution} principle={principle} />
    ) : (
      <Paragraph>Nothing here.</Paragraph>
    );
  }
  const decision = ledger.decisions.find((one) => one.name === open.name);
  return decision ? <DecisionDetail decision={decision} /> : <Paragraph>Nothing here.</Paragraph>;
}

/**
 * The constitution and the decisions, with `open` beside them on wide screens, or alone on narrow
 * ones with a way back; `onClose` closes it.
 */
export function DecisionsPage({ onClose, open }: { onClose?: () => void; open?: LedgerOpen }) {
  const workspace = useWorkspace();
  const ledger = useLedger();
  const wide = useWidthClass() === "wide";
  // Its data is read before it draws: the position comes back at once.
  useRestoreScroll(ledger !== null && ledger !== undefined);
  if (!workspace || !ledger) {
    return null;
  }
  if (workspace.noSpecs) {
    return (
      <Page>
        <Banner
          status="warning"
          title={`No specs/ folder in ${workspace.noSpecs}. Set Uraeda up with ura init.`}
        />
      </Page>
    );
  }
  const detail = open && (
    <Page>
      <VStack gap={4}>
        {!wide && onClose && (
          <HStack>
            <Button
              icon={<Icon icon="chevronLeft" />}
              label="Constitution and decisions"
              onClick={onClose}
              variant="ghost"
            />
          </HStack>
        )}
        <LedgerDetail ledger={ledger} open={open} />
      </VStack>
    </Page>
  );
  return (
    <Panes
      detail={detail}
      detailKey={openPath(open)}
      list={<LedgerList ledger={ledger} open={open} />}
      onCloseDetail={onClose}
    />
  );
}
