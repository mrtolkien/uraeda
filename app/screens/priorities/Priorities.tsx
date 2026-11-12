// The priorities pane: Ongoing, the running proposals, apart, then Now, Next, Later, and Blocked
// while it holds any, as columns side by side or as one list, `v` switching, the choice kept on
// this device. A narrow stack, a phone's or the side's, shows one list: columns there hid Next and
// Later past the edge.
//
// The focus is in one section at a time. `j` `k` move in it, and past its ends into the section
// above or under it in the list; `h` `l` cross the columns, and past the last one the frame's
// stacks. `m` lifts a row, `H` `L` send it to the section before or after.
import { computed, untracked, View } from "nsh";
import { createOrder } from "./moves";
import { byKey } from "./order";
import { Ongoing, Section } from "./Section";
import { device, navigate, record } from "../../store";
import type { ProposalItem } from "../../store/protocol";
import { Banner, Segmented, Spinner, Text } from "../../ui/controls";
import { type KeySpec, KeyScope, registerKey } from "../../ui/keys/registry";
import type { Cursor } from "../../ui/lists";
import { PaneScroll, usePane } from "../../ui/layout";
import { Pane } from "../../ui/surfaces";
import type { WidthClass } from "../../ui/width";

export type Shape = "columns" | "list";

/** The sections the page shows, by their id: Ongoing's is its own. */
type Shown = { id: string; title: string; context: string | null };

export function Priorities(props: { repo: string; width: WidthClass; open?: string }) {
  const pane = usePane();
  const priorities = record("Priorities", { repo: props.repo });
  const order = createOrder(() => props.repo, priorities);
  const proposals = computed((): ReadonlyMap<string, ProposalItem> => {
    const now = priorities();
    return now ? byKey(now) : new Map();
  });
  const ongoing = computed(() =>
    Object.values(order.order()).flatMap((keys) => keys.filter(order.runs)),
  );
  const sections = computed(
    (): ReadonlyArray<Shown> => {
      const listed = (priorities()?.sections ?? []).filter(
        (one) => one.section !== "blocked" || one.proposals.length > 0,
      );
      const own = listed.map((one) => ({
        context: one.context,
        id: one.section,
        title: one.title,
      }));
      return ongoing().length > 0
        ? [{ context: "Started: each opens its feature.", id: "ongoing", title: "Ongoing" }, ...own]
        : own;
    },
    // A move changes no section: each keeps its rows' views, and what its list said.
    { equals: (a, b) => JSON.stringify(a) === JSON.stringify(b) },
  );

  const view = (): Shape =>
    props.width === "narrow" ? "list" : (device.get("priorities.view") ?? "columns");
  const flip = () => device.set("priorities.view", view() === "columns" ? "list" : "columns");

  // The section with the focus, and each one's cursor, for the keys that cross them.
  const home = () =>
    Object.entries(order.order()).find(
      ([, keys]) => props.open !== undefined && keys.includes(props.open),
    )?.[0];
  // The section the person moved the keys to, else the open proposal's, else the first that has
  // rows: an empty Now would hold the keys with no cursor to show.
  const at = pane.remember<string | null>("section", null);
  const cursors = new Map<string, Cursor>();
  const ids = () => sections().map((one) => one.id);
  const focused = () => {
    const chosen = at() ?? home();
    if (chosen !== undefined && ids().includes(chosen)) return chosen;
    return ids().find((id) => countOf(id) > 0) ?? ids()[0] ?? "now";
  };
  /** The focus into a section, the cursor of the one it leaves let go: one selection in the pane. */
  const enter = (id: string, where: "first" | "last" | number) => {
    const cursor = cursors.get(id);
    if (cursor === undefined) return false;
    leave(id);
    if (typeof where === "number") {
      const rows = cursor.items();
      const row = rows[Math.min(where, rows.length - 1)];
      cursor.set(row?.id, { reveal: true });
    } else {
      cursor.to(where);
    }
    return true;
  };
  function leave(id: string) {
    at.set(id);
    for (const [other, cursor] of cursors) if (other !== id) cursor.set(undefined);
  }
  const countOf = (id: string) =>
    id === "ongoing"
      ? ongoing().length
      : (order.order()[id] ?? []).filter((key) => !order.runs(key)).length;
  const beside = (by: number) => ids()[ids().indexOf(focused()) + by];
  const open = (key: string) => {
    const running = proposals().get(key)?.running;
    if (running) navigate({ folder: running.folder, page: "feature" });
    else navigate({ key, page: "proposal" });
  };

  registerKey([
    {
      hint: "v",
      hintLabel: "view",
      keys: "v",
      label: "columns or one list",
      run: flip,
      when: () => props.width !== "narrow",
    },
    ...[-1, 1].map((by) => ({
      keys: by < 0 ? "h" : "l",
      label: by < 0 ? "the column before" : "the column after",
      run: () => {
        const next = beside(by);
        if (view() !== "columns" || next === undefined) return false;
        const place = cursors
          .get(focused())
          ?.items()
          .findIndex((row) => row.id === cursors.get(focused())?.at());
        return enter(next, Math.max(0, place ?? 0)) ? undefined : false;
      },
    })),
    ...[-1, 1].map((by) => ({
      keys: by < 0 ? "H" : "L",
      label: by < 0 ? "send it to the section before" : "send it to the section after",
      run: () => {
        const key = cursors.get(focused())?.at();
        const next = beside(by);
        if (
          key === undefined ||
          next === undefined ||
          next === "ongoing" ||
          focused() === "ongoing"
        )
          return false;
        // Carried across the line between them: at the end of the one before, the start of the one after.
        const index = by < 0 ? (cursors.get(next)?.items().length ?? 0) : 0;
        order.move({ index, key, section: next });
        leave(next);
        cursors.get(next)?.set(key, { reveal: true });
        return undefined;
      },
    })),
  ]);

  const section = (shown: Shown) => {
    const active = () => pane.focused() && focused() === shown.id;
    const keep = (cursor: Cursor) => cursors.set(shown.id, cursor);
    const touched = () => leave(shown.id);
    return shown.id === "ongoing" ? (
      <Ongoing
        active={active}
        compact={() => view() === "columns"}
        cursor={keep}
        keys={ongoing}
        onOpen={open}
        onTouched={touched}
        proposals={proposals}
        repo={props.repo}
      />
    ) : (
      <Section
        active={active}
        cursor={keep}
        id={shown.id}
        onOpen={open}
        onTouched={touched}
        order={order}
        proposals={proposals}
        repo={props.repo}
        title={shown.title}
        open={props.open}
      />
    );
  };

  return (
    <If
      when={priorities.error()}
      else={
        <If when={priorities() !== undefined} else={<Spinner label="Reading the priorities" />}>
          <If
            when={priorities()}
            else={
              <Banner tone="caution" title="No priorities">
                This repository has no specs/PRIORITIES.md.
              </Banner>
            }
          >
            <PaneScroll style={{ flex: 1 }}>
              <View style={{ gap: 12 }}>
                <If when={props.width !== "narrow"}>
                  <View style={{ alignItems: "flex-start" }}>
                    <Segmented
                      label="View"
                      onChange={(next: Shape) => device.set("priorities.view", next)}
                      options={[
                        { icon: "columns-3", label: "Columns", value: "columns" },
                        { icon: "rows-3", label: "List", value: "list" },
                      ]}
                      value={view()}
                    />
                  </View>
                </If>
                <View
                  style={
                    view() === "columns"
                      ? { alignItems: "flex-start", flexDirection: "row", gap: 12 }
                      : { gap: 12 }
                  }
                >
                  <Each key={(one: Shown) => one.id} of={sections()}>
                    {(shown) => (
                      <Pane
                        height="raised"
                        more={`· ${countOf(shown().id)}`}
                        style={view() === "columns" ? { flex: 1, minWidth: 0 } : undefined}
                        title={shown().title}
                      >
                        <If when={shown().context}>
                          {(context) => (
                            <Text size="under" tone="quiet">
                              {context()}
                            </Text>
                          )}
                        </If>
                        {untracked(() => section(shown()))}
                      </Pane>
                    )}
                  </Each>
                </View>
                <Crossing enter={enter} focused={focused} ids={ids} cursors={cursors} view={view} />
              </View>
            </PaneScroll>
          </If>
        </If>
      }
    >
      {(error) => (
        <Banner tone="danger" title="The priorities could not be read">
          {error().message}
        </Banner>
      )}
    </If>
  );
}

/**
 * In one list, `j` `k` past a section's last or first row go on into the next or the one before:
 * keys of a scope beside the sections', so they run only where a section's own did nothing.
 */
function Crossing(props: {
  cursors: ReadonlyMap<string, Cursor>;
  enter: (id: string, where: "first" | "last") => boolean;
  focused: () => string;
  ids: () => ReadonlyArray<string>;
  view: () => Shape;
}) {
  const pane = usePane();
  const cross = (by: number) => () => {
    const here = props.cursors.get(props.focused());
    const rows = here?.items() ?? [];
    const edge = by > 0 ? rows.at(-1)?.id : rows[0]?.id;
    if (here !== undefined && rows.length > 0 && here.at() !== edge) return false;
    const next = props.ids()[props.ids().indexOf(props.focused()) + by];
    if (props.view() !== "list" || next === undefined) return false;
    return props.enter(next, by > 0 ? "first" : "last") ? undefined : false;
  };
  return (
    <KeyScope kind="pane" name="Sections" on={pane.focused}>
      <Keys
        keys={[
          { keys: "j", label: "the section under", run: cross(1) },
          { keys: "k", label: "the section above", run: cross(-1) },
        ]}
      />
    </KeyScope>
  );
}

/** Declares keys in the scope around it, and draws nothing. */
function Keys(props: { keys: ReadonlyArray<KeySpec> }) {
  registerKey(props.keys);
  return null;
}
