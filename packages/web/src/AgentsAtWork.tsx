// The working features and the account's latest reported five-hour allowance.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { ProgressBar } from "@astryxdesign/core/ProgressBar";
import { SideNavSection, useSideNavCollapse } from "@astryxdesign/core/SideNav";
import { Text } from "@astryxdesign/core/Text";
import { VStack } from "@astryxdesign/core/VStack";
import { spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import { type ReactNode, Suspense } from "react";
import { useAgent } from "./data.ts";

const styles = stylex.create({
  usage: {
    paddingBlock: spacingVars["--spacing-2"],
    paddingInline: spacingVars["--spacing-2"],
  },
});

type Props = { children: ReactNode; empty: boolean };

/** Usage loads independently, keeping the navigation and page visible while its request settles. */
export function AgentsAtWork(props: Props) {
  const fallback = props.empty ? null : (
    <SideNavSection title="Agents at work">{props.children}</SideNavSection>
  );
  return (
    <Suspense fallback={fallback}>
      <WorkingSection {...props} />
    </Suspense>
  );
}

/** A live runner may belong to a chat or another repository, so the allowance can show alone. */
function WorkingSection({ children, empty }: Props) {
  const agent = useAgent();
  const { isCollapsed } = useSideNavCollapse();
  const limit = agent?.fiveHourLimit;
  if (empty && (!limit || isCollapsed)) {
    return null;
  }
  const remaining = limit ? Math.max(0, 100 - Math.ceil(limit.percentUsed)) : 0;
  return (
    <SideNavSection title="Agents at work">
      {children}
      {limit && !isCollapsed && (
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
      )}
    </SideNavSection>
  );
}
