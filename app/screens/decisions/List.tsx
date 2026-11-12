// The ledger's list: the decisions check while one waits, the constitution, then every decision in
// the order chosen on this device, each a card. It is the side stack's pane: beside the reader on a
// wide window, its cursor moves the reader with it, in the same visit; Enter then takes the focus
// to the reader. On a phone, where one pane shows at a time, Enter or a tap opens the reader.
import { computed, effect, signal, untracked, View } from "nsh";
import { entry, keep, navigate, positions, redirect, route } from "../../store";
import type { Decision, Ledger } from "../../store/protocol";
import { Banner, Button, iconNamed, Select, Spinner, Text } from "../../ui/controls";
import { KeyPicker, type PickerItem, registerKey } from "../../ui/keys";
import { definePane, focus, placeOf, sync, usePane } from "../../ui/layout";
import { Card, type CardFact, createCursor, Empty, VirtualList } from "../../ui/lists";
import { isNarrow } from "../../ui/width";
import { branched, changesIt } from "./Branches";
import { ErrandButton } from "./Errand";
import {
  CHECK,
  CONSTITUTION,
  checkWords,
  chooseSort,
  type DecisionSort,
  decisionId,
  ledgerOf,
  routeOf,
  rowOf,
  ruleCount,
  shortDate,
  SORTS,
  sorted,
  sortChosen,
  statusWords,
} from "./ledger";

/** The rows' ids in the list's order. */
function idsOf(ledger: Ledger, sort: DecisionSort): Array<string> {
  return [
    ...(ledger.decisionsCheck === null ? [] : [CHECK]),
    CONSTITUTION,
    ...sorted(ledger.decisions, sort).map((decision) => decisionId(decision.name)),
  ];
}

/**
 * Opens a row: on a phone, its page, in a visit of its own; beside the reader, the reader shows it
 * and takes the focus, in this visit, so Back leaves the decisions as a whole.
 */
function open(row: string) {
  const to = routeOf(row);
  if (isNarrow()) {
    navigate(to);
    return;
  }
  if (rowOf(route()) !== row) {
    redirect(to);
  }
  const place = placeOf(route());
  const reader = place.main[0];
  const layout = entry().kept.layout;
  if (reader !== undefined && layout !== undefined) {
    keep({ layout: focus(sync(layout, place), reader.key) });
  }
}

/** A decision's card: its icon, its title, its state unless active, its rules, its last change. */
function DecisionCard(props: {
  decision: Decision;
  repo: string;
  selected: boolean;
  onPress: () => void;
}) {
  const proposed = () =>
    branched(props.repo).filter(
      (feature) => changesIt(props.repo, feature.folder, props.decision.name) !== false,
    ).length;
  const facts = (): Array<CardFact> => {
    const decision = props.decision;
    return [
      ...(proposed() > 0
        ? [
            {
              icon: "git-branch" as const,
              label: `A change proposed on ${proposed()} branch${proposed() === 1 ? "" : "es"}`,
              tone: "caution" as const,
            },
          ]
        : []),
      ...(decision.rules.length > 0
        ? [{ icon: "list-checks" as const, label: ruleCount(decision.rules.length) }]
        : []),
      ...(decision.changed === null
        ? []
        : [{ icon: "history" as const, label: `Changed ${shortDate(decision.changed)}` }]),
    ];
  };
  const state = () => {
    const status = statusWords(props.decision);
    return status.label === "Active" ? undefined : { label: status.label, tone: status.tone };
  };
  return (
    <Card
      body={
        <If when={props.decision.summary}>{(summary) => <Text tone="quiet">{summary()}</Text>}</If>
      }
      facts={facts()}
      icon={iconNamed(props.decision.icon)}
      onPress={props.onPress}
      selected={props.selected}
      state={state()}
      testID={`decision-${props.decision.name}`}
      title={props.decision.title}
    />
  );
}

/** One row, as its id says: the check's card, the constitution's, or a decision's. */
function Row(props: {
  id: string;
  ledger: Ledger;
  repo: string;
  selected: boolean;
  onPress: () => void;
}) {
  const decision = () => props.ledger.decisions.find((one) => decisionId(one.name) === props.id);
  const principles = () => props.ledger.constitution?.principles.length ?? 0;
  return (
    <View style={{ paddingBottom: 8 }}>
      <If when={props.id === CHECK}>
        <Card
          icon="message-circle-question"
          onPress={props.onPress}
          selected={props.selected}
          state={checkWords(props.ledger.decisionsCheck)}
          title="Decisions check"
          who="An agent's questions about the decisions"
        />
      </If>
      <If when={props.id === CONSTITUTION}>
        <Card
          facts={
            props.ledger.constitution === null
              ? [
                  {
                    icon: "triangle-alert",
                    label: "specs/CONSTITUTION.md is missing",
                    tone: "caution",
                  },
                ]
              : [
                  {
                    icon: "list-checks",
                    label: `${principles()} principle${principles() === 1 ? "" : "s"}, highest first`,
                  },
                ]
          }
          icon="book-open"
          onPress={props.onPress}
          selected={props.selected}
          title={props.ledger.constitution?.title ?? "Constitution"}
          who="Above every decision"
        />
      </If>
      <If when={decision()}>
        {(shown) => (
          <DecisionCard
            decision={shown()}
            onPress={props.onPress}
            repo={props.repo}
            selected={props.selected}
          />
        )}
      </If>
    </View>
  );
}

/** What the picker lists: the constitution, its principles, then the decisions. */
function pickerItems(ledger: Ledger, sort: DecisionSort): Array<PickerItem> {
  const principles = (ledger.constitution?.principles ?? []).map((principle) => ({
    id: `p:${principle.slug}`,
    mark: principle.number,
    summary: "A principle of the constitution",
    title: principle.title,
  }));
  return [
    {
      id: CONSTITUTION,
      mark: "§",
      summary: "The constitution, whole",
      title: ledger.constitution?.title ?? "Constitution",
    },
    ...principles,
    ...sorted(ledger.decisions, sort).map((decision) => ({
      id: decisionId(decision.name),
      summary: decision.summary,
      title: decision.title,
    })),
  ];
}

/** Above the cards: Jump, and the order, on one row: in a narrow pane, Jump is its key and icon. */
function Tools(props: { count: number; noCheck: boolean; onJump: () => void; repo: string }) {
  const pane = usePane();
  // The order's own key, as Tab draws no focus on GTK: `o` opens its list.
  let order: (() => void) | undefined;
  registerKey({
    hint: "o",
    hintLabel: "order",
    keys: "o",
    label: "Change the order of the decisions",
    run: () => order?.(),
  });
  return (
    <View style={{ gap: 8, paddingBottom: 10 }}>
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Button
          compact={pane.width() === "narrow"}
          icon="search"
          keys="/"
          label="Jump to…"
          onPress={props.onJump}
        />
        <Select
          icon="history"
          label="Order of the decisions"
          onChange={(next: DecisionSort) => chooseSort(next)}
          opener={(opens) => {
            order = opens;
          }}
          options={SORTS}
          value={sortChosen()}
        />
      </View>
      <If when={props.noCheck}>
        <ErrandButton errand="check-decisions" repo={props.repo} />
      </If>
      <Text size="under" tone="faint">
        {`${props.count} decision${props.count === 1 ? "" : "s"} on the default branch`}
      </Text>
    </View>
  );
}

/** How many times `/` asked, from a reader beside the list, for its Jump to… picker. */
const jumpAsked = signal(0);

/**
 * Opens the decisions' Jump to… picker from a pane beside the list: `/` searches the page's list
 * wherever the focus is on the page, as the keyboard guide's `/` says.
 */
export const askJump = () => jumpAsked.update((asked) => asked + 1);

function LedgerList(props: { repo: string }) {
  const pane = usePane();
  const ledger = ledgerOf(props.repo);
  const jumping = signal(false);
  let seen = untracked(jumpAsked);
  effect(() => {
    const asked = jumpAsked();
    if (asked === seen) return;
    seen = asked;
    jumping.set(true);
  });
  // One object per id, kept: the list matches its rows by identity.
  const made = new Map<string, { id: string }>();
  const rows = computed(() => {
    const read = ledger();
    return read === undefined
      ? []
      : idsOf(read, sortChosen()).map((id) => made.get(id) ?? made.set(id, { id }).get(id)!);
  });
  const cursor = createCursor(rows, { initial: untracked(() => rowOf(route())) });
  // The page shown moves the cursor, as a link or Back does: the row it is about.
  effect(() => {
    const row = rowOf(route());
    if (row !== untracked(cursor.at)) {
      untracked(() => cursor.set(row, { reveal: true }));
    }
  });
  // A key's move, beside the reader: the reader follows, in this visit.
  effect(() => {
    const moved = cursor.reveal();
    if (moved !== undefined && !untracked(isNarrow) && rowOf(untracked(route)) !== moved.id) {
      untracked(() => redirect(routeOf(moved.id)));
    }
  });
  const kept = positions();
  const place = `${pane.key}:list`;
  return (
    <If
      when={ledger()}
      else={
        <If when={ledger.error()} else={<Spinner label="Reading the decisions" />}>
          {(error) => (
            <Banner title="The decisions could not be read" tone="danger">
              <Text>{error().message}</Text>
            </Banner>
          )}
        </If>
      }
    >
      {(read) => (
        <>
          <VirtualList
            cursor={cursor}
            footer={
              <If when={read().decisions.length === 0}>
                <Empty
                  icon="scale"
                  title="No decisions yet"
                  words="specs/decisions/ holds none on the default branch. A feature's spec proposes them, and they come here once it merges."
                />
              </If>
            }
            framed={false}
            header={
              <Tools
                count={read().decisions.length}
                noCheck={read().decisionsCheck === null}
                onJump={() => jumping.set(true)}
                repo={props.repo}
              />
            }
            offset={kept.at(place)}
            onOffset={(offset) => kept.keep(place, offset)}
            onOpen={open}
            openLabel="read"
            row={(id) => (
              <Row
                id={id()}
                ledger={read()}
                onPress={() => {
                  cursor.set(id());
                  open(id());
                }}
                repo={props.repo}
                selected={cursor.holds(id())}
              />
            )}
            rowHeight={96}
            testID="decisions-list"
          />
          <KeyPicker
            items={pickerItems(read(), sortChosen())}
            onClose={() => jumping.set(false)}
            onPick={(item) =>
              navigate(item.id.startsWith("p:") ? { page: "constitution" } : routeOf(item.id))
            }
            open={jumping()}
            placeholder="Find a decision or a principle…"
            start={rowOf(route())}
            title="Jump to…"
          />
        </>
      )}
    </If>
  );
}

export const listPane = definePane<{ repo: string }>({
  icon: "scale",
  kind: "decisions-list",
  mark: ({ repo }) => ({ count: ledgerOf(repo)()?.decisions.length }),
  stack: "side",
  title: "Decisions",
  view: (props) => <LedgerList repo={props.args.repo} />,
});
