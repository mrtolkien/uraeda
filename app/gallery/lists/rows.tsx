// Rows: a short list with its cursor, a range held, a list of 20,000 rows, and an empty list
// that says why. Each list's keys are in a pane of its own, as on a screen: only the long one's
// pane has the focus here.
import { type JSX, View } from "nsh";
import { Page, Part } from "../controls/parts";
import { KeyScope } from "../../ui/keys/registry";
import { createCursor, Empty, Line, List, VirtualList } from "../../ui/lists";
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

export function rows(narrow: boolean) {
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
