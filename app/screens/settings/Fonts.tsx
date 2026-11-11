// The Fonts category, kept on this device: the font of each part of the app, among the bundled
// ones, shown at once; then the way back to the defaults. `Space u f` picks the same from the keys.
import { View } from "nsh";
import { CATEGORIES } from "./categories";
import { chooseFont, fontPicked } from "./look";
import { FieldRow, FieldRows } from "../../ui/lists";
import { device } from "../../store";
import { Button, Select } from "../../ui/controls";
import { DEFAULT_FONTS, FONT_ROLES, FONTS, fontOf, type FontRole } from "../../ui/tokens";

const OPTIONS = FONTS.map((font) => ({
  hint: font.measure > 45 ? "monospace" : undefined,
  label: font.label,
  value: font.id,
}));

/** Where a part's font comes from, in words. */
function fromOf(role: FontRole): string {
  return device.get("fonts")?.[role] === undefined
    ? `The default, ${fontOf(role, DEFAULT_FONTS[role]).label}`
    : "Kept on this device: each device picks its own";
}

export function Fonts() {
  const openers = new Map<FontRole, () => void>();
  const rows = () => [
    ...FONT_ROLES.map(({ role }) => ({ act: () => openers.get(role)?.(), id: role })),
    { act: () => device.set("fonts", undefined), id: "defaults" },
  ];
  const settings = CATEGORIES.find((one) => one.id === "fonts")!.settings;
  return (
    <FieldRows rows={rows}>
      <Each key={(part: (typeof FONT_ROLES)[number]) => part.role} of={[...FONT_ROLES]}>
        {(part) => (
          <FieldRow
            control={
              <Select
                label={part().label}
                onChange={(id) => chooseFont(part().role, id)}
                opener={(open) => openers.set(part().role, open)}
                options={OPTIONS}
                value={fontPicked(part().role)}
                width={320}
              />
            }
            from={fromOf(part().role)}
            help={settings.find((one) => one.label === part().label)?.help ?? part().help}
            icon="text-cursor-input"
            id={part().role}
            label={part().label}
          />
        )}
      </Each>
      <FieldRow
        control={
          <View style={{ alignItems: "flex-start" }}>
            <Button
              disabled={device.get("fonts") === undefined}
              icon="undo-2"
              label="Use the default fonts"
              onPress={() => device.set("fonts", undefined)}
            />
          </View>
        }
        help="Every part back to its default, as Space u f d does."
        icon="undo-2"
        id="defaults"
        label="Default fonts"
      />
    </FieldRows>
  );
}
