// A feature's start, on its session page, where its transcript will be: the steps that make it, as
// they run, each with its time, the hook's output under the commit's step while it runs or once it
// refused. A message sent before the steps end waits under them, and starts the agent once they do.
import { HStack } from "@astryxdesign/core/HStack";
import { Icon } from "@astryxdesign/core/Icon";
import { Link } from "@astryxdesign/core/Link";
import { Spinner } from "@astryxdesign/core/Spinner";
import { Text } from "@astryxdesign/core/Text";
import { spacingVars, typographyVars } from "@astryxdesign/core/theme/tokens.stylex";
import { VStack } from "@astryxdesign/core/VStack";
import * as stylex from "@stylexjs/stylex";

/** A step of the start, and where it is. */
export type StartStep = {
  label: string;
  /** The hook's output, while the commit's step runs or once it refused. */
  output?: string;
  /** Seconds it took, or has taken so far. */
  seconds?: number;
  state: "done" | "running" | "waiting" | "refused";
};

const styles = stylex.create({
  box: { paddingBlock: spacingVars["--spacing-3"] },
  output: {
    fontFamily: typographyVars["--font-family-code"],
    margin: 0,
    marginInlineStart: spacingVars["--spacing-6"],
    maxHeight: "var(--size-hook-output, 10rem)",
    overflow: "auto",
    whiteSpace: "pre-wrap",
  },
  // The icon's column, so the labels line up whatever the state.
  mark: { display: "inline-flex", justifyContent: "center", width: spacingVars["--spacing-4"] },
});

function Mark({ state }: { state: StartStep["state"] }) {
  return (
    <span {...stylex.props(styles.mark)}>
      {state === "running" ? (
        <Spinner aria-hidden shade="subtle" size="sm" />
      ) : state === "done" ? (
        <Icon color="success" icon="uraeda:badge-check" label="Done" size="sm" />
      ) : state === "refused" ? (
        <Icon color="error" icon="uraeda:triangle-alert" label="Refused" size="sm" />
      ) : (
        <Icon color="secondary" icon="uraeda:hourglass" label="Waiting" size="sm" />
      )}
    </span>
  );
}

/**
 * The start's steps, `title` naming what starts, and `queued`, the message sent before they end:
 * it starts the agent once they do. A refused step says where the proposal is.
 */
export function StartStepsView({
  onProposal,
  queued,
  steps,
  title,
}: {
  onProposal: () => void;
  queued?: string | undefined;
  steps: ReadonlyArray<StartStep>;
  title: string;
}) {
  const refused = steps.some((step) => step.state === "refused");
  return (
    <VStack gap={2} xstyle={styles.box}>
      <Text weight="semibold">{title}</Text>
      {steps.map((step) => (
        <VStack gap={1} key={step.label}>
          <HStack align="baseline" gap={2}>
            <Mark state={step.state} />
            <Text color={step.state === "waiting" ? "secondary" : undefined}>{step.label}</Text>
            {step.seconds !== undefined && (
              <Text color="secondary" hasTabularNumbers type="supporting">
                {`${step.seconds} s`}
              </Text>
            )}
          </HStack>
          {step.output && <pre {...stylex.props(styles.output)}>{step.output}</pre>}
        </VStack>
      ))}
      {refused ? (
        <Text color="secondary" type="supporting">
          {"Nothing was committed: your proposal is in its file, as you left it. "}
          <Link onClick={onProposal}>Open the proposal</Link>
          {queued ? " Your message stays in the composer, unsent." : ""}
        </Text>
      ) : (
        queued && (
          <Text color="secondary" type="supporting">
            {"Your message is queued: the agent starts with it once the steps end."}
          </Text>
        )
      )}
    </VStack>
  );
}
