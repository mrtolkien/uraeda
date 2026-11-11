// A part of an extension's page, drawn in the app: a place's pane, a pane of Home, an item of the
// status line. The page runs in `uraeda.extension`, a view of its own, which fetches it from the
// server and runs it only when it is signed under the server's key. This draws that view, answers
// what the page asks (`host.tsx`), sends it the app's theme as it changes, and, when the page
// breaks, says so in its place, naming the extension, and reports it to the server.
//
// A place of an extension is a pane like any other (task 51): its `definePane`'s view draws this
// with `part={{ kind: "place", id }}`, in whichever stack and at whichever width the pane has.
import {
  type Accessor,
  effect,
  nativeComponent,
  type NativeComponentRef,
  signal,
  untracked,
  View,
} from "nsh";
import { paged, rowsIn } from "./contributions";
import { declared, declaredBy } from "./declared";
import { extensionHost } from "../store";
import type { ExtensionRow } from "../store/protocol";
import { Banner } from "../ui/controls";
import { Empty } from "../ui/lists";
import { pickedFonts, shownTheme } from "../ui/theme";
import {
  type ExtensionHost,
  type PageMessage,
  type PageProblem,
  pageChannel,
  problemWords,
} from "./host";
import type { Declarations, PageParams, PartKind, ShownTheme } from "./page";

type ViewProps = {
  server: string;
  token?: string;
  name: string;
  version?: number;
  params: PageParams;
};

type ViewEvents = {
  ready: { declarations: Declarations; version: number };
  problem: PageProblem;
  message: PageMessage;
};

/** The native component that runs a page: `crates/app/src/extension_view.rs`. */
const ExtensionView = nativeComponent<ViewProps, ViewEvents>("uraeda.extension", {
  props: ["server", "token", "name", "version", "params"],
  events: ["ready", "problem", "message"],
});

export type ExtensionPlaceProps = {
  host: ExtensionHost;
  /** The extension: its name, its title, and its page's version, as the record `Extensions` has them. */
  extension: Accessor<{ name: string; title: string; pageVersion: number | null }>;
  repo: string;
  /** The part to draw: none draws nothing, and only reads what the page declares. */
  part?: { kind: PartKind; id: string };
  /** What the part reads with `useProps`. */
  props?: Accessor<unknown>;
  /** What the page declared, each time it drew. */
  onReady?: (declarations: Declarations) => void;
  /** A problem of the page, as it is shown in its place. */
  onProblem?: (problem: PageProblem) => void;
  /** The last key of the page pressed, numbered: sent to the page once it is ready, to run it. */
  pressed?: Accessor<{ keys: string; n: number } | undefined>;
};

/** The app's theme and fonts, as a page takes them. */
const theme = (): ShownTheme => ({ fonts: pickedFonts(), theme: shownTheme() });

export function ExtensionPlace(props: ExtensionPlaceProps) {
  let view: NativeComponentRef | undefined;
  const problem = signal<PageProblem | undefined>(undefined);
  const ready = signal(false);
  const name = () => props.extension().name;
  const line = {
    send: (event: string, data: unknown) => view?.command("send", { data, name: event }),
    reply: (id: number, answer: { value: unknown } | { error: string }) =>
      view?.command("reply", { id, ...answer }),
  };
  const channel = pageChannel(props.host, { extension: name(), repo: props.repo }, line);
  // What the page reads stops as the place goes.
  effect(() => () => channel.close());
  const params = untracked((): PageParams => ({
    part: props.part,
    props: props.props?.(),
    repo: props.repo,
    theme: theme(),
  }));
  effect(() => line.send("theme", theme()));
  effect(() => {
    if (props.props) line.send("props", props.props());
  });
  // A key of the page, once the page can run it: pressed before, it waits for the page's `ready`.
  effect(() => {
    const key = props.pressed?.();
    if (key !== undefined && ready()) untracked(() => line.send("key", { keys: key.keys }));
  });
  // Followed: this machine's server started again on another port moves the connection there.
  const server = () => props.host.server();
  const words = () => {
    const shown = problem();
    return shown && problemWords(props.extension().title || name(), shown);
  };
  const heard = (next: PageProblem) => {
    // One incident is often heard twice, as the page's boundary and its late pings say it.
    const again = problem()?.kind === next.kind && problem()?.version === next.version;
    problem.set(next);
    props.onProblem?.(next);
    const said = problemWords(name(), next);
    if (said.reported && !again) {
      const report = {
        message: `${said.title}: ${next.message}`,
        name: name(),
        version: next.version,
      };
      props.host.call("extensions.reportPageProblem", report).catch(() => undefined);
    }
  };
  return (
    <View style={{ flex: 1 }}>
      <If when={words()}>
        {(said) => (
          <If
            when={said().gone}
            else={
              <Banner title={said().title} tone="caution">
                {said().words}
              </Banner>
            }
          >
            <Empty icon="circle-alert" title={said().title} words={said().words} />
          </If>
        )}
      </If>
      <If when={!ready() && !problem()}>
        <Empty icon="refresh-cw" title={`Loading ${props.extension().title || name()}`} />
      </If>
      <ExtensionView
        name={name()}
        onMessage={(message) => channel.heard(message)}
        onProblem={heard}
        onReady={(drawn) => {
          declared(name(), drawn.version, drawn.declarations);
          ready.set(true);
          if (problem()?.kind !== "slow") problem.set(undefined);
          props.onReady?.(drawn.declarations);
        }}
        params={params}
        ref={(node) => {
          view = node;
        }}
        server={server().address}
        style={{ flex: words()?.gone ? 0 : 1 }}
        token={server().token}
        version={props.extension().pageVersion ?? undefined}
      />
    </View>
  );
}

/**
 * Runs the page of `extension`, unseen, for what it declares, while the device does not know it
 * for its version: nothing once it does.
 */
export function ReadDeclarations(props: {
  extension: { name: string; title: string; pageVersion: number | null };
  host: ExtensionHost;
  repo: string;
}) {
  return (
    <If when={declaredBy(props.extension.name, props.extension.pageVersion) === undefined}>
      <View style={{ height: 0, overflow: "hidden", width: 0 }}>
        <ExtensionPlace extension={() => props.extension} host={props.host} repo={props.repo} />
      </View>
    </If>
  );
}

/**
 * Reads what every page of the owner's extensions on in `repo` declares, each once per version:
 * the one list (`contributions.ts`) adds an extension's parts only once they are known.
 */
export function ReadAllDeclarations(props: { repo: string }) {
  const host = extensionHost();
  return (
    <Each
      key={(row: ExtensionRow) => `${row.name}@${row.pageVersion}`}
      of={paged(rowsIn(props.repo), props.repo)}
    >
      {(row) => <ReadDeclarations extension={row()} host={host} repo={props.repo} />}
    </Each>
  );
}
