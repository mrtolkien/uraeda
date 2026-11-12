// A row of the transcript. Native Shell's list reuses a row's cell for any other row, of any kind,
// so every row is one structure (`specs/ui/components.md`): a line, whose bindings change with the
// row, for a tool's call, a thought, the runner's notice, or a part not read yet; and a body, made
// once for its row, for what has words of its own, a message, the agent's text, or a blocked
// action. A cell bound to another row makes its body again, and only its body.
import { type Accessor, Image, signal, untracked, View } from "nsh";
import { markdownTree } from "uraeda/native";
import { chatImage, serverTime } from "../../store";
import type { Block, Item, Document as Tree } from "../../store/protocol";
import { Icon, Link, Refusal, Text } from "../../ui/controls";
import { Document, Reply, ReplyBlock } from "../../ui/document";
import { tokens } from "../../ui/tokens";
import { OfferCard } from "./Offer";
import { applies, isClosed, offerOf } from "./offers";
import type { Entry, Feed } from "./pages";
import { Permission } from "./Permission";
import { ToolDrawn } from "./ToolDrawn";
import { rendererOf } from "../../extensions/contributions";
import { lineWords, type LineWords } from "./words";

type Of<K extends Item["kind"]> = Extract<Item, { kind: K }>;

/** What a row needs of the session it is in. */
export type RowHands = {
  repo: string;
  session: string;
  /** The session's change or feature, none for a chat. */
  folder: () => string | null;
  /** What it is: a chat, or a change's or a feature's session, which says which offer applies. */
  kind: () => "chat" | "change" | "feature";
  /** The turn whose offer is live: the last, once it ended. */
  offerTurn: () => string | undefined;
  /** How many blocked actions "Allow all" would allow. */
  allowable: () => number;
  working: () => boolean;
  selected: (row: string) => boolean;
  /** Whether the transcript's keys work now: the cursor's bar is lit then, at rest otherwise. */
  lit: () => boolean;
  /** A press, or the pointer moving onto it, moves the cursor to the row. */
  select: (row: string) => void;
  /**
   * Takes back a message the agent has not read, where its agent can, its text back in the
   * composer: none where it cannot. A refusal comes back in words.
   */
  takeBack: (message: Of<"message">) => Promise<string | null>;
  /** Whether its agent takes back a message it has not read. */
  canTakeBack: () => boolean;
};

/** The line a part of the transcript not read yet shows, which its page replaces. */
const WAITING: LineWords = {
  code: false,
  hue: "inkFaint",
  icon: "history",
  ink: "faint",
  meta: "",
  words: "Reading this part of the conversation…",
};

/** The kinds that have a body of their own. */
const BODIED = new Set<Item["kind"]>(["message", "text", "denial"]);

export function TranscriptRow(props: { feed: Feed; hands: RowHands; id: Accessor<string> }) {
  const entry = () => props.feed.entry(props.id());
  const item = () => {
    const shown = entry();
    return shown?.kind === "item" ? shown.item() : undefined;
  };
  // A tool an extension's page draws (`itemRenderer`) has that drawing in place of its line.
  const rendered = () => {
    const shown = item();
    return shown?.kind === "tool" && rendererOf(props.hands.repo, shown.name) !== undefined;
  };
  const line = (): LineWords | undefined => {
    if (entry()?.kind === "waiting") return WAITING;
    const shown = item();
    return shown === undefined || rendered() ? undefined : lineWords(shown);
  };
  const body = () => {
    if (entry()?.kind === "block") return [props.id()];
    const kind = item()?.kind;
    return kind !== undefined && (BODIED.has(kind) || rendered()) ? [props.id()] : [];
  };
  // A reply split into rows reads as one: its blocks' rows have no room between them.
  const padding = (): [number, number] => {
    const shown = entry();
    if (shown?.kind === "block") return [shown.first ? 7 : 0, 0];
    if (item()?.kind !== "text") return [3, 3];
    return [(props.feed.split?.(props.id()) ?? 0) > 0 ? 0 : 7, 7];
  };
  return (
    // The row draws its own selection, a fill and the bar of light at its left edge, as `Row`
    // does, without a view of its own: a fling binds every row of the window on every frame.
    <View
      onMouseMove={() => props.hands.select(props.id())}
      onPress={() => props.hands.select(props.id())}
      style={{
        backgroundColor: props.hands.selected(props.id()) ? tokens.row.selected : undefined,
        borderLeftColor: props.hands.selected(props.id())
          ? props.hands.lit()
            ? tokens.light.focus
            : tokens.row.barRest
          : "transparent",
        borderLeftWidth: tokens.row.bar,
        paddingLeft: tokens.space.panePadding - tokens.row.bar,
        paddingRight: tokens.space.panePadding,
        paddingBottom: padding()[1],
        paddingTop: padding()[0],
      }}
    >
      <View
        style={{
          alignItems: "flex-start",
          display: line() === undefined ? "none" : "flex",
          flexDirection: "row",
          gap: 8,
          minHeight: tokens.space.row - 6,
        }}
      >
        <Icon
          colour={tokens.role[line()?.hue ?? "inkFaint"]}
          name={line()?.icon ?? "info"}
          style={{ marginTop: 4 }}
        />
        <Text
          font={line()?.code === true ? "code" : "body"}
          lines={line()?.code === true ? 2 : undefined}
          style={{ flex: 1, minWidth: 0 }}
          tone={line()?.ink ?? "faint"}
        >
          {line()?.words ?? ""}
        </Text>
        <Text size="under" tone="faint">
          {line()?.meta ?? ""}
        </Text>
      </View>
      <Each of={body()}>
        {(row) => (
          <Body entry={props.feed.entry(row())} feed={props.feed} hands={props.hands} row={row()} />
        )}
      </Each>
    </View>
  );
}

/** What a row of words draws, made once for its row: its kind never changes. */
function Body(props: { entry: Entry | undefined; feed: Feed; hands: RowHands; row: string }) {
  const entry = props.entry;
  if (entry?.kind === "block") {
    return (
      <If when={entry.read()}>
        {(read) => (
          <ReplyBlock
            after={!entry.first}
            align="start"
            override={offerOverride(props.hands, entry.reply, entry.turn)}
            read={read()}
          />
        )}
      </If>
    );
  }
  if (entry?.kind !== "item") return null;
  const kind = entry.item()?.kind;
  if (kind === "tool") {
    return <ToolDrawn item={entry.item as () => Of<"tool">} repo={props.hands.repo} />;
  }
  if (kind === "message") {
    return (
      <Message
        hands={props.hands}
        item={entry.item as () => Of<"message">}
        row={props.row}
        text={entry.text}
      />
    );
  }
  if (kind === "text") {
    return (
      <AgentText
        feed={props.feed}
        hands={props.hands}
        item={entry.item as () => Of<"text">}
        row={props.row}
        text={entry.text}
        turn={entry.turn}
      />
    );
  }
  const denial = entry.item as () => Of<"denial">;
  return (
    <If when={denial()}>
      {(shown) => (
        <Permission
          allowable={props.hands.allowable()}
          denial={shown()}
          repo={props.hands.repo}
          row={props.row}
          selected={props.hands.selected(props.row)}
          session={props.hands.session}
          turn={entry.turn}
          working={props.hands.working()}
        />
      )}
    </If>
  );
}

/** A message to the agent: the human's, or the workflow's, with its opening, images, and time. */
function Message(props: {
  hands: RowHands;
  item: () => Of<"message">;
  row: string;
  text: Accessor<string>;
}) {
  const head = () => {
    const item = props.item();
    if (item === undefined) return "";
    const who = item.origin === "human" ? "You" : "The workflow";
    return `${who} · ${serverTime(item.at)}${item.read ? "" : " · not read yet"}`;
  };
  const refusal = signal<string | null>(null);
  const takeBack = async () => {
    const item = props.item();
    if (item !== undefined) refusal.set(await props.hands.takeBack(item));
  };
  return (
    <View
      style={{
        backgroundColor: tokens.control.wash(tokens.role.yours),
        borderColor: tokens.role.yours,
        borderLeftWidth: 2,
        gap: 2,
        marginVertical: 4,
        paddingHorizontal: 12,
        paddingVertical: 6,
      }}
      testID="message"
    >
      <View style={{ alignItems: "center", flexDirection: "row", gap: 8 }}>
        <Text size="under" style={{ flexShrink: 1 }} tone="faint">
          {head()}
        </Text>
        <If when={props.item()?.read === false && props.hands.canTakeBack()}>
          <Link onPress={() => void takeBack()} size="under">
            Take back
          </Link>
        </If>
      </View>
      <If when={refusal()}>{(words) => <Refusal words={words()} />}</If>
      <If when={props.item()?.opening}>{(opening) => <Text tone="quiet">{opening()}</Text>}</If>
      <Document align="start" document={treeOf(props.row, props.text)} />
      <If when={(props.item()?.images.length ?? 0) > 0}>
        <View style={{ flexDirection: "row", flexWrap: "wrap", gap: 8, paddingTop: 4 }}>
          <Each of={props.item()?.images ?? []}>
            {(image) => <Picture id={image().id} repo={props.hands.repo} />}
          </Each>
        </View>
      </If>
    </View>
  );
}

/** A message's image, from the server, at most 160 points on its longer side. */
function Picture(props: { id: string; repo: string }) {
  const url = chatImage(props.repo, props.id);
  return (
    <If when={url()} else={<Icon name="image-plus" />}>
      {(src) => <Image src={src()} style={{ height: 120, width: 160 }} />}
    </If>
  );
}

/** The agent's words, drawn as blocks as they stream, with an offer's card in place of its block. */
function AgentText(props: {
  feed: Feed;
  hands: RowHands;
  item: () => Of<"text">;
  row: string;
  text: Accessor<string>;
  turn: string;
}) {
  const override = offerOverride(props.hands, props.row, props.turn);
  // A text whole when its row is drawn is a document, its tree read once for its row; one that
  // streams is a reply, whose blocks come as they finish, each a row before this one where the
  // feed splits it, and stays one once split.
  const split = untracked(() => props.feed.split?.(props.row) ?? 0) > 0;
  const streaming = untracked(props.item)?.streaming === true || split;
  const finished = props.feed.finished;
  return streaming ? (
    <Reply
      align="start"
      done={() => props.item()?.streaming === false}
      onFinished={finished && ((blocks) => finished(props.row, blocks))}
      override={override}
      testID="agent-text"
      text={props.text}
    />
  ) : (
    <Document
      align="start"
      document={treeOf(props.row, props.text)}
      override={override}
      testID="agent-text"
    />
  );
}

/** What a reply's row, or a row of its blocks, draws in place of an offer's block: its card. */
function offerOverride(hands: RowHands, row: string, turn: string) {
  return (block: Block) => {
    const kind = offerOf(block);
    if (kind === undefined) return undefined;
    const live = () => hands.offerTurn() === turn && applies(kind, hands.kind()) && !isClosed(row);
    return (
      <View>
        <OfferCard
          body={(block.text ?? "").trim()}
          cardKey={row}
          folder={hands.folder()}
          kind={kind}
          live={live()}
          repo={hands.repo}
          session={hands.session}
        />
      </View>
    );
  };
}

/** The trees of the texts read whole, by row: a text that ended never changes. */
const trees = new Map<string, Tree>();
/** How many trees are kept: the rows of a few screens' flings either way. */
const TREES = 2_000;

/** The document tree of a whole text, read once for its row while it stays among the latest. */
function treeOf(row: string, text: Accessor<string>): Tree {
  let tree = trees.get(row);
  if (tree === undefined) {
    tree = JSON.parse(markdownTree(untracked(text))) as Tree;
    if (trees.size >= TREES) trees.delete(trees.keys().next().value!);
    trees.set(row, tree);
  }
  return tree;
}
