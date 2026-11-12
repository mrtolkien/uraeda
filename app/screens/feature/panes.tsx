// The feature page, `/f/<folder>`: one feature or change, from proposal to pull request. Its
// subject, in the main stack, is where it stands and the one thing to do next; beside it, its
// steps and files. The side stack holds its companions: who works on it, what it touches, what it
// cost. On a narrow window the frame folds them into one stack of tabs, in this order. An old
// run's address, `/f/<folder>/runs/<id>`, is the session page's (`store/routes.ts`), not this.
import { definePane, definePlace } from "../../ui/layout";
import { Decisions } from "./Decisions";
import { Figures } from "./Figures";
import { nextStep, Overview } from "./Overview";
import { featureOf, type FeatureArgs } from "./read";
import { Sessions } from "./Sessions";
import { Steps } from "./Steps";

export const featureOverview = definePane<FeatureArgs>({
  action: () => nextStep(),
  icon: "flag",
  kind: "feature-overview",
  mark: (args) => {
    const status = featureOf(args)()?.status.status;
    return { needs: status === "needs-you", running: status === "working" };
  },
  stack: "main",
  title: "Overview",
  view: (props) => <Overview args={props.args} />,
});

export const featureSteps = definePane<FeatureArgs>({
  flush: true,
  icon: "git-branch",
  kind: "feature-steps",
  stack: "main",
  title: "Steps",
  view: (props) => <Steps args={props.args} />,
});

export const featureSessions = definePane<FeatureArgs>({
  icon: "square-terminal",
  kind: "feature-sessions",
  mark: (args) => {
    const feature = featureOf(args)();
    return { count: feature?.sessions.length, running: feature?.status.status === "working" };
  },
  stack: "side",
  title: "Sessions",
  view: (props) => <Sessions args={props.args} />,
});

export const featureDecisions = definePane<FeatureArgs>({
  flush: true,
  icon: "scale",
  kind: "feature-decisions",
  stack: "side",
  title: "Decisions",
  view: (props) => <Decisions args={props.args} />,
});

export const featureFigures = definePane<FeatureArgs>({
  icon: "activity",
  kind: "feature-figures",
  stack: "side",
  title: "Figures",
  view: (props) => <Figures args={props.args} />,
});

definePlace("feature", (route) => {
  const args = { folder: route.folder, repo: route.repo ?? "" };
  return [
    featureOverview(args),
    featureSteps(args),
    featureSessions(args),
    featureDecisions(args),
    featureFigures(args),
  ];
});
