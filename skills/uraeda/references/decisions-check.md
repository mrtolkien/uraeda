# The decisions check

When the human asks, an agent reads the constitution and every decision together, and asks how to
keep the ledger clean. It writes its findings as questions in `specs/DECISIONS-CHECK.md`, with each
option's edited decision beside it. The human answers them like a round of questions, and an agent
carries out the answers. Both runs happen in the default branch's checkout and need no feature, as
[the inbox triage](inbox.md#the-triage) does. The check owns its rules here; what a decision is
belongs to [the bar](spec.md#what-is-a-decision).

The check files are two:

- `specs/DECISIONS-CHECK.md`, from [the template](../assets/templates/specs/DECISIONS-CHECK.md);
- `specs/decisions-check/q<N>-<letter>/<topic>.md`, the edited decision of option `<letter>` of
  question `<N>`, from
  [the decision template](../assets/templates/specs/decisions/decision-topic.md), with the same file
  name as the decision it replaces.
  [The example's check](../assets/example/specs/DECISIONS-CHECK.md) and
  [its candidate](../assets/example/specs/decisions-check/q1-a/code-quality.md) show both.

A candidate is not a decision of the ledger: nothing reads `specs/decisions-check/` as one, and it
is deleted when the check is applied.

## Running a check

1. **Refuse a second check.** When `specs/DECISIONS-CHECK.md` exists, stop and say: "A decisions
   check already waits: answer or delete specs/DECISIONS-CHECK.md first."
2. **Read the constitution and every decision**, active or proposed, of `specs/decisions/`. Hold
   each decision to [the bar](spec.md#what-is-a-decision) and to the others. A finding is one of:
   - two decisions that say the same thing, or one that the other makes redundant;
   - a decision, or a rule, that fails the bar: it names a flag, a timeout, a file name, a size, or
     another mechanism that its code holds and changes without the human;
   - a decision that conflicts with another, or with the constitution;
   - a decision file `ura check` cannot parse, like one with broken frontmatter: the question quotes
     the problem it reports, and its options repair the file or delete the decision.
3. **Write each finding as a question**, after the template, following
   [Writing for the human](writing.md) as a round of questions does, but for its free Context and
   its lack of settled points:
   - The `> [!IMPORTANT]` block, as in
     [Coming back to the human](../SKILL.md#coming-back-to-the-human): its first line gives the
     questions, the decisions the check read, and the time, computed as
     [the time estimate](writing.md#the-time-estimate) says: "3 questions on 12 decisions, about 10
     minutes". The items name the findings by subject, never by question number.
   - **Context**: how many decisions the ledger holds, what you read, and that the others hold no
     finding.
   - **One question per finding.** It links each decision it covers and quotes the words at fault.
     It has two or three options, the recommended one first, each a self-contained sentence naming
     what changes. A finding that fails the bar offers the shorter text as option A and keeping the
     decision as option B. A merge names the decision that stays and the one that goes.
   - **A candidate for each option that edits a decision**, in
     `specs/decisions-check/q<N>-<letter>/<topic>.md`: the whole decision as it would read, with
     `status: proposed` and `approved-by:` empty. An option that edits two decisions has two files,
     and an option that removes a decision has none: its text says which one goes. An option that
     keeps things as they are has no folder. A follow-up question's options edit no decision: it has
     no folder.
   - **No option edits the constitution.** Only a human amends it. A decision that conflicts with it
     is a finding whose every option changes the decision, and the question says what the
     constitution asks.
   - **One confirming question when nothing competes.** A ledger with no finding gets a single
     question, "Do the decisions need a change?", saying what you read and that nothing overlaps,
     fails the bar, or conflicts. Its options are to keep the decisions, and to ask for another
     check after the next feature. It has no candidates.
   - **Links** only to files on the default branch: the decisions, the constitution, and the
     candidates. A decision proposed on a feature's branch is named by its title.
   - **Notes:**, last, for the human.
4. **Commit** `specs/DECISIONS-CHECK.md` and `specs/decisions-check/` alone, with
   `chore: propose a decisions check`, and the block's first line as the body. Stop: the check waits
   for the human.

The human answers it like any round: each `**Answer:**` filled, `status: answered`, and the file
committed alone with `chore: answer the decisions check`. In the web UI, the decisions page's "Check
decisions" opens it in the questions view, with each option's candidate drawn against the active
decision, and Submit commits it. `ura answer` answers features' rounds only.

## Applying the answers

Once `DECISIONS-CHECK.md` is `answered`:

1. **Compare each answered option with the ledger as it is now.** An option's candidate was written
   against the decisions at the check's commit. When a decision it edits or removes changed on the
   default branch since that commit, skip the option, and say which decision moved: the edit would
   rest on old text. A skipped option is not retried by this run: the human asks for another check.
2. **Start a change for the rest.** The answers that edit, merge, or remove decisions become one
   [change](change.md), slug `decisions-check` with the date. Write its draft,
   `Apply the decisions check`, whose text lists each answered option in words, with the file of its
   candidate and the commit that holds it, then start it from the draft as
   [starting a change](change.md#starting-a-change) says, `ura start <draft> --change`: the answer
   is the human asking for it. The change's session then proposes the decisions, as
   [Change](change.md#decisions) says, on its branch and in its round:
   - each candidate replaces the decision of the same name, with `status: proposed` and
     `approved-by:` empty;
   - **a merge is a change with an edit and a removal**: the decision that stays is edited in place,
     and the other is deleted on the change's branch. The round names both, a removal as
     [the spec step](spec.md#writing-a-decision) names one;
   - an answer that keeps the decisions, and a confirming question's answer, change nothing.

   The round asks the human to approve the decisions, "A (recommended). Approve the change" first.
   Its context says what each decision came from, as the human answered it, in words.

3. **Delete the check and its candidates** from the default branch in one commit,
   `chore: apply the decisions check`. The body lists every question, one per line, in the
   questions' order: `- Start the change decisions-check-<date>: <question>`, `- Keep: <question>`,
   and `- Skip, <decision> changed since the check: <question>`. When no answer edits a decision, no
   change starts, and this commit is the whole run.

Then say to open `/f/<folder>` in the web UI, where the change's own session runs: this run does not
make the change, and never switches the main checkout.
