// Mockups of a feature's settings, opened from the "…" of its card: a dialog on wide screens, a
// bottom sheet on the phone.
import type { Meta, StoryObj } from "@storybook/react-vite";
import { Overlay } from "../layout/Overlay.tsx";
import { type CardColor } from "./ItemCard.tsx";
import { FeatureSettingsForm } from "./FeatureSettings.tsx";

function Settings({ color, label }: { color?: CardColor; label: string }) {
  return (
    <Overlay isOpen label="Feature settings" onClose={() => {}} sheetHeight="hug">
      <FeatureSettingsForm
        color={color}
        label={label}
        onCancel={() => {}}
        onSave={async () => {}}
        slug="redesign-interface"
      />
    </Overlay>
  );
}

const meta = {
  component: Settings,
  title: "Sidebar/Feature settings",
} satisfies Meta<typeof Settings>;

export default meta;

type Story = StoryObj<typeof meta>;

/** A feature shown by its slug, without a colour: the field's placeholder is the slug. */
export const BySlug: Story = { args: { label: "" } };

/** A feature named "Sidebar", in purple. */
export const Named: Story = { args: { color: "purple", label: "Sidebar" } };
