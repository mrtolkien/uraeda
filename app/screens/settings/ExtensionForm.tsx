// An extension's settings, under its row, from its manifest: for every repository or one, picked
// first; then each setting, a row of its own: a switch or a whole number saved at once, a line saved
// on Enter, a list saved with Ctrl+Enter or its button. A value set for one repository shows over
// the shared one, with what clears it back. The core checks and writes each in `config.toml`.
import { type JSX, View } from "nsh";
import { objectOf } from "./extensionWords";
import { savedField } from "./fields";
import { FieldRow, Unlisted } from "../../ui/lists";
import { call, record } from "../../store";
import type { ExtensionRow, ExtensionSetting, JsonValue } from "../../store/protocol";
import { Button, NumberInput, Select, sent, Switch, Text } from "../../ui/controls";
import { usePane } from "../../ui/layout";
import { TextField } from "../../ui/text";

/** The scope's value for every repository: no repository's name holds `*`. */
const EVERY = "*";

/** What a setting's row reads and sends. */
type Props = {
  extension: string;
  /** The repository the value is for, `null` for every one. */
  repository: string | null;
  spec: ExtensionSetting;
  /** Its value: the repository's own, else the shared one, else its default. */
  value: () => unknown;
  /** Whether the repository has its own value. */
  own: () => boolean;
};

/** Sends a value, JSON `null` clearing it back to the shared one or the default. */
const save = (props: Props, value: JsonValue) =>
  call("extensions.setSetting", {
    key: props.spec.key,
    name: props.extension,
    repository: props.repository,
    value,
  });

/** A text's lines, blank ones left out. */
const linesOf = (text: string) => text.split("\n").filter((line) => line.trim() !== "");

/** A switch or a whole number: saved at once, with `sent`. */
function AtOnce(props: Props & { clear?: JSX.Element }) {
  const isBool = props.spec.kind === "bool";
  const value = sent<JsonValue>(
    () => (props.value() ?? null) as JsonValue,
    (next) => save(props, next),
  );
  return (
    <FieldRow
      control={
        isBool ? (
          <Switch
            label={value.value() === true ? "on" : "off"}
            onChange={value.set}
            pending={value.pending()}
            value={value.value() === true}
          />
        ) : (
          <NumberInput
            label={props.spec.label}
            onChange={(next) => next !== null && value.set(next)}
            value={typeof value.value() === "number" ? (value.value() as number) : null}
            width={110}
          />
        )
      }
      from={props.own() ? `Set for ${props.repository} only` : null}
      help={props.spec.help}
      icon={isBool ? "circle-dot" : "ruler"}
      id={props.spec.key}
      label={props.spec.label}
      refusal={value.refusal()}
      under={props.clear}
    />
  );
}

/** A line, or a list of lines: kept on the device while typed, saved by Enter or Ctrl+Enter. */
function Typed(props: Props & { clear?: JSX.Element }) {
  const isList = props.spec.kind === "list";
  const shown = () => {
    const value = props.value();
    if (isList) return Array.isArray(value) ? value.map(String).join("\n") : "";
    return value === null || value === undefined ? "" : String(value);
  };
  const field = savedField(
    `extension-${props.extension}-${props.repository ?? EVERY}-${props.spec.key}`,
    shown,
    (text) => save(props, isList ? linesOf(text) : text),
  );
  return (
    <FieldRow
      from={props.own() ? `Set for ${props.repository} only` : null}
      help={props.spec.help}
      icon={isList ? "list" : "text-cursor-input"}
      id={props.spec.key}
      label={props.spec.label}
      refusal={field.refusal()}
      under={
        <View style={{ alignItems: "flex-start", gap: 6 }}>
          <TextField
            label={props.spec.label}
            lines={isList ? "many" : "one"}
            onChange={field.field.change}
            onEnter={isList ? undefined : () => void field.submit()}
            onSave={() => void field.submit()}
            placeholder={isList ? "One per line, Ctrl+Enter saves" : "Enter saves"}
            style={{ alignSelf: "stretch" }}
            value={field.field.text()}
          />
          <If when={isList}>
            <Button
              disabled={!field.field.dirty()}
              icon="save"
              label="Save"
              onPress={() => void field.submit()}
              pending={field.pending()}
            />
          </If>
          {props.clear}
        </View>
      }
    />
  );
}

/** What clears a repository's own value, back to the shared one. */
function Clear(props: Props) {
  return (
    <If when={props.own() && props.repository !== null}>
      <View style={{ alignItems: "flex-start" }}>
        <Button
          icon="undo-2"
          label="Use the shared value"
          onPress={() => void save(props, null).catch(() => undefined)}
        />
      </View>
    </If>
  );
}

/** An extension's settings, for every repository or the one picked. */
export function ExtensionForm(props: { row: ExtensionRow }) {
  const pane = usePane();
  const scope = pane.remember<string>(`scope-${props.row.name}`, EVERY);
  const repositories = record("Repositories", null);
  const repository = () => (scope() === EVERY ? null : scope());
  const own = () => {
    const name = repository();
    return name === null ? {} : objectOf(objectOf(props.row.repositoryValues)[name]);
  };
  const valueOf = (spec: ExtensionSetting) => () => {
    const mine = own();
    if (spec.key in mine) return mine[spec.key];
    const shared = objectOf(props.row.values);
    return spec.key in shared ? shared[spec.key] : spec.default;
  };
  return (
    <View style={{ gap: 6 }}>
      <View style={{ alignItems: "center", flexDirection: "row", flexWrap: "wrap", gap: 8 }}>
        <Text tone="quiet">Settings for</Text>
        <Select
          label={`${props.row.title}'s settings for`}
          onChange={scope.set}
          options={[
            { label: "Every repository", value: EVERY },
            ...(repositories()?.rows ?? []).map((one) => ({ label: one.name, value: one.name })),
          ]}
          value={scope()}
          width={220}
        />
      </View>
      <If when={repository()}>
        {(name) => (
          <Text tone="faint">{`A value saved here applies to ${name()} only, over the one for every repository.`}</Text>
        )}
      </If>
      <Unlisted>
        <Each key={(spec: ExtensionSetting) => `${scope()}:${spec.key}`} of={props.row.settings}>
          {(spec) => {
            const shared: Props = {
              extension: props.row.name,
              own: () => spec().key in own(),
              repository: repository(),
              spec: spec(),
              value: valueOf(spec()),
            };
            return spec().kind === "bool" || spec().kind === "integer" ? (
              <AtOnce {...shared} clear={<Clear {...shared} />} />
            ) : (
              <Typed {...shared} clear={<Clear {...shared} />} />
            );
          }}
        </Each>
      </Unlisted>
    </View>
  );
}
