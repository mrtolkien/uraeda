// `uraeda/page`: the page API, what an extension's page imports to add its parts to the app, and
// to read and act through it. The server builds it into every page's package (ruling R116), and the
// page runs in an engine of its own, inside the native component `uraeda.extension`: it reaches
// the app only through its host's channel, whose names `crates/protocol/src/page.rs` lists.
//
// A page declares its parts at its top level, `place({ id, title, icon, view })`, and the app draws
// each in its own view: one engine per part shown, each running the whole page, each drawing the
// part its launch parameters name. So a part's state lives in the server's records, never in the
// page's memory. Once the page's code ran, the host sends `show`: the page draws its part, inside a
// boundary that tells the host what threw, and posts `ready` with what it declared.
//
// Imports only `nsh` and files of the app's `ui/` and `extensions/` folders, which the server
// writes beside each other.
import {
  type Accessor,
  cleanup,
  type Component,
  ErrorBoundary,
  host,
  mount,
  signal,
  View,
} from "nsh";
import { applyFonts, applyTheme } from "../ui/theme";
import { type Fonts, type ThemeSource, tokens } from "../ui/tokens";

/** What draws a part of a page: `useProps` reads what the app gives it. */
export type PageView = Component;

/**
 * A place of the app: a pane of its own at `/e/<extension>/<id>`, with a row in the rail and, with
 * `key`, a key after `Space`. `count` names a record of the extension whose value, a number, the
 * rail shows after the title: what waits there.
 */
export type Place = {
  id: string;
  title: string;
  icon: string;
  view: PageView;
  key?: string;
  count?: string;
};

/** The tone of a pane or a section, as the app's lists use: what is now, ongoing, or later. */
export type Tone = "now" | "ongoing" | "later" | "neutral";

/** A pane of Home, in its first column or its second. */
export type HomePane = {
  id: string;
  title: string;
  icon: string;
  column?: 0 | 1;
  tone?: Tone;
  view: PageView;
};

/**
 * A section of the New page, a pane beside the composer: `useProps` gives it `{ kind }`, what the
 * page starts, `"session"`, `"change"`, or `"feature"`.
 */
export type NewSection = { id: string; title: string; tone?: Tone; view: PageView };

/** An item of the status line. */
export type StatusItem = { id: string; view: PageView };

/**
 * What draws a tool's items in a session, by the tool's name, in place of their line, 160 points
 * high: `useProps` gives it `{ item }`, the transcript's item.
 */
export type ItemRenderer = { tool: string; view: PageView };

/** A section under the extension's row in Settings, Extensions. */
export type SettingsSection = { id: string; title: string; icon: string; view: PageView };

/**
 * A key under the leader, `Space`: one key, `"y"`, or a sequence under a group, `"n y"`. The app
 * runs `run` in a view of the page it keeps unseen, so `run` acts through `navigate` and actions.
 */
export type Key = { keys: string; label: string; run: () => void; icon?: string };

/** The kinds of a page's parts, as the app names them in a page's launch parameters. */
export type PartKind =
  | "place"
  | "homePane"
  | "newSection"
  | "statusItem"
  | "itemRenderer"
  | "settingsSection";

/** What a page declared, as its host gets it in `ready`: each part without what draws it. */
export type Declarations = {
  places: Omit<Place, "view">[];
  homePanes: Omit<HomePane, "view">[];
  newSections: Omit<NewSection, "view">[];
  statusItems: Omit<StatusItem, "view">[];
  itemRenderers: Omit<ItemRenderer, "view">[];
  settingsSections: Omit<SettingsSection, "view">[];
  keys: Omit<Key, "run">[];
};

/** What the app tells a page as it starts, `host.params`. */
export type PageParams = {
  /** The part to draw: none draws nothing, as when the app reads what a page declares. */
  part?: { kind: PartKind; id: string };
  repo: string;
  theme: ShownTheme;
  /** What the part's view reads with `useProps`. */
  props?: unknown;
};

/** The app's theme and fonts, which the page draws in. */
export type ShownTheme = { theme: ThemeSource; fonts: Partial<Fonts> };

/** A record read: its value once it came, or why there is none. */
export type Reading<T> = { value: T | undefined; error: string | undefined };

const declared: Declarations = {
  places: [],
  homePanes: [],
  newSections: [],
  statusItems: [],
  itemRenderers: [],
  settingsSections: [],
  keys: [],
};
const views = new Map<string, PageView>();
const runs = new Map<string, () => void>();
const unloads: Array<() => void> = [];

function add<Part extends { view: PageView }>(
  kind: PartKind,
  list: Omit<Part, "view">[],
  id: string,
  part: Part,
) {
  const { view, ...shown } = part;
  list.push(shown);
  views.set(`${kind}:${id}`, view);
}

/** Adds a place: a pane of its own, with a row in the rail. */
export function place(part: Place) {
  add("place", declared.places, part.id, part);
}

/** Adds a pane to Home. */
export function homePane(part: HomePane) {
  add("homePane", declared.homePanes, part.id, part);
}

/** Adds a section to the New page. */
export function newSection(part: NewSection) {
  add("newSection", declared.newSections, part.id, part);
}

/** Adds an item to the status line. */
export function statusItem(part: StatusItem) {
  add("statusItem", declared.statusItems, part.id, part);
}

/** Draws a tool's items in a session, in place of their output. */
export function itemRenderer(part: ItemRenderer) {
  add("itemRenderer", declared.itemRenderers, part.tool, part);
}

/** Adds a section under the extension's row in Settings. */
export function settingsSection(part: SettingsSection) {
  add("settingsSection", declared.settingsSections, part.id, part);
}

/** Adds a key under the leader: the app runs `run` in a view of the page as it is pressed. */
export function key(part: Key) {
  const { run, ...shown } = part;
  declared.keys.push(shown);
  runs.set(part.keys, run);
}

/**
 * Runs `fn` when the part drawn goes, the last given first. A page's engine stops whole, with
 * its timers and listeners: `fn` is for what the page asked of the app, as a record it reads.
 */
export function onUnload(fn: () => void) {
  unloads.push(fn);
}

const params = host.params as unknown as PageParams;
const props = signal<unknown>(params.props);

/** The repository the part is drawn for. */
export function useRepository(): string {
  return params.repo;
}

/** What the app gives the part drawn: a New-page section's `{ kind }`, an item's `{ item }`. */
export function useProps<T>(): Accessor<T> {
  return props as Accessor<T>;
}

let nextRead = 0;
const readings = new Map<number, (reading: Reading<unknown>) => void>();

function read<T>(what: { name?: string; settings?: true }): Accessor<Reading<T>> {
  const id = nextRead++;
  const reading = signal<Reading<T>>({ value: undefined, error: undefined });
  readings.set(id, (next) => reading.set(next as Reading<T>));
  host.post("record", { id, ...what });
  cleanup(() => {
    readings.delete(id);
    host.post("record", { id, stop: true });
  });
  return reading;
}

/** A record of the extension, in the repository: its value as it changes, or why there is none. */
export function useRecord<T>(name: string): Accessor<Reading<T>> {
  return read<T>({ name });
}

/** The extension's settings in the repository, defaults filled in. */
export function useExtensionSettings<T>(): Accessor<Reading<T>> {
  return read<T>({ settings: true });
}

/** Runs an action of the extension: its output, or a rejection with why it was refused. */
export function useAction<I, O>(name: string): (input: I) => Promise<O> {
  return (input) => host.call<O>("call", { name, input }, { timeout: 0 });
}

/** Opens an address of the app, as a link of the app does: `/r/todo-app/inbox`. */
export function navigate(to: string) {
  host.post("navigate", { to });
}

/** Draws the page in the app's theme and fonts. */
function showTheme(shown: ShownTheme | undefined) {
  if (shown) {
    applyFonts(shown.fonts);
    applyTheme(shown.theme);
  }
}

/** The text of what a page threw, for the owner to read. */
function said(error: unknown): string {
  return error instanceof Error ? `${error.name}: ${error.message}` : String(error);
}

/** Draws the part the app asked for, inside a boundary that tells the host what throws. */
function show() {
  const part = params.part;
  const view = part && views.get(`${part.kind}:${part.id}`);
  if (part && !view) {
    host.post("problem", { message: `it declares no ${part.kind} "${part.id}"` });
    return;
  }
  const Part = view ?? (() => <View />);
  mount(() => {
    cleanup(() => {
      for (const fn of unloads.splice(0).toReversed()) fn();
    });
    // On the fill of the pane it sits in, a frame's pane, the standard height's: its own view's
    // ground was the window's, a black box (a white one in light) in the wiki's pane of Home.
    return (
      <View style={{ backgroundColor: tokens.height.standard.fill, flex: 1 }}>
        <ErrorBoundary
          fallback={(error) => {
            host.post("problem", { message: said(error) });
            return <View />;
          }}
        >
          <Part />
        </ErrorBoundary>
      </View>
    );
  });
  host.post("ready", declared);
}

showTheme(params.theme);
host.on<ShownTheme>("theme", showTheme);
host.on("props", (next) => props.set(next));
host.on<{ id: number } & Reading<unknown>>("record", ({ id, value, error }) =>
  readings.get(id)?.({ value: value ?? undefined, error: error ?? undefined }),
);
host.on<{ keys: string }>("key", ({ keys }) => runs.get(keys)?.());
host.on("show", show);
