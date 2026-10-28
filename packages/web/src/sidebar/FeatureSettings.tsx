// A feature's or a change's settings, from Rename in the "…" beside its title: its name in the
// sidebar, kept by the server for this repository. An empty name shows the slug again.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { useState } from "react";

/** The longest name, so a card keeps one line in the widest sidebar. */
export const LABEL_MAX = 40;

export function FeatureSettingsForm({
  label,
  onCancel,
  onSave,
  slug,
}: {
  /** The name it has, empty when it shows its slug. */
  label: string;
  onCancel: () => void;
  onSave: (settings: { label: string }) => Promise<void>;
  slug: string;
}) {
  const [name, setName] = useState(label);
  const changed = name.trim() !== label;
  const save = () => onSave({ label: name.trim() });
  return (
    <VStack gap={4}>
      <TextInput
        description={`Leave it empty to show its slug, ${slug}.`}
        hasAutoFocus
        label="Name in the sidebar"
        onChange={(value: string) => setName(value.slice(0, LABEL_MAX))}
        onEnter={() => {
          if (changed) {
            void save();
          }
        }}
        placeholder={slug}
        value={name}
      />
      <HStack align="center" gap={2} justify="end">
        {changed && (
          <Text color="secondary" type="supporting">
            Unsaved changes
          </Text>
        )}
        <Button label="Cancel" onClick={onCancel} />
        <Button clickAction={save} isDisabled={!changed} label="Save" variant="primary" />
      </HStack>
    </VStack>
  );
}
