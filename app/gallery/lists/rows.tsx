// Rows: a short list with its cursor, a range held, a list of 20,000 rows, and an empty list
// that says why. Each list's keys are in a pane of its own, as on a screen: only the long one's
// pane has the focus here.
import { type JSX, View } from "nsh";
import { Page, Part } from "../parts";
import { KeyScope } from "../../ui/keys/registry";
import { signal } from "nsh";
import { sent, Switch } from "../../ui/controls";
import { createCursor, Empty, Line, List, Outline, VirtualList } from "../../ui/lists";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { tokens } from "../../ui/tokens";

/** A list's keys, in a pane that has the focus only when `on`. */
export function Scoped(props: { children?: JSX.Element; name: string; on?: boolean }) {
  return (
    <KeyScope kind="pane" name={props.name} on={() => props.on === true}>
      {props.children}
    </KeyScope>
  );
}

const PLACES = [
  { id: "home", icon: "house", label: "Home", meta: "g h" },
  { id: "inbox", icon: "inbox", label: "Inbox", count: 10 },
  { id: "priorities", icon: "flag", label: "Priorities", meta: "g p" },
  { id: "sessions", icon: "message-square", label: "Sessions", meta: "g s" },
  { id: "decisions", icon: "scale", label: "Decisions", meta: "g d" },
  { id: "git", icon: "git-branch", label: "Git", meta: "+84 −22" },
  { id: "done", icon: "circle-check", label: "Vim in every text field", quiet: true },
] as const;

const hueOf = (id: string) =>
  ({
    git: tokens.role.removed,
    home: tokens.role.action,
    inbox: tokens.role.needsYou,
    priorities: tokens.role.context,
    sessions: tokens.role.lightRunning,
  })[id];

function place(id: () => string) {
  const one = () => PLACES.find((row) => row.id === id()) ?? PLACES[0];
  return (
    <Line
      count={"count" in one() ? (one() as { count: number }).count : undefined}
      hue={hueOf(id())}
      icon={one().icon}
      label={one().label}
      meta={"meta" in one() ? (one() as { meta: string }).meta : undefined}
      quiet={"quiet" in one()}
    />
  );
}

const STEPS = ["read", "write", "run", "ask", "plan"] as const;

/** Twenty thousand rows, each its number, a step, and a time. */
export const MANY = Array.from({ length: 20_000 }, (_, at) => ({ id: String(at + 1) }));

export function manyRow(id: () => string) {
  const at = () => Number(id());
  return (
    <Line
      hue={at() % 7 === 0 ? tokens.role.needsYou : tokens.role.context}
      icon={at() % 7 === 0 ? "circle-alert" : "file-text"}
      label={`${at()} · ${STEPS[at() % STEPS.length]} specs/2026-11-10-nsh-migration/plan.md`}
      meta={`14:${String(at() % 60).padStart(2, "0")}`}
    />
  );
}

/** Two saved fields: one the server keeps, one it refuses, with the way out under it. */
function Fields() {
  const night = sent(signal(true), () => Promise.resolve());
  const vim = sent(signal(false), () =>
    Promise.reject(
      new Error("config.toml cannot be written: its folder is read-only. Make it writable."),
    ),
  );
  const fields = () => [{ act: () => night.set(!night.value()), id: "night" }, { id: "vim" }];
  return (
    <FieldRows rows={fields}>
      <FieldRow
        control={<Switch label="Night" onChange={night.set} value={night.value()} />}
        from="Set in config.toml"
        help="Darker colours after sunset."
        icon="eye"
        id="night"
        label="Night"
      />
      <FieldRow
        control={<Switch label="Vim" onChange={vim.set} value={vim.value()} />}
        from="The default, off"
        help="Vim's keys in every text field."
        icon="square-terminal"
        id="vim"
        label="Vim mode"
        refusal="config.toml cannot be written: its folder is read-only. Make it writable."
      />
    </FieldRows>
  );
}

const HEADINGS = [
  { id: "1", level: 2, title: "Goals" },
  { id: "2", level: 2, title: "Design" },
  { id: "3", level: 3, title: "The schedule's rules" },
  { id: "4", level: 3, title: "What a person sees" },
  { id: "5", level: 2, title: "Testing" },
];

export function rows(narrow: boolean) {
  const parts = createCursor(() => HEADINGS, { initial: "4" });
  const short = createCursor(() => PLACES, { initial: "sessions" });
  const range = createCursor(() => PLACES, { range: true, initial: "priorities" });
  range.move(2, true);
  const many = createCursor(() => MANY, { initial: "3" });
  const none = createCursor(() => []);
  return (
    <Page narrow={narrow}>
      <Part narrow={narrow} title="List">
        <Scoped name="List">
          <List cursor={short} row={place} />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="Outline · the part being read lit">
        <Scoped name="Outline">
          <Outline
            cursor={parts}
            emptyWords="The file has no heading under its title."
            heading={(id) => HEADINGS.find((one) => one.id === id)}
            here={() => "2"}
            onOpen={() => {}}
            top={2}
          />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="A range held">
        <Scoped name="Range">
          <List cursor={range} row={place} rules />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="Empty">
        <Scoped name="Empty">
          <List
            cursor={none}
            empty={
              <Empty
                action={{ icon: "plus", label: "New session", run: () => {} }}
                icon="message-square"
                title="No sessions"
                words="No agent ran in this repository yet. A session starts from New, or from a feature's next step."
              />
            }
            row={place}
          />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="FieldRow · a saved field">
        <Scoped name="Fields">
          <Fields />
        </Scoped>
      </Part>
      <Part narrow={narrow} title="VirtualList · 20,000 rows" wide>
        <Scoped name="Many" on>
          <View style={{ height: narrow ? 300 : 360 }}>
            <VirtualList cursor={many} row={manyRow} testID="many" />
          </View>
        </Scoped>
      </Part>
    </Page>
  );
}
