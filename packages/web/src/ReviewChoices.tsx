import { HStack } from "@astryxdesign/core/HStack";
import { SegmentedControl, SegmentedControlItem } from "@astryxdesign/core/SegmentedControl";
import { Switch } from "@astryxdesign/core/Switch";
import { Text } from "@astryxdesign/core/Text";
import type { SpecItems } from "uraeda-binding";

/** What the choices read of a spec: its risk tier, and the tiers it offers. */
type Tiered = Pick<SpecItems, "riskTier" | "tiers">;

/** What an approval of a spec may change: its risk tier, and the plan review the human set. */
export type Choices = { planReview?: boolean; tier: string };

/** The choices as the spec has them: its tier, else the least risky, and no plan review set. */
export function initialChoices(spec: Tiered | undefined): Choices {
  return { tier: spec?.riskTier ?? spec?.tiers[0]?.value ?? "" };
}

/** What an approval sends of the choices: only what differs from the spec. */
export function approveChoices(spec: Tiered | undefined, { planReview, tier }: Choices) {
  return {
    ...(tier !== spec?.riskTier ? { tier } : {}),
    ...(planReview !== undefined ? { planReview } : {}),
  };
}

/**
 * A spec's risk tier and plan review, as its approval sets them: the plan review follows the
 * tier picked, as the core gives it, unless the human set it.
 */
export function ReviewChoices({
  choices: { planReview, tier },
  onChange,
  spec,
}: {
  choices: Choices;
  onChange: (choices: Choices) => void;
  spec: Tiered | undefined;
}) {
  const plannedReview =
    planReview ?? spec?.tiers.find((choice) => choice.value === tier)?.planReview ?? false;
  return (
    <>
      {/* Its name written before it, as the switch's is beside it: Astryx's control shows none,
          and "low medium high" alone does not say what it sets. */}
      <HStack align="center" gap={3} wrap="wrap">
        <Text aria-hidden type="supporting">
          Risk tier
        </Text>
        <SegmentedControl
          label="Risk tier"
          onChange={(value: string) => onChange({ planReview, tier: value })}
          value={tier}
        >
          {spec?.tiers.map((choice) => (
            <SegmentedControlItem key={choice.value} label={choice.value} value={choice.value} />
          ))}
        </SegmentedControl>
      </HStack>
      <Switch
        label="The plan waits for your review"
        onChange={(checked: boolean) => onChange({ planReview: checked, tier })}
        value={plannedReview}
      />
    </>
  );
}
