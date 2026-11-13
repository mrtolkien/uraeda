// The Extensions category: a banner per problem first, an account's included, what needs the human
// above all; then the owner's extensions and the built-in ones, a row each: what it is, where it
// comes from and where it is on, its switch, which turns it on everywhere or off, and "Only in…",
// the repositories it is on in, ticked one by one; under it, its settings, and the sections its page
// adds (`settingsSection`), each drawn by the page in its own view. A clash of its keys with another
// extension's is a banner of its own, as its problems are.
import { View } from "nsh";
import { ExtensionForm } from "./ExtensionForm";
import {
  aboutLine,
  isOn,
  listed,
  type Notice,
  noticesOf,
  type OnIn,
  onInOf,
} from "./extensionWords";
import { keyProblem } from "../extension";
import { settingsSectionsOf } from "../../extensions/contributions";
import { ExtensionPlace } from "../../extensions/ExtensionPlace";
import { FieldRow, FieldRows } from "../../ui/lists/FieldRow";
import { call, extensionHost, record, route } from "../../store";
import type { ExtensionRow } from "../../store/protocol";
import {
  Banner,
  Button,
  Checkbox,
  Heading,
  iconNamed,
  type Sent,
  sent,
  Switch,
  Text,
} from "../../ui/controls";
import { usePane } from "../../ui/layout";

/** Where an extension is on, as its switch and its boxes show it and send it. */
function whereOf(row: () => ExtensionRow): Sent<OnIn> {
  return sent(
    () => onInOf(row()),
    (on) =>
      call("extensions.setOn", {
        name: row().name,
        on: on === "all" ? [] : [...on],
        onAll: on === "all",
      }),
  );
}

/** The repositories it can be on in, ticked where it is: a name it is on in that left the list stays. */
function OnlyIn(props: { row: ExtensionRow; where: Sent<OnIn> }) {
  const repositories = record("Repositories", null);
  const names = () => [
    ...new Set([...(repositories()?.rows ?? []).map((one) => one.name), ...props.row.on]),
  ];
  const ticked = (name: string) => {
    const on = props.where.value();
    return on === "all" || on.includes(name);
  };
  const tick = (name: string, next: boolean) => {
    const on = props.where.value();
    const now = on === "all" ? names() : [...on];
    props.where.set(next ? [...now, name] : now.filter((one) => one !== name));
  };
  return (
    <View style={{ gap: 2 }}>
      <Text tone="quiet">{`${props.row.title} is on in:`}</Text>
      <Each key={(name: string) => name} of={names()}>
        {(name) => (
          <Checkbox label={name()} onChange={(next) => tick(name(), next)} value={ticked(name())} />
        )}
      </Each>
      <Text size="under" tone="faint">
        A list ticked here does not follow a repository added later; the switch turns it on in every
        one.
      </Text>
    </View>
  );
}

/** The repository the settings are shown in. */
const repo = () => route().repo;

/** Why an extension's keys are left out, as a banner of the category. */
function keyNotices(rows: ReadonlyArray<ExtensionRow>): Notice[] {
  return rows.flatMap((row) => {
    const keys = keyProblem(row.name);
    if (keys === undefined) return [];
    const title = `${row.title}'s keys are off: ${keys}`;
    return [{ id: `${row.name}#keys`, title, tone: "caution" as const }];
  });
}

/** The sections an owner's extension adds under its row, in the repository shown. */
function Sections(props: { row: ExtensionRow }) {
  const sections = () => {
    const here = repo();
    return here === undefined
      ? []
      : settingsSectionsOf(here).filter((one) => one.row.name === props.row.name);
  };
  return (
    <Each key={(one: ReturnType<typeof sections>[number]) => one.id} of={sections()}>
      {(one) => (
        <View style={{ gap: 4 }}>
          <Text bold>{one().title}</Text>
          <View style={{ height: 240 }}>
            <ExtensionPlace
              extension={() => one().row}
              host={extensionHost()}
              part={{ id: one().id, kind: "settingsSection" }}
              repo={repo() ?? ""}
            />
          </View>
        </View>
      )}
    </Each>
  );
}

/** An extension's row. */
function Item(props: { row: ExtensionRow; where: Sent<OnIn> }) {
  const pane = usePane();
  const picking = pane.remember<boolean>(`only-${props.row.name}`, false);
  const where = props.where;
  return (
    <FieldRow
      control={
        <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
          <Button label="Only in…" onPress={() => picking.set(!picking())} selected={picking()} />
          <Switch
            label={isOn(where.value()) ? "on" : "off"}
            onChange={(on) => where.set(on ? "all" : [])}
            pending={where.pending()}
            value={isOn(where.value())}
          />
        </View>
      }
      from={aboutLine(props.row, where.value())}
      help={props.row.description}
      icon={iconNamed(props.row.icon === "" ? null : props.row.icon, "plug")}
      id={props.row.name}
      label={props.row.title}
      refusal={where.refusal()}
      under={
        <View style={{ gap: 12 }}>
          <If when={picking()}>
            <OnlyIn row={props.row} where={where} />
          </If>
          <If when={props.row.settings.length > 0}>
            <ExtensionForm row={props.row} />
          </If>
          <If when={!props.row.isBuiltIn}>
            <Sections row={props.row} />
          </If>
        </View>
      }
    />
  );
}

export function Extensions() {
  const extensions = record("Extensions", { repo: null });
  const rows = () => listed(extensions()?.extensions ?? []);
  const yours = () => rows().filter((row) => !row.isBuiltIn);
  const builtIn = () => rows().filter((row) => row.isBuiltIn);
  const notices = () => [...rows().flatMap(noticesOf), ...keyNotices(rows())];
  // Each extension's switch, made once per extension, so `Enter` and a press share it.
  const wheres = new Map<string, Sent<OnIn>>();
  const where = (name: string) => {
    let made = wheres.get(name);
    if (made === undefined) {
      made = whereOf(() => rows().find((row) => row.name === name)!);
      wheres.set(name, made);
    }
    return made;
  };
  const cursor = () =>
    [...yours(), ...builtIn()].map((row) => ({
      act: () => {
        const one = where(row.name);
        one.set(isOn(one.value()) ? [] : "all");
      },
      id: row.name,
    }));
  const item = (row: () => ExtensionRow) => <Item row={row()} where={where(row().name)} />;
  return (
    <If when={extensions() !== undefined} else={<Text tone="faint">Reading the extensions…</Text>}>
      <View style={{ gap: 12 }}>
        <Each key={(notice: Notice) => notice.id} of={notices()}>
          {(notice) => <Banner title={notice().title} tone={notice().tone} />}
        </Each>
        <FieldRows rows={cursor}>
          <Heading level={3}>Yours</Heading>
          <If
            when={yours().length > 0}
            else={
              <Text tone="faint">
                {`None yet. Ask a session to write one, or add a folder to ${extensions()?.folder ?? "the extensions folder"} with ura extension add.`}
              </Text>
            }
          >
            <Each key={(row: ExtensionRow) => row.name} of={yours()}>
              {item}
            </Each>
          </If>
          <Heading level={3}>Built in</Heading>
          <Each key={(row: ExtensionRow) => row.name} of={builtIn()}>
            {item}
          </Each>
        </FieldRows>
      </View>
    </If>
  );
}
