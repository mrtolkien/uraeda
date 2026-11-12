// The priorities' place: `/priorities`, the list, and `/priorities/<key>`, a proposal with the list
// beside it.
//
// A proposal's own pane, where its text is written and its work started, is task 38's. It joins
// without a change here: a module that declares a kind of pane named `proposal`, with the
// arguments `{ repo, key }`, takes the place of this summary, in its kind's stack.
import { addProposal, Priorities } from "./Priorities";
import { Proposal } from "./Proposal";
import {
  definePane,
  definePlace,
  kindOf,
  paneKey,
  type PaneRef,
  type Placed,
} from "../../ui/layout";

export const prioritiesPane = definePane<{ repo: string; open?: string }>({
  action: () => ({ icon: "plus", label: "Add", run: addProposal }),
  icon: "list",
  kind: "priorities",
  stack: "main",
  title: "Priorities",
  view: (props) => <Priorities open={props.args.open} repo={props.args.repo} width={props.width} />,
});

export const proposalSummary = definePane<{ repo: string; key: string }>({
  icon: "file-text",
  kind: "proposal-summary",
  stack: "main",
  title: "Proposal",
  view: (props) => <Proposal id={props.args.key} repo={props.args.repo} />,
});

/** The proposal's pane: task 38's `proposal` once declared, else its summary. */
function proposalPane(args: { repo: string; key: string }): PaneRef {
  const own = kindOf({ args, closes: false, key: "", kind: "proposal" });
  return own === undefined
    ? proposalSummary(args)
    : { args, closes: own.closes === true, key: paneKey("proposal", args), kind: "proposal" };
}

definePlace("priorities", (route) => [prioritiesPane({ repo: route.repo ?? "" })]);

definePlace("proposal", (route): ReadonlyArray<Placed> => {
  const repo = route.repo ?? "";
  return [
    proposalPane({ key: route.key, repo }),
    { pane: prioritiesPane({ open: route.key, repo }), stack: "side" as const },
  ];
});
