// An extension's settings, under its row, from its manifest's schema: for every repository or one,
// picked first; then each setting, its name, its help, and its control: a switch, a whole number or
// a line edited in place as the port is, or a list, one value per line, saved with Save or
// Ctrl+Enter as the Vim commands are. For one repository, a value set there shows with what clears
// it back to the shared one. The core checks and writes each value into `config.toml`.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Selector } from "@astryxdesign/core/Selector";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";
import type { SettingSpec } from "uraeda-binding";
import { EditableLine } from "../EditableLine.tsx";
import { SaveKeys } from "../fields/SaveKeys.tsx";
import { TextField } from "../fields/TextField.tsx";
import { useTextField } from "../fields/useTextField.ts";
import { AnnouncedBanner } from "../layout/AnnouncedBanner.tsx";
import { type ExtensionRow, ownValuesOf, valuesOf } from "./extensions.ts";
import { useRefusal } from "./SettingRow.tsx";

/**
 * Sends a setting's value, as JSON, for a repository or every one (`null`): JSON `null` removes
 * it, so that the shared value, or the default, applies again.
 */
export type SetSetting = (
  name: string,
  repository: string | null,
  key: string,
  valueJson: string,
) => Promise<string | undefined>;

/** The scope picker's value for every repository: no repository's name, which has no `*`. */
const EVERY = "*";

/** What a setting's control reads and sends. */
type ControlProps = {
  extension: string;
  /** The repository the values are for, `null` for every one. */
  repository: string | null;
  save: (valueJson: string) => Promise<string | undefined>;
  spec: SettingSpec;
  value: unknown;
};

/** A setting's value, its default when the file has none or its JSON cannot be read. */
function valueOf(spec: SettingSpec, values: Record<string, unknown>): unknown {
  if (spec.key in values) {
    return values[spec.key];
  }
  try {
    return JSON.parse(spec.defaultJson);
  } catch {
    return null;
  }
}

/** The lines of a list's text, blank ones left out. */
const linesOf = (text: string) => text.split("\n").filter((line) => line.trim() !== "");

/** A text's JSON for a whole-number setting, or why it is not one. */
function integerJson(spec: SettingSpec, text: string): { json: string } | { refused: string } {
  const trimmed = text.trim();
  return /^-?\d+$/.test(trimmed)
    ? { json: trimmed }
    : { refused: `${spec.label} is a whole number.` };
}

/** The key of a setting's refusal: one per repository, as each has its own value. */
const refusalKey = ({ extension, repository, spec }: ControlProps) =>
  `extension:${extension}:${repository ?? EVERY}:${spec.key}`;

/** A switch, saved at once. */
function BoolControl(props: ControlProps) {
  const { save, spec, value } = props;
  const [refused, setRefused] = useRefusal(refusalKey(props));
  return (
    <VStack gap={2}>
      <Switch
        label={spec.label}
        onChange={async (on: boolean) => {
          setRefused(undefined);
          setRefused(await save(JSON.stringify(on)));
        }}
        value={value === true}
      />
      {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
    </VStack>
  );
}

/** A whole number or a line, edited in place, saved on Enter or Save. */
function LineControl({ extension, repository, save, spec, value }: ControlProps) {
  const isInteger = spec.kind === "integer";
  return (
    <HStack>
      <EditableLine
        empty={`${spec.label} cannot be empty.`}
        field={`settings.extension.${extension}.${repository ?? EVERY}.${spec.key}`}
        label={spec.label}
        look="field"
        onSave={async (text) => {
          if (!isInteger) {
            return save(JSON.stringify(text));
          }
          const parsed = integerJson(spec, text);
          return "refused" in parsed ? parsed.refused : save(parsed.json);
        }}
        value={value === null || value === undefined ? "" : String(value)}
      />
    </HStack>
  );
}

/** A list, one value per line, kept unsaved until Save or Ctrl+Enter. */
function ListControl(props: ControlProps) {
  const { extension, repository, save, spec, value } = props;
  const lines = Array.isArray(value) ? value.map(String) : [];
  const field = useTextField(
    `settings#extension-${extension}-${repository ?? EVERY}-${spec.key}`,
    lines.join("\n"),
  );
  const [refused, setRefused] = useRefusal(refusalKey(props));
  const [saving, setSaving] = useState(false);
  const submit = async () => {
    const text = field.text;
    setSaving(true);
    setRefused(undefined);
    const refusal = await save(JSON.stringify(linesOf(text)));
    setSaving(false);
    setRefused(refusal);
    if (!refusal) {
      field.saved(text);
    }
  };
  return (
    <VStack gap={2}>
      <TextField
        isLabelHidden
        kind="comment"
        label={spec.label}
        onChange={field.change}
        onSubmit={() => void submit()}
        value={field.text}
      />
      {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
      <HStack align="center" gap={3}>
        <Button
          isDisabled={!field.dirty || saving}
          label="Save"
          onClick={() => void submit()}
          variant="secondary"
        />
        <SaveKeys />
      </HStack>
    </VStack>
  );
}

/** What clears a value set for one repository, back to the one for every repository. */
function OwnValue({ repository, save }: { repository: string; save: ControlProps["save"] }) {
  const [refused, setRefused] = useState<string>();
  return (
    <VStack gap={1}>
      <HStack align="center" gap={2}>
        <Text color="secondary">Set for {repository} only.</Text>
        <Button
          label="Use the shared value"
          onClick={async () => {
            setRefused(undefined);
            setRefused(await save("null"));
          }}
          size="sm"
          variant="ghost"
        />
      </HStack>
      {refused && <AnnouncedBanner collapsible={false} status="error" title={refused} />}
    </VStack>
  );
}

/** A setting: its name and help over its control, a switch's name its own label. */
function SettingField(props: ControlProps & { isOwn: boolean }) {
  const { isOwn, repository, save, spec } = props;
  const own = isOwn && repository !== null && <OwnValue repository={repository} save={save} />;
  if (spec.kind === "bool") {
    return (
      <VStack gap={1}>
        <BoolControl {...props} />
        <Text color="secondary">{spec.help}</Text>
        {own}
      </VStack>
    );
  }
  return (
    <VStack gap={2}>
      <VStack gap={1}>
        <Text weight="semibold">{spec.label}</Text>
        <Text color="secondary">{spec.help}</Text>
      </VStack>
      {spec.kind === "list" ? <ListControl {...props} /> : <LineControl {...props} />}
      {own}
    </VStack>
  );
}

/**
 * An extension's settings: the repository they are for, every one first, then each setting. For
 * one repository, the values shown are its own over those for every repository (R40), and each of
 * its own can be cleared back to the shared one.
 */
export function ExtensionForm({
  repositories,
  row,
  setSetting,
}: {
  repositories: ReadonlyArray<string>;
  row: ExtensionRow;
  setSetting: SetSetting;
}) {
  const [scope, setScope] = useState(EVERY);
  const repository = scope === EVERY ? null : scope;
  const own = repository === null ? {} : ownValuesOf(row, repository);
  const values = { ...valuesOf(row), ...own };
  return (
    <VStack gap={3}>
      <Selector
        label={`${row.title}'s settings for`}
        onChange={setScope}
        options={[
          { label: "Every repository", value: EVERY },
          ...repositories.map((name) => ({ label: name, value: name })),
        ]}
        presentation="popover"
        value={scope}
      />
      {repository !== null && (
        <Text color="secondary">
          A value saved here applies to {repository} only, over the one for every repository.
        </Text>
      )}
      {row.settings.map((spec) => {
        const isOwn = spec.key in own;
        return (
          <SettingField
            extension={row.name}
            isOwn={isOwn}
            // Drawn again as a value is set or cleared here: the field reads its value once.
            key={`${scope}:${spec.key}:${isOwn}`}
            repository={repository}
            save={(valueJson) => setSetting(row.name, repository, spec.key, valueJson)}
            spec={spec}
            value={valueOf(spec, values)}
          />
        );
      })}
    </VStack>
  );
}
