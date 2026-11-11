// One setting, as every category draws it: its icon, its name, what it does in words, where its
// value comes from, its control, and the server's refusal under it. Wide, the control sits at the
// row's end; narrow, under the words, as a phone's thumb reaches it. What a row holds beyond its
// control, a list of themes or an extension's settings, takes its full width under it.
//
// A category's rows share one cursor (`SettingRows`): `j` `k` move it, `Enter` changes the row's
// setting, as a press on its control does. A control that goes to the server takes its value from
// `sent` (`app/ui/controls/sent.ts`): it moves at once, its changes go in order, and a refusal puts
// it back and shows here, under it.
import { context, type JSX, View } from "nsh";
import { usePane } from "../../ui/layout";
import { Icon, type IconName, Text, Under } from "../../ui/controls";
import { createCursor, type Cursor, listKeys, Row } from "../../ui/lists";
import type { Setting } from "../../store/protocol";

export type SettingRowProps = {
  /** Its place in the category's cursor. */
  id: string;
  icon: IconName;
  label: string;
  /** What it does, in words, and when a change applies. */
  help: string;
  /** Where its value comes from: `fromWords`, or "Kept on this device". */
  from?: string | null;
  /** The value in force is not the file's: a flag or a variable set it for this run. */
  overridden?: boolean;
  /** Why the server refused the last change, with the way out. */
  refusal?: string | null;
  /** Its control: a switch, a choice, a field. */
  control?: JSX.Element;
  /** What it holds under its control, across its width. */
  under?: JSX.Element;
  testID?: string;
};

/** A row the cursor stops on, and what `Enter` does there. */
export type RowSpec = { id: string; act?: () => void };

const Rows = context<Cursor | null>(null);

/** Where a setting's value in force comes from, in words, its value too when it is not the file's. */
export function fromWords<T>(setting: Setting<T>, show: (value: T) => string): string {
  const { source } = setting;
  switch (source.kind) {
    case "default":
      return `The default, ${show(setting.inForce)}`;
    case "file":
      return "Set in config.toml";
    default:
      return `Set by ${source.name} for this run: ${show(setting.inForce)}. The file's value applies without it.`;
  }
}

/** Whether a flag or a variable sets the value in force. */
export const isOverridden = (setting: Setting<unknown>) =>
  setting.source.kind === "flag" || setting.source.kind === "environment";

/** A switch's value in words. */
export const onOff = (on: boolean) => (on ? "on" : "off");

/**
 * A category's rows: their cursor, kept in the visit, and their keys in the pane's scope. `rows`
 * are read as they change, an extension coming or going.
 */
export function SettingRows(props: { rows: () => ReadonlyArray<RowSpec>; children?: JSX.Element }) {
  const pane = usePane();
  const at = pane.remember<string | null>("row", null);
  const cursor = createCursor(props.rows, {
    initial: at() ?? undefined,
    onChange: (id) => at.set(id ?? null),
  });
  listKeys(cursor, {
    onOpen: (id) =>
      props
        .rows()
        .find((row) => row.id === id)
        ?.act?.(),
    openLabel: "change",
  });
  return (
    <Rows.Provider value={cursor}>
      <View style={{ gap: 2 }}>{props.children}</View>
    </Rows.Provider>
  );
}

export function SettingRow(props: SettingRowProps) {
  const cursor = Rows();
  const pane = usePane();
  const wide = () => pane.width() !== "narrow";
  // Wide, the words keep beside their icon; narrow, the icon and the name are a head line, and
  // what wraps takes the row's whole width under it.
  const indent = () => (wide() ? 26 : 0);
  return (
    <Row
      onPoint={() => cursor?.set(props.id)}
      selected={cursor?.holds(props.id) === true}
      style={{ alignItems: "stretch", paddingVertical: 10 }}
      testID={props.testID}
    >
      <View style={{ flex: 1, minWidth: 0 }}>
        <View
          style={{
            alignItems: wide() ? "center" : "stretch",
            flexDirection: wide() ? "row" : "column",
            gap: wide() ? 16 : 8,
          }}
        >
          <View style={{ flex: wide() ? 1 : undefined, gap: 2, minWidth: 0 }}>
            <View style={{ alignItems: "center", flexDirection: "row", gap: 10 }}>
              <Icon name={props.icon} />
              <Text bold style={{ flex: 1 }}>
                {props.label}
              </Text>
            </View>
            <View style={{ gap: 2, paddingLeft: indent() }}>
              <If when={props.help !== ""}>
                <Text tone="quiet">{props.help}</Text>
              </If>
              <If when={props.from}>
                {(from) => (
                  <Text size="under" tone={props.overridden === true ? "caution" : "faint"}>
                    {from()}
                  </Text>
                )}
              </If>
            </View>
          </View>
          <View style={{ alignItems: wide() ? "flex-end" : "flex-start" }}>{props.control}</View>
        </View>
        <Under refusal={props.refusal} style={{ paddingLeft: indent(), paddingTop: 4 }} />
        <View style={{ paddingLeft: indent(), paddingTop: 8 }}>{props.under}</View>
      </View>
    </Row>
  );
}

/** Rows drawn inside a row, as an extension's settings: the category's cursor does not stop on them. */
export function Unlisted(props: { children?: JSX.Element }) {
  return <Rows.Provider value={null}>{props.children}</Rows.Provider>;
}
