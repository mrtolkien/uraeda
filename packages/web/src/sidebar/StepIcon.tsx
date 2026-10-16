// A feature's or a change's step as an icon, at the start of its row in the sidebar: the step's name
// is in the row's accessible name, so the icon is hidden from screen readers.
import { Icon } from "@astryxdesign/core/Icon";

/** The steps the sidebar draws apart, from the core's step and the file a gate waits on. */
export type StepKind =
  | "proposal"
  | "discovery"
  | "questions"
  | "spec"
  | "plan"
  | "implementation"
  | "review"
  | "pull-request"
  | "change"
  | "done"
  | "problem";

/** Each step's icon: the app's own, registered through the theme, or Astryx's. */
const ICONS = {
  change: "wrench",
  discovery: "uraeda:step-discovery",
  done: "check",
  implementation: "uraeda:step-implementation",
  plan: "uraeda:step-plan",
  problem: "warning",
  proposal: "uraeda:step-proposal",
  "pull-request": "uraeda:step-pull-request",
  questions: "uraeda:step-questions",
  review: "uraeda:step-review",
  spec: "uraeda:step-spec",
} as const;

export function StepIcon({ step }: { step: StepKind }) {
  return <Icon color={step === "problem" ? "warning" : "secondary"} icon={ICONS[step]} size="sm" />;
}
