// The triage's page: its questions in main, and the inbox beside them in side, so a note a
// question names is read where it sits. On a phone the inbox is one tile away.
import { definePane, definePlace } from "../../ui/layout";
import { inboxList } from "../inbox";
import { TriageView } from "./TriagePane";

export const triage = definePane<{ repo: string }>({
  icon: "message-circle-question",
  kind: "inbox-triage",
  stack: "main",
  title: "Triage",
  view: (props) => <TriageView repo={props.args.repo} />,
});

definePlace("triage", (route) => [
  triage({ repo: route.repo ?? "" }),
  { pane: inboxList({ repo: route.repo ?? "" }), stack: "side" },
]);
