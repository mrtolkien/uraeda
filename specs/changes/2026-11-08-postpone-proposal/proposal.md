# Postponing a feature makes a proposal

Postponing a feature asks the agent to write its current state as a proposal: this way it's only a
proposal.

It's simpler: postponing a feature drops the feature folder, and makes a new agent-written proposal.
Today the postponed folder keeps its discovery, questions, and spec under `specs/proposals/`, but
the UI only shows its `proposal.md`, so all of that is invisible.
