// The account's latest reported five-hour allowance, at the end of the Features section: hidden
// while folded, and until a run reports it.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { Suspense } from "react";
import { useAgent } from "../data.ts";

const styles = stylex.create({
  usage: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

function Bar() {
  const agent = useAgent();
  const { isCollapsed } = useSideNavCollapse();
  const limit = agent?.fiveHourLimit;
  if (!limit || isCollapsed) {
    return null;
  }
  const remaining = Math.max(0, 100 - Math.ceil(limit.percentUsed));
  return (
    <VStack gap={1} xstyle={styles.usage}>
      <Text type="supporting">Claude 5h</Text>
      <ProgressBar
        isLabelHidden
        label="Claude five-hour allowance remaining"
        value={remaining}
        variant={remaining <= 20 ? "error" : "accent"}
      />
      <HStack align="center" gap={1}>
        <Icon icon="clock" />
        <Text color="secondary" type="supporting">
          {remaining}% left · reset{" "}
          <time dateTime={limit.resetsAt}>
            {new Date(limit.resetsAt).toLocaleTimeString([], {
              hour: "2-digit",
              hourCycle: "h23",
              minute: "2-digit",
            })}
          </time>
        </Text>
      </HStack>
    </VStack>
  );
}

/** Usage loads on its own, keeping the navigation visible while its request settles. */
export function Allowance() {
  return (
    <Suspense fallback={null}>
      <Bar />
    </Suspense>
  );
}
