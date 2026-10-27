// What each kind of the New page looks like, drawn small, so that a card shows what it starts
// instead of describing it: a Session is a chat, bubbles of the human on the right and of the agent
// on the left; a Change is a message that comes back as a pull request, with questions in between
// if the agent needs them (dashed); a Feature starts from a proposal, then questions, a spec to
// review, and a pull request. The longer the chain, the bigger the work. Skeleton lines stand for
// text. Decorative: the card's name and its sentence for screen readers say what it is.
import { Icon } from "@astryxdesign/core/Icon";
import { Text } from "@astryxdesign/core/Text";
import { borderVars, colorVars, spacingVars } from "@astryxdesign/core/theme/tokens.stylex";
import * as stylex from "@stylexjs/stylex";
import type { ReactNode } from "react";
import type { NewKind } from "./routes.tsx";

/** The size of a speech bubble's tail. */
const TAIL = "6px";

const styles = stylex.create({
  // The agent's bubble, at the start, its tail at its bottom start corner.
  agent: {
    "::after": {
      borderBlockStartColor: colorVars["--color-border"],
      borderBlockStartStyle: "solid",
      borderBlockStartWidth: TAIL,
      borderInlineEndColor: "transparent",
      borderInlineEndStyle: "solid",
      borderInlineEndWidth: TAIL,
      borderInlineStartColor: "transparent",
      borderInlineStartStyle: "solid",
      borderInlineStartWidth: TAIL,
      content: '""',
      height: 0,
      insetBlockEnd: `calc(-1 * ${TAIL} - 1px)`,
      insetInlineStart: spacingVars["--spacing-2"],
      position: "absolute",
      width: 0,
    },
    alignSelf: "flex-start",
    width: "74%",
  },
  // A bubble: a bordered rectangle that holds lines of text.
  bubble: {
    backgroundColor: colorVars["--color-background-muted"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    flexShrink: 0,
    padding: spacingVars["--spacing-2"],
    position: "relative",
  },
  // A choice's chip, picked or not.
  chip: {
    alignItems: "center",
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    display: "flex",
    fontSize: "0.75em",
    height: spacingVars["--spacing-4"],
    justifyContent: "center",
    width: spacingVars["--spacing-4"],
  },
  chipPicked: {
    backgroundColor: colorVars["--color-accent"],
    borderColor: colorVars["--color-accent"],
    color: colorVars["--color-on-accent"],
  },
  chips: { display: "flex", gap: spacingVars["--spacing-1"] },
  // What a skeleton line stands for: a line of text.
  line: {
    backgroundColor: colorVars["--color-text-secondary"],
    height: "5px",
    opacity: 0.4,
  },
  lines: {
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-1"],
    minWidth: 0,
  },
  // A step that happens only if the agent needs it.
  optional: { borderStyle: "dashed" },
  // The art's frame: one height for the three, so the cards line up.
  stage: {
    alignItems: "stretch",
    display: "flex",
    flexDirection: "column",
    gap: spacingVars["--spacing-2"],
    height: "11.5rem",
    justifyContent: "center",
    minWidth: 0,
  },
  // One step of a flow: its icon and its name, and what it holds at its end.
  step: {
    alignItems: "center",
    backgroundColor: colorVars["--color-background-muted"],
    borderColor: colorVars["--color-border"],
    borderStyle: "solid",
    borderWidth: borderVars["--border-width"],
    boxSizing: "border-box",
    display: "flex",
    flexShrink: 0,
    gap: spacingVars["--spacing-2"],
    minHeight: spacingVars["--spacing-6"],
    paddingInline: spacingVars["--spacing-2"],
  },
  stepArt: {
    alignItems: "center",
    display: "flex",
    marginInlineStart: "auto",
  },
  stepName: { whiteSpace: "nowrap" },
  // Between two steps: an arrow down, the agent's work.
  then: { display: "flex", flexShrink: 0, justifyContent: "center", marginBlock: "-4px" },
  // The human's bubble, at the end, tinted as a picked row is, its tail at its bottom end corner.
  you: {
    "::after": {
      borderBlockStartColor: colorVars["--color-accent"],
      borderBlockStartStyle: "solid",
      borderBlockStartWidth: TAIL,
      borderInlineEndColor: "transparent",
      borderInlineEndStyle: "solid",
      borderInlineEndWidth: TAIL,
      borderInlineStartColor: "transparent",
      borderInlineStartStyle: "solid",
      borderInlineStartWidth: TAIL,
      content: '""',
      height: 0,
      insetBlockEnd: `calc(-1 * ${TAIL} - 1px)`,
      insetInlineEnd: spacingVars["--spacing-2"],
      position: "absolute",
      width: 0,
    },
    alignSelf: "flex-end",
    backgroundColor: colorVars["--color-accent-muted"],
    borderColor: colorVars["--color-accent"],
    width: "58%",
  },
});

/** Skeleton lines, each a width of its block: what a line of text is, drawn. */
function Lines({ widths }: { widths: ReadonlyArray<string> }) {
  return (
    <div {...stylex.props(styles.lines)}>
      {widths.map((width, at) => (
        <div key={at} style={{ width }} {...stylex.props(styles.line)} />
      ))}
    </div>
  );
}

/** An arrow between two steps. */
function Then() {
  return (
    <div {...stylex.props(styles.then)}>
      <Icon color="secondary" icon="arrowDown" size="xsm" />
    </div>
  );
}

/** A step: its icon and name, and `children` at its end; dashed when it may not happen. */
function Step({
  children,
  icon,
  isOptional = false,
  name,
}: {
  children?: ReactNode;
  icon: string;
  isOptional?: boolean;
  name: string;
}) {
  return (
    <div {...stylex.props(styles.step, isOptional && styles.optional)}>
      <Icon color="secondary" icon={icon} size="sm" />
      <Text type="supporting" xstyle={styles.stepName}>
        {name}
      </Text>
      <span {...stylex.props(styles.stepArt)}>{children}</span>
    </div>
  );
}

/** A few skeleton lines at a step's end, of a width of its own. */
function Text3({ widths }: { widths: ReadonlyArray<string> }) {
  return (
    <div style={{ width: "3.5rem" }}>
      <Lines widths={widths} />
    </div>
  );
}

/** The questions of a flow: the agent asks, the human picks one of the choices. */
function Questions({ isOptional = false }: { isOptional?: boolean }) {
  return (
    <Step icon="uraeda:step-questions" isOptional={isOptional} name="Questions">
      <span {...stylex.props(styles.chips)}>
        <span {...stylex.props(styles.chip)}>A</span>
        <span {...stylex.props(styles.chip, styles.chipPicked)}>B</span>
      </span>
    </Step>
  );
}

/** A pull request as a step: ready, checked. */
function PullRequest() {
  return (
    <Step icon="uraeda:step-pull-request" name="Pull request">
      <Icon color="success" icon="check" size="sm" />
    </Step>
  );
}

/** A chat: the human's bubbles at the end, the agent's at the start, one after the other. */
function Session() {
  return (
    <>
      <div {...stylex.props(styles.bubble, styles.you)}>
        <Lines widths={["90%", "50%"]} />
      </div>
      <div {...stylex.props(styles.bubble, styles.agent)}>
        <Lines widths={["100%", "85%", "55%"]} />
      </div>
      <div {...stylex.props(styles.bubble, styles.you)}>
        <Lines widths={["70%"]} />
      </div>
      <div {...stylex.props(styles.bubble, styles.agent)}>
        <Lines widths={["95%", "60%"]} />
      </div>
    </>
  );
}

/** A change: one message in, a pull request out, with questions between if the agent needs them. */
function Change() {
  return (
    <>
      <Step icon="uraeda:comment" name="Message">
        <Text3 widths={["100%", "60%"]} />
      </Step>
      <Then />
      <Questions isOptional />
      <Then />
      <PullRequest />
    </>
  );
}

/** A feature: from a proposal, questions to answer, a spec to review, then a pull request. */
function Feature() {
  return (
    <>
      <Step icon="uraeda:step-proposal" name="Proposal">
        <Text3 widths={["100%", "70%"]} />
      </Step>
      <Then />
      <Questions />
      <Then />
      <Step icon="uraeda:step-spec" name="Spec review">
        <Text3 widths={["100%", "80%", "90%"]} />
      </Step>
      <Then />
      <PullRequest />
    </>
  );
}

/** The drawing of a kind, in a frame as tall for each. */
export function KindArt({ kind }: { kind: NewKind }) {
  return (
    <div aria-hidden="true" {...stylex.props(styles.stage)}>
      {kind === "session" ? <Session /> : kind === "change" ? <Change /> : <Feature />}
    </div>
  );
}
