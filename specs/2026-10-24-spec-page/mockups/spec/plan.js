// The questions page's plan and data model, read from its branch: generated, not hand-written.
window.PLAN = {
  goal: 'the round of questions draws in titled panes with its question always in view, "Check these" moves before the questions in the page and in the file, and a right column of three tabs, Outline, Notes, and Session, sits beside the round at one width.',
  architecture:
    "four owners, as the [spec's architecture](spec.md#architecture) names them. The **core** owns the format: it reads `## Check these` as the first settled group, a question's \"Example:\" paragraph, and the block's verdict, and `ura check` owns the round's section order; the web never parses. The **session's view** (`SessionView.tsx`) owns how a transcript follows its end, in the window on the session's page or in a box in the column. The **document's column** (`layout/DocumentColumn.tsx`, on top of `SideColumn`) owns the tabs, the one width, and its storage, for the spec page to reuse. The **round's parts** (`RoundParts.tsx`, `QuestionCard.tsx`, `RoundOutline.tsx`) own the round's look, how a question reads, and the outline. The round page, `RoundPage.tsx`, puts them together and owns the notes field, which the Notes tab, the phone's sheet, and the round's end share, and the session's draft, which asking writes to.",
  status: "auto-approved",
  focus: [
    "**Back to a round with the Session tab open.** The round comes back to its place, and the transcript opens at its end in its box: the history entry's saved window scroll and a `#turn-` hash are the page's, never applied to the column's transcript. Task 1.",
    "**A round with a `## Check these` but no Behaviour or Under the hood point.** It leaves `## Settled without the human` out, `ura check` reports nothing, and the points still take comments. Task 2.",
    "**A comment on a point of `## Check these` that shares its subject with no other point.** It is read as that point's comment, not as a free note, and it draws under the point in the Check these pane. Task 2 for the core, Task 6 for the page.",
    "**The window crossing 768 px with a comment, the notes, or the composer typed in.** The text stays, marked unsaved: the notes field and the session's draft are kept above the column, which unmounts on the phone. Task 8.",
    "**Asking while the agent runs.** The quote replaces the previous one in the composer, and the composer stays as the session's page has it while working: Send waits, nothing is sent. Task 8.",
    "**A dragged column width outside 400 to 720 px in the browser's storage**, from a hand edit or an older build: it is clamped when read, never drawn narrower than 400 px. Task 4.",
  ],
  waves: [
    "Tasks 1, 2, 3: the session's view, the format, and the shared lists and pane. Independent: Task 1 touches the session's files and `RoundPage.tsx`, Task 2 the core, the skill, the fixtures, and the round texts of three test files, Task 3 `Blocks.tsx` and `Pane.tsx`.",
    "Tasks 4, 5, 6, 7: the column, the question card, the round's parts, and the outline. Each its own files; none edits `RoundPage.tsx`, so the page keeps drawing with today's props until Task 8. Shared: each may add its own helpers to `src/__tests__/helpers.tsx`.",
    "Task 8: the page together.",
    "Task 9: the stories, the screenshots, the decision's **Why**, and the mockup's README.",
  ],
  others: [
    {
      title: "Global constraints",
      lines: 74,
    },
    {
      title: "Code read",
      lines: 64,
    },
    {
      title: "Constitution check",
      lines: 3,
    },
    {
      title: "Complexity tracking",
      lines: 9,
    },
    {
      title: "Review comments",
      lines: 6,
    },
    {
      title: "Test map",
      lines: 57,
    },
  ],
  tasks: [
    {
      title: "Task 1: The session's view, scrolling in the round's column",
      steps: [
        {
          done: true,
          text: "Step 2: Write the failing tests",
        },
        {
          done: true,
          text: "Step 3: Run them to check they fail",
        },
        {
          done: true,
          text: "Step 4: Implement",
        },
        {
          done: true,
          text: "Step 5: Run the task's validation",
        },
        {
          done: true,
          text: "Step 6: Commit",
        },
      ],
      files: [
        "Create: `packages/web/src/SessionView.tsx` (`SessionLog`, `SessionPane`, `useSessionRecord`,",
        "Modify: `src/SessionPage.tsx` (imports what moved), `src/Transcript.tsx` (`settled`),",
        "Test: `src/__browser__/column-session.test.tsx`",
      ],
      risky:
        "the session's scrolling moves into a box, and the spec marks it unverified: if the transcript cannot follow its end inside the column, the column shows a link to the session's page instead, as the spec's edge case says, with a ruling.",
    },
    {
      title: 'Task 2: "Check these" before the questions, in the core, the skill, and every round',
      steps: [
        {
          done: true,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: true,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: true,
          text: "Step 3: Implement the core.",
        },
        {
          done: true,
          text: "Step 5: Run the task's validation",
        },
        {
          done: true,
          text: "Step 6: Commit",
        },
      ],
      files: [
        "Modify: `crates/core/src/files/items.rs` (`RoundItems.verdict`, `QuestionItem.example`,",
        "Modify: the template",
        "Modify: every fixture round with `### Check these`, keeping `fixtures/broken/`'s breakage; this",
        "Create: `fixtures/round-merge-chats/clarifications-01.md`,",
        "Modify: the round texts of `packages/web/src/__tests__/settled.test.tsx`; `triage.test.tsx` and",
        "Test: `crates/core/tests/items.rs`, `crates/core/tests/check.rs`",
      ],
      risky:
        "the round's file format changes for every reader and writer, and `ura check`'s section order changes for every round.",
    },
    {
      title: "Task 3: Lists hang their marker, and the pane folds",
      steps: [
        {
          done: true,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: true,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: true,
          text: "Step 3: Implement",
        },
        {
          done: true,
          text: "Step 4: Run the task's validation",
        },
        {
          done: true,
          text: "Step 5: Commit",
        },
      ],
      files: [
        "Modify: `packages/web/src/Blocks.tsx` (`ListNode`), `src/layout/Pane.tsx`",
        "Test: `src/__browser__/document-lists.test.tsx` (create), `src/__tests__/titled-pane.test.tsx`",
      ],
    },
    {
      title: "Task 4: The document's column: tabs at one width",
      steps: [
        {
          done: false,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: false,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: false,
          text: "Step 3: Implement",
        },
        {
          done: false,
          text: "Step 4: Run the task's validation",
        },
        {
          done: false,
          text: "Step 5: Commit",
        },
      ],
      files: [
        "Create: `packages/web/src/layout/DocumentColumn.tsx`, `src/layout/documentColumnWidth.ts`",
        "Modify: `src/layout/SideColumn.tsx` (`sizes.max`, and a width that follows the window until",
        "Test: `src/__browser__/document-column.test.tsx`, `src/__tests__/document-column.test.ts`",
      ],
    },
    {
      title: "Task 5: The question card",
      steps: [
        {
          done: false,
          text: "Step 1: Move the option to `QuestionOption.tsx`",
        },
        {
          done: false,
          text: "Step 2: Write the failing tests.",
        },
        {
          done: false,
          text: "Step 3: Run them to check they fail",
        },
        {
          done: false,
          text: "Step 4: Implement.",
        },
        {
          done: false,
          text: "Step 5: Run the task's validation",
        },
        {
          done: false,
          text: "Step 6: Commit",
        },
      ],
      files: [
        "Create: `packages/web/src/QuestionOption.tsx` (the option and its points, out of `Question.tsx`,",
        "Modify: `src/QuestionCard.tsx`, `src/Question.tsx`, `src/QuestionCards.tsx`",
        "Test: `src/__tests__/question-card.test.tsx` (create), `src/__browser__/round-cards.test.tsx`",
      ],
    },
    {
      title:
        "Task 6: The round's parts: the block, the context, Check these, and the settled panes",
      steps: [
        {
          done: false,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: false,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: false,
          text: "Step 3: Implement.",
        },
        {
          done: false,
          text: "Step 4: Run the task's validation",
        },
        {
          done: false,
          text: "Step 5: Commit",
        },
      ],
      files: [
        "Create: `packages/web/src/RoundParts.tsx` (the block's pane and its badge, the context's panes,",
        "Modify: `src/RoundOpening.tsx`, `src/SettledPoints.tsx`, `src/SettledGroups.tsx`",
        "Test: `src/__tests__/round-parts.test.tsx` (create), `src/__tests__/settled.test.tsx`",
      ],
    },
    {
      title: "Task 7: The outline",
      steps: [
        {
          done: false,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: false,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: false,
          text: "Step 3: Implement.",
        },
        {
          done: false,
          text: "Step 4: Run the task's validation",
        },
        {
          done: false,
          text: "Step 5: Commit",
        },
      ],
      files: [
        "Create: `packages/web/src/RoundOutline.tsx`, `src/roundJump.ts` (`jumpTo`, `questionAtTop`,",
        "Modify: `src/RoundNav.tsx`, `src/RoundSubmit.tsx` (imports `jumpTo` from `roundJump.ts`)",
        "Test: `src/__tests__/round-outline.test.tsx` (create)",
      ],
    },
    {
      title: "Task 8: The page together: the column, the notes, the session, and asking",
      steps: [
        {
          done: false,
          text: "Step 1: Write the failing tests.",
        },
        {
          done: false,
          text: "Step 2: Run them to check they fail",
        },
        {
          done: false,
          text: "Step 3: Implement.",
        },
        {
          done: false,
          text: "Step 4: Run the task's validation",
        },
        {
          done: false,
          text: "Step 5: Commit",
        },
      ],
      files: [
        "Modify: `packages/web/src/RoundPage.tsx`, `src/RoundSubmit.tsx` (`RoundEnd`: the notes read-only,",
        "Delete: `src/RoundNav.tsx`",
        "Test: `src/__tests__/round-column.test.tsx` (create), `src/__browser__/round-column.test.tsx`",
      ],
    },
    {
      title: "Task 9: The stories, the screenshots, the decision's Why, and the mockup's README",
      steps: [
        {
          done: false,
          text: "Step 1: Write the stories",
        },
        {
          done: false,
          text: "Step 2: Build them",
        },
        {
          done: false,
          text: "Step 3: Take and review the screenshots",
        },
        {
          done: false,
          text: "Step 4: Rewrite the layout decision's Why",
        },
        {
          done: false,
          text: "Step 5: Run the whole validation",
        },
        {
          done: false,
          text: "Step 6: Commit",
        },
      ],
      files: [
        "Modify: `packages/web/src/RoundPage.stories.tsx` (one export per state: waiting, Session open with",
        "Create: the screenshots of the round page, phone and desktop, Latte and Mocha, in",
        "Modify: `specs/decisions/ui-layout.md` (**Why**, review comment C1),",
      ],
    },
  ],
};
window.DATA_MODEL =
  "# Data model: Questions page in the terminal look\n\nThe file format that [the spec](spec.md) changes: a round of questions, `clarifications-NN.md`, in a\nfeature's or a change's folder. Nothing else is stored: the right column's width and the folded\nToday pane live in the browser, as other UI preferences do.\n\n## A round of questions\n\nThe sections of the file, in order. \"Check these\" leaves the settled points for a section of its\nown, before the first question, so the file reads in the order the page shows it.\n\n| Section                           | Holds                                                                                                       | Change                                                  |\n| --------------------------------- | ----------------------------------------------------------------------------------------------------------- | ------------------------------------------------------- |\n| `# Clarifications, round NN: ...` | The title                                                                                                   |                                                         |\n| `> [!IMPORTANT]` block            | The count and time, the verdict, what matters most                                                          |                                                         |\n| `## Context`                      | `### Since the last round`, `### Goal`, `### Today`, `### Scope`, `### Sources`                             |                                                         |\n| `## Check these`                  | The points to check, each a list item starting with its bold subject, no sub-heading; left out when empty   | New, before the first question                          |\n| `## Q1: ...`, `### Q1.B: ...`     | The questions and their follow-ups                                                                          |                                                         |\n| `## Settled without the human`    | `### Behaviour`, then `### Under the hood`, each left out when empty; the section is left out when both are | Changed: no `### Check these`                           |\n| `**Notes:**`                      | The human's free notes, then their comments on settled points                                               | Changed: a comment may name a point of `## Check these` |\n\n## A comment on a settled point\n\nUnchanged in form: a bullet at the end of the notes, starting with the point's bold subject,\n`- **The light flow stays.**: Keep it, but say so in the PR.` The subject may now be one of\n`## Check these` as well as of the settled section. Subjects stay unique in the round.\n\n## What `ura check` reports\n\n| Check              | Reports                                                                                      | Change  |\n| ------------------ | -------------------------------------------------------------------------------------------- | ------- |\n| `sections.order`   | `## Check these` anywhere but between `## Context` and the first question                    | Changed |\n| `sections.unknown` | A `### Check these` under `## Settled without the human`, as any unknown sub-heading         | Changed |\n| `settled.group`    | A point under `## Settled without the human` outside `### Behaviour` or `### Under the hood` | Changed |\n\nBefore version 1.0, the [compatibility](/specs/decisions/compatibility.md) decision keeps no reader\nfor the old order: rounds in the old format fail `ura check` until they are rewritten.\n";
