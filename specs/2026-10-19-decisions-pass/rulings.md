# Rulings: Decisions pass

## R1: A merge of two decisions is a change with an edit and a removal

**Decided:** The check's apply run starts a change for a merge: one decision edited in place, the
other deleted on the change's branch, both named in the change's round as the spec step names them.

**Why:** [Change](/skills/uraeda/references/change.md#decisions) edits a decision in place and asks
the human to approve it in a round, and does not forbid a deleted file. The spec already says a
feature is the fallback only when a change cannot carry the edit.

**Alternatives:** Starting a feature for any merge: a spec and a plan for a text edit.

**If wrong:** The apply run starts a feature for merges, and the reference changes in one place.
