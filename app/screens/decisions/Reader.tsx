// The reader: a decision of the default branch, or the constitution, each one document, drawn by
// the document renderer at the reading measure, under a head that says what it is and whether it
// is in force, and why. Each is a pane of the main stack, the widest, beside the list.
import { effect, type JSX, untracked, View } from "nsh";
import { navigate, positions, route } from "../../store";
import type { Block, Decision, Document as Tree } from "../../store/protocol";
import {
  Banner,
  Button,
  Heading,
  Icon,
  iconNamed,
  Link,
  Spinner,
  StatusDot,
  Text,
} from "../../ui/controls";
import { type DocumentHands, DocumentScroll, type DocumentScrollRef } from "../../ui/document";
import { registerKey } from "../../ui/keys";
import { askJump } from "./List";
import { definePane, PaneScroll, usePane } from "../../ui/layout";
import { Empty } from "../../ui/lists";
import { tokens } from "../../ui/tokens";
import { isNarrow } from "../../ui/width";
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

/**
 * A document of the decisions' panes, scrolled by its blocks under its head, as a workflow file's:
 * its place kept in the visit, and the heading the address names, `#heading`, brought to the top
 * as the page opens and as a link changes it.
 */
export function Scroll(
  props: Pick<DocumentHands, "mark" | "onLink"> & {
    document: Tree;
    footer?: JSX.Element;
    header: JSX.Element;
    /** The file of the default branch it shows, which `Space b` opens as a buffer. */
    path?: string;
  },
) {
  const pane = usePane();
  const path = props.path;
  // The list's `/`, from the reading: the Jump to… picker over the page.
  registerKey({ keys: "/", label: "Jump to a decision…", run: askJump });
  if (path !== undefined) {
    registerKey({
      icon: "file-pen-line",
      keys: "space b",
      label: "Open as a buffer",
      run: () => navigate({ page: "buffer", path }),
    });
  }
  const kept = positions();
  const name = `${pane.key}:document`;
  const opened = kept.at(name);
  let scroll: DocumentScrollRef | undefined;
  effect(() => {
    const hash = route().hash;
    if (hash !== undefined && hash !== "") untracked(() => scroll?.toAnchor(hash));
  });
  return (
    <DocumentScroll
      document={props.document}
      footer={props.footer}
      header={
        <View style={{ gap: 16 }}>
          {props.header}
          {/* `Space b`'s tap, on a phone, which has no keys: the decision in the editor. */}
          <If when={isNarrow() ? path : undefined}>
            {(file) => (
              <Link alone onPress={() => navigate({ page: "buffer", path: file() })}>
                Edit this decision
              </Link>
            )}
          </If>
        </View>
      }
      ids={pastTitle(props.document)}
      mark={props.mark}
      offset={opened}
      onLink={props.onLink}
      onOffset={(offset) => kept.keep(name, offset)}
      ref={(ref) => {
        scroll = ref;
        const hash = untracked(route).hash;
        if (opened === undefined && hash !== undefined && hash !== "") ref.toAnchor(hash);
      }}
    />
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
    <If
      when={decision() !== undefined}
      else={
        <Column>
          <Reading error={ledger.error()?.message} />
        </Column>
      }
    >
      <If
        when={decision()}
        else={
          <Column>
            <Empty
              action={{ label: "The constitution", run: () => navigate({ page: "constitution" }) }}
              icon="scale"
              title={`No decision named “${props.name}”`}
              words={`specs/decisions/${props.name}.md is not on the default branch: it was renamed or removed, or a feature's branch adds it and has not merged.`}
            />
          </Column>
        }
      >
        {(shown) => (
          <Scroll
            document={shown().document}
            header={
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
              </>
            }
            onLink={(link) => follow(link)}
            path={`specs/decisions/${props.name}.md`}
          />
        )}
      </If>
    </If>
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
    <If
      when={ledger()}
      else={
        <Column>
          <Reading error={ledger.error()?.message} />
        </Column>
      }
    >
      {(read) => (
        <If
          when={read().constitution}
          else={
            <Column>
              <Empty
                icon="book-open"
                title="No constitution yet"
                words="specs/CONSTITUTION.md is not on the default branch. The workflow's setup writes one: ask an agent to set up specs/."
              />
            </Column>
          }
        >
          {(constitution) => (
            <Scroll
              document={constitution().document}
              header={
                <View style={{ gap: 6 }}>
                  <Title icon="book-open" title={constitution().title} />
                  <If when={versionLine(constitution())}>
                    {(line) => <Text tone="faint">{line()}</Text>}
                  </If>
                </View>
              }
              onLink={(link) => follow(link)}
              path="specs/CONSTITUTION.md"
            />
          )}
        </If>
      )}
    </If>
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
