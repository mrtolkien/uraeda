// A feature's or a change's settings, from the "…" of its card: its name in the sidebar and its
// colour, kept by the server for this repository. An empty name shows the slug again.
import { Button } from "@astryxdesign/core/Button";
import { HStack } from "@astryxdesign/core/HStack";
import { RadioList, RadioListItem } from "@astryxdesign/core/RadioList";
import { Text } from "@astryxdesign/core/Text";
import { TextInput } from "@astryxdesign/core/TextInput";
import { VStack } from "@astryxdesign/core/VStack";
import { colorVars, radiusVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { useState } from "react";
import { type CardColor, COLORS } from "./ItemCard.tsx";

/** The longest name, so a card keeps one line in the widest sidebar. */
export const LABEL_MAX = 40;

const NAMES: Record<CardColor, string> = {
  blue: "Blue",
  green: "Green",
  orange: "Orange",
  pink: "Pink",
  purple: "Purple",
  red: "Red",
  teal: "Teal",
  yellow: "Yellow",
};

const styles = stylex.create({
  swatch: {
    borderRadius: radiusVars["--radius-inner"],
    display: "inline-block",
    height: spacingVars["--spacing-3"],
    width: spacingVars["--spacing-3"],
  },
});

const swatches = stylex.create({
  blue: { backgroundColor: colorVars["--color-icon-blue"] },
  green: { backgroundColor: colorVars["--color-icon-green"] },
  orange: { backgroundColor: colorVars["--color-icon-orange"] },
  pink: { backgroundColor: colorVars["--color-icon-pink"] },
  purple: { backgroundColor: colorVars["--color-icon-purple"] },
  red: { backgroundColor: colorVars["--color-icon-red"] },
  teal: { backgroundColor: colorVars["--color-icon-teal"] },
  yellow: { backgroundColor: colorVars["--color-icon-yellow"] },
});

export function FeatureSettingsForm({
  color,
  label,
  onCancel,
  onSave,
  slug,
}: {
  color: CardColor | undefined;
  /** The name it has, empty when it shows its slug. */
  label: string;
  onCancel: () => void;
  onSave: (settings: { color: CardColor | undefined; label: string }) => Promise<void>;
  slug: string;
}) {
  const [name, setName] = useState(label);
  const [picked, setPicked] = useState<string>(color ?? "none");
  const changed = name.trim() !== label || picked !== (color ?? "none");
  const save = () =>
    onSave({
      color: picked === "none" ? undefined : (picked as CardColor),
      label: name.trim(),
    });
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
      <RadioList label="Colour" onChange={setPicked} value={picked}>
        <RadioListItem label="None" value="none" />
        {COLORS.map((key) => (
          <RadioListItem
            key={key}
            label={NAMES[key]}
            startContent={<span {...stylex.props(styles.swatch, swatches[key])} />}
            value={key}
          />
        ))}
      </RadioList>
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
