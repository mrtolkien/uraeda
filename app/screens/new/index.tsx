// The New page, `/new?kind=session|change|feature`: what to start, and its composer, in the main
// stack, and what a start is often made from, the priorities' proposals and the inbox's notes, in
// the side stack, with the sections the owner's extensions add. `Space n s`, `c`, `f` open it (the
// shell's leader), and `s` `c` `f` switch the kind there. The kind is the address's, read where it is drawn: a switch keeps the panes.
import { newSectionsIn } from "../extension";
import { route } from "../../store";
import { definePane, definePlace } from "../../ui/layout";
import { NewView } from "./NewPane";
import { Sources } from "./Sources";

/** The kind the address names, a session unless it names one. */
const kindNow = () => {
  const now = route();
  return now.page === "new" ? (now.kind ?? "session") : "session";
};

export const newPane = definePane<{ repo: string }>({
  icon: "plus",
  kind: "new",
  stack: "main",
  title: "New",
  view: (props) => <NewView kind={kindNow()} repo={props.args.repo} />,
});

export const newSources = definePane<{ repo: string }>({
  icon: "list",
  kind: "new-sources",
  stack: "side",
  title: "Start from",
  view: (props) => <Sources kind={kindNow()} repo={props.args.repo} />,
});

definePlace("new", (to) =>
  to.repo === undefined
    ? []
    : [newPane({ repo: to.repo }), newSources({ repo: to.repo }), ...newSectionsIn(to.repo)],
);
