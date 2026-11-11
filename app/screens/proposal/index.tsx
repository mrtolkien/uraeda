// A proposal's own pane, `proposal({ repo, key })`: it takes the place of the priorities' summary
// at `/priorities/<key>` (task 37's `proposalPane`, which finds this kind by its name), in the main
// stack, the priorities beside it.
import { definePane } from "../../ui/layout";
import { ProposalView } from "./ProposalPane";

export const proposalPane = definePane<{ repo: string; key: string }>({
  icon: "file-text",
  kind: "proposal",
  stack: "main",
  title: "Proposal",
  view: (props) => <ProposalView proposalKey={props.args.key} repo={props.args.repo} />,
});
