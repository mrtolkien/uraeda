# Rulings: Decisions pass

## R1: A merge of two decisions is a change with an edit and a removal

**Decided:** The check's apply run starts a change for a merge: one decision edited in place, the
other deleted on the change's branch, both named in the change's round as the spec step names them.

**Why:** [Change](/skills/uraeda/references/change.md#decisions) edits a decision in place and asks
the human to approve it in a round, and does not forbid a deleted file. The spec already says a
feature is the fallback only when a change cannot carry the edit.

**Alternatives:** Starting a feature for any merge: a spec and a plan for a text edit.

**If wrong:** The apply run starts a feature for merges, and the reference changes in one place.

## R2: Task 3 tests use the fixture's existing decisions

**Decided:** The decision rules tests open `/decisions/git` and `/decisions/task-storage` in the
fixture repository, and the spec page's `Task storage` card, instead of a new `ui-coherence`
decision and feature.

**Why:** The fixture's `git` decision has a MUST with its check, and its `task-storage` has a MUST
NOT that the spec page's feature lists, so no new file is needed. A sixth decision would also change
the counts that the decisions page tests make.

**Alternatives:** Adding `ui-coherence.md` to the fixture.

**If wrong:** The fixture gains the decision, and the tests open it.

## R3: No core code refuses a second check

**Decided:** A second check requested while one waits is refused by the page's disabled button, as
the triage's is, and by no function of the core: task 4 has no test for it.

**Why:** The triage has no `ensure_triage` that refuses in the core, as the plan assumed: its button
is disabled on the page and its file is simply overwritten by the agent run. Sharing the triage's
behaviour means sharing that.

**Alternatives:** A core check that the file exists before a start message: a rule the triage does
not have, and the start message is task 5's.

**If wrong:** Task 5's start message refuses when the file exists, in the server, and its test
covers it.
