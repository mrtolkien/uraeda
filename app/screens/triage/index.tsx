// The triage's page: its questions in main, and their list and the inbox beside them in side, so a note a
// question names is read where it sits. On a phone the inbox is one tile away.
import { definePane, definePlace } from "../../ui/layout";
import { inboxList } from "../inbox";
import { roundAction, roundMains, roundQuestionsPane } from "../round";
import { TRIAGE_ID } from "./chat";
import { TriageView } from "./TriagePane";

export const triage = definePane<{ repo: string }>({
  action: (args) => roundAction({ id: TRIAGE_ID, repo: args.repo }),
  icon: "message-circle-question",
  kind: "inbox-triage",
  stack: "main",
  title: "Triage",
  view: (props) => <TriageView repo={props.args.repo} />,
});

roundMains.set(TRIAGE_ID, (args) => triage({ repo: args.repo }));

definePlace("triage", (route) => [
  triage({ repo: route.repo ?? "" }),
  roundQuestionsPane({ id: TRIAGE_ID, repo: route.repo ?? "" }),
  { pane: inboxList({ repo: route.repo ?? "" }), stack: "side" },
]);
