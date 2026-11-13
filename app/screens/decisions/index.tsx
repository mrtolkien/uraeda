// The decisions: the constitution and every decision of the default branch, each read whole, and a
// decision as a feature's branch has it. Each page is the reader in the main stack, the widest,
// where prose keeps its measure, and the ledger's list in the side stack beside it; on a phone, the
// list's page shows the list first.
import { route } from "../../store";
import { definePlace } from "../../ui/layout";
import { isNarrow } from "../../ui/width";
import { branchDecisionPane } from "./Branch";
import { listPane } from "./List";
import { constitutionPane, decisionPane } from "./Reader";

/** The repository of the page shown: every route of a repository's pages names one. */
const repoOf = (shown: { repo?: string }) => shown.repo ?? route().repo ?? "";

// `/decisions` reads the constitution beside the list, as `/decisions/constitution` does, with the
// focus on the list: `g d` comes to pick a decision, and the list's `j`, `Enter`, and `/` work at
// once, as Git's changes do beside their diff. On a phone the list is what the page is for: it
// comes first, and the constitution is its next pane.
definePlace("decisions", (shown) =>
  isNarrow()
    ? [
        { pane: listPane({ repo: repoOf(shown) }), stack: "main" },
        { pane: constitutionPane({ repo: repoOf(shown) }), stack: "side" },
      ]
    : [
        constitutionPane({ repo: repoOf(shown) }),
        { focus: true, pane: listPane({ repo: repoOf(shown) }), stack: "side" },
      ],
);
definePlace("constitution", (shown) => [
  constitutionPane({ repo: repoOf(shown) }),
  listPane({ repo: repoOf(shown) }),
]);
definePlace("decision", (shown) => [
  decisionPane({ name: shown.name, repo: repoOf(shown) }),
  listPane({ repo: repoOf(shown) }),
]);
definePlace("branch-decision", (shown) => [
  branchDecisionPane({ folder: shown.folder, name: shown.name, repo: repoOf(shown) }),
  listPane({ repo: repoOf(shown) }),
]);
