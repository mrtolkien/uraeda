// The reader: a decision of the default branch, or the constitution, each one document, drawn by
// the document renderer at the reading measure, under a head that says what it is and whether it
// is in force, and why. Each is a pane of the main stack, the widest, beside the list.
import { type JSX, View } from "nsh";
import { navigate } from "../../store";
import type { Block, Decision, Document as Tree } from "../../store/protocol";
import {
  Banner,
  Button,
  Heading,
  Icon,
  iconNamed,
  Spinner,
  StatusDot,
  Text,
} from "../../ui/controls";
import { Document } from "../../ui/document";
import { definePane, PaneScroll } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { Proposals } from "./Branches";
import { decisionIn, ledgerOf, ruleCount, shortDate, statusWords } from "./ledger";
import { follow } from "./links";

/** The blocks of a document's top level, its title aside: the pane's head says it. */
export const pastTitle = (tree: Tree) =>
  tree.blocks
    .filter((block: Block) => block.parent === null)
    .filter((block) => !(block.kind === "heading" && block.level === 1))
    .map((block) => block.id);

/** The reader's column: its head and its document, at the measure, centred in a wide pane. */
export function Column(props: { children?: JSX.Element }) {
  return (
    <PaneScroll style={{ flex: 1 }}>
      <View
        style={{
          alignSelf: "center",
          gap: 16,
          maxWidth: tokens.type.measure * tokens.type.prose,
          paddingBottom: 48,
          width: "100%",
        }}
      >
        {props.children}
      </View>
    </PaneScroll>
  );
}

/** A title beside its icon. */
export function Title(props: { icon: string | null; title: string }) {
  return (
    <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
      <Icon name={iconNamed(props.icon)} size={22} />
      <Heading level={1} style={{ flex: 1 }}>
        {props.title}
      </Heading>
    </View>
  );
}

/** While the ledger is read, or why it could not be. */
export function Reading(props: { error: string | undefined }) {
  return (
    <If when={props.error} else={<Spinner label="Reading the decisions" />}>
      {(error) => (
        <Banner title="The decisions could not be read" tone="danger">
          <Text>{error()}</Text>
        </Banner>
      )}
    </If>
  );
}

/** A decision's head: its title, its status with its cause, its rules, and its last change. */
function Head(props: { decision: Decision }) {
  const status = () => statusWords(props.decision);
  const facts = () =>
    [
      props.decision.rules.length > 0 ? ruleCount(props.decision.rules.length) : undefined,
      props.decision.changed === null
        ? undefined
        : `last changed ${shortDate(props.decision.changed)} on the default branch`,
    ].filter((fact) => fact !== undefined);
  return (
    <View style={{ gap: 6 }}>
      <Title icon={props.decision.icon} title={props.decision.title} />
      <StatusDot label={`${status().label}: ${status().why}`} tone={status().tone} />
      <If when={facts().length > 0}>
        <Text tone="faint">{facts().join(" · ")}</Text>
      </If>
    </View>
  );
}

/** A decision as the default branch has it. */
function DecisionReader(props: { name: string; repo: string }) {
  const ledger = ledgerOf(props.repo);
  const decision = () => decisionIn(ledger(), props.name);
  return (
    <Column>
      <If when={decision() !== undefined} else={<Reading error={ledger.error()?.message} />}>
        <If
          when={decision()}
          else={
            <Empty
              action={{ label: "The constitution", run: () => navigate({ page: "constitution" }) }}
              icon="scale"
              title={`No decision named “${props.name}”`}
              words={`specs/decisions/${props.name}.md is not on the default branch: it was renamed or removed, or a feature's branch adds it and has not merged.`}
            />
          }
        >
          {(shown) => (
            <>
              <Head decision={shown()} />
              <If when={shown().problem}>
                {(problem) => (
                  <Banner
                    title={
                      shown().unreadable ? "This file can't be read" : "ura check finds a problem"
                    }
                    tone={shown().unreadable ? "danger" : "caution"}
                  >
                    <Text>{problem()}</Text>
                  </Banner>
                )}
              </If>
              <Proposals name={props.name} repo={props.repo} />
              <Document
                document={shown().document}
                ids={pastTitle(shown().document)}
                onLink={(link) => follow(link)}
              />
            </>
          )}
        </If>
      </If>
    </Column>
  );
}

export const decisionPane = definePane<{ name: string; repo: string }>({
  icon: "file-text",
  kind: "decision",
  stack: "main",
  title: ({ name, repo }) => decisionIn(ledgerOf(repo)(), name)?.title ?? name,
  view: (props) => <DecisionReader name={props.args.name} repo={props.args.repo} />,
});

/** "Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14", of the fields it has. */
function versionLine(constitution: {
  amended: string | null;
  ratified: string | null;
  version: string | null;
}) {
  return [
    constitution.version && `Version ${constitution.version}`,
    constitution.ratified && `Ratified ${constitution.ratified}`,
    constitution.amended && `Last amended ${constitution.amended}`,
  ]
    .filter(Boolean)
    .join(" · ");
}

/** The constitution, one file read top to bottom. */
function ConstitutionReader(props: { repo: string }) {
  const ledger = ledgerOf(props.repo);
  return (
    <Column>
      <If when={ledger()} else={<Reading error={ledger.error()?.message} />}>
        {(read) => (
          <If
            when={read().constitution}
            else={
              <Empty
                icon="book-open"
                title="No constitution yet"
                words="specs/CONSTITUTION.md is not on the default branch. The workflow's setup writes one: ask an agent to set up specs/."
              />
            }
          >
            {(constitution) => (
              <>
                <View style={{ gap: 6 }}>
                  <Title icon="book-open" title={constitution().title} />
                  <If when={versionLine(constitution())}>
                    {(line) => <Text tone="faint">{line()}</Text>}
                  </If>
                </View>
                <Document
                  document={constitution().document}
                  ids={pastTitle(constitution().document)}
                  onLink={(link) => follow(link)}
                />
              </>
            )}
          </If>
        )}
      </If>
    </Column>
  );
}

export const constitutionPane = definePane<{ repo: string }>({
  icon: "book-open",
  kind: "constitution",
  stack: "main",
  title: "Constitution",
  view: (props) => <ConstitutionReader repo={props.args.repo} />,
});

/** The way back to the decision in force, from a branch's version or a check. */
export function ToDecision(props: { label: string; name: string }) {
  return (
    <View style={{ alignItems: "flex-start" }}>
      <Button
        icon="arrow-left"
        label={props.label}
        onPress={() => navigate({ name: props.name, page: "decision" })}
      />
    </View>
  );
}
