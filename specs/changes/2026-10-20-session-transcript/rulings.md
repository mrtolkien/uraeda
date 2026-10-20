# Rulings: Session transcript speed and coherence

The low-impact choices made while making [the proposal](proposal.md), inside the active decisions.
None binds future work: those are decisions.

## R1: A folded tool group mounts one row, through a sparse array

- **Decision**: a folded group of tool calls hands Astryx's `ChatToolCalls` an array of the group's
  length with only its last call set; opened, it hands the real calls.
- **Rationale**: `ChatToolCalls` maps every call into a hidden, `inert` row, even collapsed. Its
  header reads only the count and the latest call, and `map` skips holes, so one row mounts and the
  header stays Astryx's own. [`ToolGroups.tsx`](/packages/web/src/ToolGroups.tsx)
- **Alternatives considered**: a custom folded button, which looked different from Astryx's header;
  rows without their output, memoized, which still mounts thousands of nodes.
- **If wrong**: an Astryx upgrade that reads more of `calls` while collapsed shows a wrong header.
  Report it upstream, or draw the header ourselves.
- **Where**: the first item.

## R2: The tail still counts messages, not items

- **Decision**: the tail keeps drawing the latest 20 messages, as before: the folded groups made
  what lies between them cheap, so no second bound is added.
- **Rationale**: [`tail.tsx`](/packages/web/src/tail.tsx) already counts only `message` and `text`
  items. The cost was the tool calls drawn between them.
- **Alternatives considered**: a cap in items, and a start that slides forward at the end of the
  page: more behaviour to keep (R8, R15 of the tail) for a cost the folds already remove.
- **If wrong**: a session of thousands of non-tool items between 20 messages would lag again.
- **Where**: the first item.

## R3: The session's column is a `Page` property, 95ch

- **Decision**: `Page` takes `isSession`, which on wide screens caps the column at
  `--size-session-max`, 95ch, about 115 characters a line.
- **Rationale**: the proposal asks for about 120 characters (95ch). The cap hung off `isSnug`, a
  padding flag, before this. [`Page.tsx`](/packages/web/src/layout/Page.tsx)
- **Alternatives considered**: 90ch, the reading measure of documents: a session also holds code and
  tool rows beside its text.
- **If wrong**: change the one token in [`theme.ts`](/packages/web/src/theme/theme.ts).
- **Where**: the second item.

## R4: Legacy reading styles stay, on a list that only shrinks

- **Decision**: seven files that set the reading size by hand are listed in the lint test, which
  fails for any other file. Moving them to `Prose.tsx` is a follow-up.
- **Rationale**: the proposal's scope is the session and the spec's document view. Moving all seven
  is a larger change to views this change has no reason to touch.
- **Alternatives considered**: moving them all here.
- **If wrong**: the list never shrinks, and the rule stays half-enforced: note it in the inbox.
- **Where**: the second item, [`lint.test.ts`](/packages/web/src/__tests__/lint.test.ts).
