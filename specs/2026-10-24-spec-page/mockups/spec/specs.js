// Two real specs, as Uraeda's core reads them: generated, not hand-written.
window.SPECS = {
  "questions-page": {
    folder: "2026-10-24-questions-page",
    title: "Spec: Questions page in the terminal look",
    risk: "medium",
    blockFirst: "Approved on 2026-10-24.",
    block: [
      'You approve the round redrawn in titled panes with the question always in view. A right column holds Outline, Notes, and Session tabs. "Check these" moves before the questions, in the page and in the file format.',
      "Your question on the jarring column: the column keeps one width for its three tabs, a third of the window, so opening the session or switching tabs never moves the round.",
      "One changed decision, UI layout: a feature's session may open beside its documents, at least 400 px wide.",
      "The round's file format changes: \"Check these\" becomes its own section before Q1. The skill, the template, the examples, the fixtures, `ura check`, and this feature's own round follow.",
      'Your mobile note on options: an option is one border with its letter in it; on the phone, each pro, con, and "why" is a small box with its sign in its border, with no indent.',
      "Not verified: the session's transcript has not yet scrolled inside a column. The plan's first task checks it; if it fails, the column links to the session's page instead.",
      "Risk tier `medium`: a file format changes, and the session's scrolling moves.",
    ],
    intro:
      "The round of questions is where you spend most of your time. This feature redraws it in the terminal look: panes that show what each part holds, the question in view while you answer, and the session beside the round instead of on another page. See the [proposal](proposal.md), the [discovery](discovery-01.md), and the [clarifications](clarifications-01.md).",
    decisions: [
      "**Changed: **[**UI layout**](../decisions/ui-layout.md). A feature's session may open beside any of the feature's documents, in the right column, at least 400 px wide.",
    ],
    relied: [
      ["Decision", "What it means for this spec"],
      [
        "[UI look](../decisions/ui-look.md)",
        "every part of the round is a titled pane, in the theme's colours",
      ],
      [
        "[UI coherence](../decisions/ui-coherence.md)",
        "the round-only parts are named in the plan; lists change for every document",
      ],
      [
        "[UI behaviour](../decisions/ui-behaviour.md)",
        "typed comments and notes survive tab switches; every action works by keyboard",
      ],
      [
        "[Stack](../decisions/stack.md)",
        "the core finds a question's example and the round's verdict; the web never parses",
      ],
      [
        "[Compatibility](../decisions/compatibility.md)",
        "the old round format is not read: every round on this branch is rewritten",
      ],
      [
        "[Preview](../decisions/preview.md)",
        "the mockup is an HTML layout mockup; the plan's stories hold the real components",
      ],
    ],
    changes: [
      {
        name: "ui-layout",
        title: "UI layout",
        kind: "changed",
        listed: true,
        fields: [],
        sections: [
          {
            title: "",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Every layout choice in the web UI serves one goal first: the human reads and understands what is on screen. The UI adapts to the screen's width, not to the device, and each view takes the shape that reads best for what it is for. The rules below serve that goal, and give way to it when a view's spec says why.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Rules",
            parts: [
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "A view's spec MUST say why its layout reads best, with mockups at each width class.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "The UI MUST adapt to three width classes, narrow, semi-wide, and wide, not to the device, through the theme and never per-view media queries.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests, at each class.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and dialogs.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "Text MUST stay readable at each width without zoom, and controls MUST be easy to hit by touch.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the UI tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "should",
                runs: [
                  {
                    kind: "kept",
                    text: "A column that takes room from the main content SHOULD be foldable and resizable.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "should",
                runs: [
                  {
                    kind: "kept",
                    text: "A detail glanced at from a list SHOULD open in a pane beside it, and a view the human follows SHOULD be a page of its own.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "may",
                runs: [
                  {
                    kind: "added",
                    text: "A feature's session MAY open beside any of the feature's documents, in the right column, at least 400 px wide; everywhere else it stays a page of its own.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
            ],
          },
          {
            title: "Why",
            parts: [
              {
                kind: "changed",
                runs: [
                  {
                    kind: "kept",
                    text: "The desktop showed the phone's layout, and the human zoomed it to 120% to read it (text size). An agent's session, squeezed into a pane beside its list, was too narrow to follow. The human then asked for concepts over hard rules: \"Goal #1 is always readability and clarity for the user\" (the session view's review). The sidebar's rows of sub-agents and tasks were hard to read, so it became \"small and visual more than textual\" (the sidebar's rows). Half a screen, where the human often works, got the desktop's layout and broke: the human asked for a middle class, wide enough to hold their 1205 px half screen (width classes).",
                  },
                  {
                    kind: "added",
                    text: "Asking the agent about a question meant leaving the round for the session's page. The human asked for the session beside the documents they answer and review, in a column wide enough to read (the session beside a document).",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Alternatives considered",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "A column near 70 characters: it left most of a desktop empty and read too slim.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "CSS zoom on desktop: it breaks dragging's position math.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Justified paragraphs: rivers on the phone's narrow lines.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Every detail in a pane on wide screens: an agent's session became too narrow to follow.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "A session beside a round of questions only: each later document page would have asked again.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Two width classes, switching at 768 px: half a screen got the desktop's layout, and broke.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Panes that adapt to their own width, with container queries: no class to test, but each pane tested alone.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Consequences",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Each view is designed, mocked up, and checked at three widths.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "The questions, spec, and plan pages share one right column, where the session sits as a tab.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep its slug.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Applies to",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "packages/web/, and every feature that adds or changes a view",
                  },
                ],
                check: [],
              },
            ],
          },
        ],
      },
    ],
    stories: [
      {
        id: "US1",
        title: "A round that shows what each part holds",
        priority: "P1",
        journey: [
          "You open a round and see at once its verdict, its goal, and what to check, each in a titled pane. Each question's example and \"Why it matters\" stand apart from its context. Options read as cards, and the phone keeps the screen's width for text.",
        ],
        mockups: [
          {
            label: "The round, wide",
            href: "mockups/questions.html?w=1440",
          },
        ],
        why: null,
        key: [
          [
            [
              "Given",
              'the merge-chats round, whose verdict reads "worth building, with changes", ',
            ],
            ["When", "it opens at 1440 px, "],
            [
              "Then",
              'its block is a pane titled "7 questions and 1 follow-up, about 20 minutes.", with a "With changes" badge before the verdict\'s sentence.',
            ],
          ],
          [
            ["Given", "the layout-look round's Q4, "],
            ["When", "it draws, "],
            [
              "Then",
              'its "Example:" line is a teal pane titled "Example", and its "Why it matters" a peach pane titled "Why it matters".',
            ],
          ],
          [
            ["Given", "the merge-chats round at 390 px, "],
            ["When", "Q1's option A draws, "],
            [
              "Then",
              'its letter and "★ Recommended" sit in its border, and each of its pro, con, and why is a box with `+`, `−`, or `★` in its border, its text starting at the box\'s inner edge.',
            ],
          ],
        ],
        more: [
          [
            ["Given", "a round, "],
            ["When", "it opens, "],
            [
              "Then",
              "its Goal, Scope, and Sources are panes with their icons, and Today is folded to its title; a tap on the title unfolds it, for the page's life.",
            ],
          ],
          [
            ["Given", "a link to `#today` in the round, "],
            ["When", "it is followed, "],
            ["Then", "Today unfolds and the page lands on it."],
          ],
          [
            ["Given", "a list in the block at 390 px, "],
            ["When", "it draws, "],
            [
              "Then",
              "its text starts at the paragraphs' left edge, its dash hanging in the page's margin. The same holds for every document.",
            ],
          ],
          [
            ["Given", "Q2.A at 390 px, "],
            ["When", "it draws, "],
            [
              "Then",
              'it has no line on its side, and a mauve top border under "Q2.A · follows Q2, because you picked A".',
            ],
          ],
          [
            ["Given", "option B is picked, "],
            ["When", "it draws, "],
            [
              "Then",
              'its border is mauve and twice as thick, its letter filled, and "picked" sits beside it.',
            ],
          ],
        ],
      },
      {
        id: "US2",
        title: "The question in view, and the whole round in the outline",
        priority: "P1",
        journey: [
          "While you read a question's options, its number and text stay at the top of the screen, at every width. The outline beside the round lists every part of it, and marks where you are.",
        ],
        mockups: [
          {
            label: "The question at the top, at 1205 px",
            href: "mockups/questions.html?w=1205&round=layout-look",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "the layout-look round at 1205 px, "],
            ["When", "you scroll to Q4's option C, "],
            [
              "Then",
              '"Q4" and "Where should the session open on the questions page?" stay at the top of the round.',
            ],
          ],
          [
            ["Given", "you scroll past Q4's card, "],
            ["When", "Q5's card reaches the top, "],
            ["Then", "Q4's header leaves with its card, and Q5's takes its place."],
          ],
          [
            ["Given", "the merge-chats round, "],
            ["When", "the Outline tab draws, "],
            [
              "Then",
              'it lists "Verdict and summary", Goal, Today, Scope, Sources, "Check these · 2", Q1 to Q7 with Q2.A under Q2, "Behaviour · 3", "Under the hood · 3", and "Notes and submit".',
            ],
          ],
        ],
        more: [
          [
            ["Given", "the page scrolled to Q3, "],
            ["When", "you look at the outline, "],
            ["Then", "Q3's row is marked."],
          ],
          [
            ["Given", "Q1 and Q2 answered, "],
            ["When", "you press `n` on Q1, "],
            ["Then", "the page goes to Q2.A."],
          ],
          [
            ["Given", "the outline at 390 px, "],
            ["When", 'you tap "0/8" in the status line, '],
            ["Then", "it opens as a sheet, and a tap on a row closes it and goes there."],
          ],
        ],
      },
      {
        id: "US3",
        title: "The session beside the round",
        priority: "P1",
        journey: [
          "You ask the agent about a question, or a settled point, and read its answer in the right column, the question still beside it. The round does not move.",
        ],
        mockups: [
          {
            label: "The session open, at 1205 px",
            href: "mockups/questions.html?w=1205&tab=session",
          },
        ],
        why: "Why this priority: it is what the proposal asks to change most, but the round reads well without it.",
        key: [
          [
            ["Given", "the merge-chats round at 1440 px, "],
            ["When", "it opens, "],
            [
              "Then",
              "the right column is 480 px wide, with the tabs Outline, Notes, and Session, Outline open.",
            ],
          ],
          [
            ["Given", "that round, "],
            ["When", 'you click "Ask the agent" on Q2, '],
            [
              "Then",
              'the Session tab opens with "About Q2 of specs/2026-10-20-merge-chats/clarifications-01.md:" and "> Where does a new chat work?" in its composer, and the round\'s cards keep their place and width.',
            ],
          ],
          [
            ["Given", "the merge-chats round at 390 px, "],
            ["When", 'you tap "Ask the agent" on Q2, '],
            ["Then", "the session's page opens with that quote, and Back returns to Q2."],
          ],
        ],
        more: [
          [
            ["Given", '"Check these" in the merge-chats round, '],
            ["When", 'you click "Ask" on "The light flow stays.", '],
            [
              "Then",
              'the composer holds "About the settled point of specs/2026-10-20-merge-chats/clarifications-01.md:" and "> The light flow stays."',
            ],
          ],
          [
            ["Given", '"why would that cost more?" typed after Q2\'s quote, '],
            ["When", "you ask about Q3, "],
            ["Then", "the quote becomes Q3's and the typed text stays."],
          ],
          [
            ["Given", "the Session tab open, "],
            ["When", "you reload, "],
            ["Then", "it is still open."],
          ],
          [
            ["Given", "the window at 1205 px, "],
            ["When", "the column shows, "],
            ["Then", "it is 402 px wide, and pushes the round, which is 751 px."],
          ],
          [
            ["Given", "the column dragged to 560 px, "],
            ["When", "you open another round, "],
            ["Then", "it is 560 px."],
          ],
          [
            ["Given", "the inbox triage, "],
            ["When", "it opens, "],
            ["Then", 'the column has Outline and Notes, and no Session tab or "Ask" button.'],
          ],
        ],
      },
      {
        id: "US4",
        title: '"Check these" before the questions',
        priority: "P2",
        journey: [
          "The points the agent settled that you would want to object to come before the first question, in a strong pane, in the page and in the file. Behaviour and Under the hood stay at the end.",
        ],
        mockups: [
          {
            label: "Check these",
            href: "mockups/questions.html?w=1440",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "the merge-chats round, "],
            ["When", "it opens, "],
            [
              "Then",
              'after Sources comes a peach pane titled "Check these · 2", with "The change\'s proposal" and "The light flow stays.", each with "Ask" and a comment button.',
            ],
          ],
          [
            ["Given", "a round written from the new template, "],
            ["When", "`ura check` runs, "],
            [
              "Then",
              "it reports no problem; with `## Check these` after Q1, it reports `sections.order`.",
            ],
          ],
          [
            ["Given", 'a round with `### Check these` under "Settled without the human", '],
            ["When", "`ura check` runs, "],
            ["Then", "it reports the heading as `sections.unknown`."],
          ],
        ],
        more: [
          [
            ["Given", 'a comment "- **The light flow stays.**: Say so in the PR." in the notes, '],
            ["When", "the round draws, "],
            ["Then", 'it shows under that point in "Check these".'],
          ],
          [
            ["Given", "a round without points to check, "],
            ["When", "it draws, "],
            ["Then", 'no "Check these" pane or outline row shows.'],
          ],
          [
            ["Given", "the Under the hood pane, "],
            ["When", "it draws, "],
            ["Then", 'it is folded to "3 choices in the code only".'],
          ],
        ],
      },
      {
        id: "US5",
        title: "A note from anywhere",
        priority: "P2",
        journey: [
          "You think of something while reading Q4 that belongs to no question. You write it in the Notes tab without leaving Q4, and it is the same note as the round's end.",
        ],
        mockups: [
          {
            label: "Notes, at 1440 px",
            href: "mockups/questions.html?w=1440&tab=notes",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "the page on Q4 at 1440 px, "],
            ["When", 'you open Notes and type "Check the spec page too.", '],
            [
              "Then",
              "the round stays on Q4, and the round's end shows the same text, marked unsaved.",
            ],
          ],
          [
            ["Given", "that note unsaved, "],
            ["When", "you click Submit, "],
            ["Then", "it is saved with the answers."],
          ],
          [
            ["Given", "the page on Q4 at 390 px, "],
            ["When", 'you tap "Notes" in the status line, '],
            ["Then", "the notes open as a sheet, and closing it leaves the page on Q4."],
          ],
        ],
        more: [],
      },
    ],
    archIntro: [
      "The look reuses the shell's titled pane, and the round's parts become small components of the round. The right column extends the session page's resizable column with tabs and one stored width. The session's view is lifted out of its page so that it scrolls in a box. The format change moves \"Check these\" in the core's parser and checks, the skill, and every round on the branch, with no old reader, as the [compatibility](../decisions/compatibility.md) decision asks. See [discovery](discovery-01.md#approaches).",
    ],
    units: [
      '**The round\'s parts** draw the block with its verdict badge, the context panes with Today folded, "Check these", the example and "Why it matters" panes, and the settled panes. They own the round\'s look.',
      "**The question card** draws the sticky header, the context, and the options, each one bordered with its letter in its border, and the phone's boxed pros and cons. It owns how a question reads.",
      "**The round's column** holds the Outline, Notes, and Session tabs at one width: a third of the window, 400 to 600 px, dragged between 400 and 720 px, kept in the browser. The open tab is in the address. It owns where the session sits beside a document, for the spec page to reuse.",
      "**The outline** lists every part of the round and marks the one at the top; it leaves `RoundNav.tsx`, near its limit, for a file of its own. It owns `n` and `p`.",
      "**The session's view** is the transcript and composer, scrolling in their own box, used by the session's page and the column. It owns how a session follows its end.",
      "**Asking** quotes a question or a settled point into the session's composer: the column's tab on wide screens, the session's page on the phone. It owns the quote's form.",
      "**The round's notes** are one field, drawn in the Notes tab or the phone's sheet, and read at the round's end.",
      "**The documents' lists** hang their marker in the margin on the phone, for every document.",
      "**The core** reads `## Check these` as settled points to check, a question's \"Example:\" paragraph, and the block's verdict. `ura check` owns the round's section order.",
      '**The skill** writes "Check these" before the questions: the questions file\'s order in [discovery](/skills/uraeda/references/discovery.md) and [writing](/skills/uraeda/references/writing.md), the template, the two example rounds, and the fixtures.',
    ],
    tradeoffs: [
      "The column always takes a third of the window, so the round is narrower than today: at 1440 px a card is about 700 px, and splits in two columns only once the column is folded.",
      "The sticky header takes two or three lines of the screen while its card is on it.",
      "Rounds in flight on other branches fail `ura check` after this merges, until they are rewritten.",
    ],
    edges: [
      [
        "High",
        "A comment or a note is typed, then the tab switches or the width class changes",
        "the text stays, marked unsaved, as fields do today",
      ],
      [
        "High",
        "Text is typed in the session's composer, then you ask about another question",
        "the quote is replaced, the typed text kept",
      ],
      [
        "High",
        "The session's transcript cannot follow its end inside the column",
        "the plan's first task finds it; the column then shows a link to the session's page",
      ],
      [
        "Normal",
        "The agent is running when you ask",
        "the composer behaves as on the session's page",
      ],
      [
        "Normal",
        "A round whose agent is unavailable, or a default-branch round",
        'no Session tab and no "Ask" buttons; Outline and Notes stay',
      ],
      ["Normal", "An answered round", "the new look, read-only, without the column, as today"],
      [
        "Normal",
        "A round on this branch in the old format",
        "`ura check` reports it; it is rewritten in the new format, its words kept",
      ],
      [
        "Normal",
        "The column folded with `]`",
        "the round takes the room; a card of 840 px or more splits in two columns",
      ],
      [
        "Niche",
        "The window crosses 768 px with the Session tab open",
        "the phone shows the round; the tab stays in the address for the way back",
      ],
      [
        "Niche",
        "A question taller than the screen with its header stuck",
        "the header stays; the card scrolls under it",
      ],
    ],
    criteria: [
      {
        id: "SC-001",
        measure: "question in view",
        sentence:
          "At 1440, 1205, and 390 px, a question's number and title are on screen at every scroll position inside its card.",
      },
      {
        id: "SC-002",
        measure: "no jump",
        sentence:
          "Opening the session, switching tabs, or asking moves no card of the round by a pixel, in place or in width.",
      },
      {
        id: "SC-003",
        measure: "one click",
        sentence:
          "From any question or point to check, the session opens with its quote in one click or tap.",
      },
      {
        id: "SC-004",
        measure: "phone width",
        sentence:
          "At 390 px, a list's first-level text starts at the paragraphs' left edge, and an option's text inside its border starts at most 11 px from the screen's edge.",
      },
      {
        id: "SC-005",
        measure: "contrast",
        sentence: "Every new pane's text reaches 4.5:1, and its border 3:1, in Mocha and Latte.",
      },
      {
        id: "SC-006",
        measure: "format",
        sentence:
          'The template, the examples, the fixtures, and every round on this branch pass `ura check` with "Check these" before Q1.',
      },
    ],
    assumptions: [
      "The points settled in the [clarifications](clarifications-01.md#settled-without-the-human) hold as written there, with your notes: the outline holds the whole round, notes are written from anywhere, and lists are tighter than proposed. The session on the phone stays its page, as you confirmed.",
      "Settled while writing this spec:",
      {
        list: [
          "**The column's one width** answers your question on the jarring column. The column is there from the page's load, and its tabs never change its width, so nothing moves. See [the half screen](discovery-01.md#the-half-screen).",
          '**Notes from anywhere** are a Notes tab in the column, and a sheet from the status line on the phone, as the layout decision asks of forms there. The round\'s end shows the notes read-only, with "Edit notes".',
          "**Tighter lists** hang the marker in the page's margin, so the text loses no width at all. Nested lists indent by one character.",
          '**Your note on mobile options** reads as: one border per option, its letter and "★ Recommended" in it, the border\'s colour telling picked or recommended. On the phone, each pro, con, and "why" is its own box with its sign in its border. Wider screens keep the signs hanging beside the text.',
          "**A follow-up on the phone** loses its accent line on the side, for a mauve top border.",
          '**"Ask" on a settled point** quotes it as "About the settled point of <path>:" and the point\'s subject.',
          "**The Astryx 0.7.0 note**: \"keeps Markdown transforms composable\" is a fix for transform plugins next to `markdownSourceLinesPlugin`, in lists and quotes. Rounds and specs draw the core's document tree, not Astryx's Markdown, as the [stack](../decisions/stack.md) decision asks. Only session messages use it, without that plugin. Nothing changes.",
          "**Benchmark runs** under `benchmarks/runs/` keep the old format: they are records of past runs, like `specs/done/`.",
          "**The prototype** becomes this spec's mockup, narrowed to the design you picked; its other variants stay in git history.",
        ],
      },
    ],
    principles: [
      {
        label: "I. Humans in control",
        ok: true,
      },
      {
        label: "II. Plain text",
        ok: true,
      },
      {
        label: "III. Async",
        ok: true,
      },
      {
        label: "IV. Review effort",
        ok: true,
      },
      {
        label: "V. Tools optional",
        ok: true,
      },
      {
        label: "VI. Checked code",
        ok: true,
      },
    ],
    riskText:
      "**Medium**: the round's file format changes for every reader and writer, and the session's scrolling moves into a box.",
  },
  "layout-look": {
    folder: "2026-10-20-layout-look",
    title: "Spec: Layout and look and feel",
    minutes: 25,
    risk: "medium",
    blockFirst: "Spec to review, about 25 minutes.",
    block: [
      "You approve the terminal look for the whole UI, a shell that fits three widths, and new home, settings, and decisions pages.",
      "One new decision, the UI look, and two changed ones: three width classes, and throwaway prototypes in an investigation.",
      "The mockups are the HTML prototypes, as you asked, not stories: this spec departs from the preview decision once. The plan builds the stories first, and the prototypes go when they do.",
      "Three places differ from the mockups: decisions in today's order, not by area; settings with the real settings; and key hints only for keys that work.",
      "Claude Code's and Codex's marks are used without their owners' approval, as you chose.",
      "Not verified: whether Astryx's palette takes a preview pane. The plan's first task checks it.",
      "Risk tier `medium`: every view changes look, and one browser preference changes values.",
    ],
    intro:
      "The UI takes the terminal look you picked: Catppuccin colours, one monospace font, square bordered panes. Its shell fits a full screen, your half screen, and a phone. The home, settings, and the decisions pages are redrawn in it. The reading pages and the lists follow in two later features. See the [proposal](proposal.md), the discovery rounds [01](discovery-01.md) and [02](discovery-02.md), and the clarifications [01](clarifications-01.md) and [02](clarifications-02.md).",
    decisions: [
      "**New: **[**UI look**](../decisions/ui-look.md). A terminal look in one theme: a monospace font, Catppuccin Mocha and Latte, square bordered panes, 120% text, bundled fonts, Lucide icons, and Codicons' harness marks.",
      "**Changed: **[**UI layout**](../decisions/ui-layout.md). Three width classes instead of two: narrow, semi-wide, and wide.",
      "**Changed: **[**Preview**](../decisions/preview.md). An investigation may compare throwaway prototypes in any format, deleted when its spec is approved.",
    ],
    relied: [
      ["Decision", "What it means for this spec"],
      [
        "[UI components](../decisions/ui-components.md)",
        "Astryx stays; the titled pane, rail, status line, and palette preview are listed gaps",
      ],
      [
        "[UI coherence](../decisions/ui-coherence.md)",
        "one titled pane, one row, one harness mark, shared by every view",
      ],
      [
        "[UI behaviour](../decisions/ui-behaviour.md)",
        "nothing opens on hover alone: the rail opens on focus and tap too",
      ],
      [
        "[Settings](../decisions/settings.md)",
        "the file view shows the real `settings.toml`, and writes keep its comments",
      ],
      [
        "[Problems](../decisions/problems.md)",
        "the home's problems are those that stop the workflow, never notes",
      ],
      [
        "[Stack](../decisions/stack.md)",
        "the decisions reader draws the core's document tree, never markdown",
      ],
    ],
    changes: [
      {
        name: "ui-look",
        title: "UI look",
        kind: "new",
        listed: true,
        fields: [],
        sections: [
          {
            title: "",
            parts: [
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Uraeda looks like a terminal tool: one monospace font, Catppuccin colours, square corners, and bordered panes with their title in their border, as in Neovim. The look lives in one theme, so the whole UI changes together, and more colour schemes can join it later.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Rules",
            parts: [
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "The UI MUST look like a terminal tool: one monospace font for all its text, square corners, and content grouped in bordered panes whose title sits in their top border.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "The UI MUST offer Catppuccin's Mocha and Latte schemes, following the system's light or dark setting until the human picks one.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "A new colour scheme MUST be added as a named scheme of the same theme, never as styles in a view.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "Every text colour MUST reach 4.5:1 against its background, and borders and controls 3:1, in every scheme.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by a test of the theme's tokens.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "Text MUST be set at 120% of Astryx's base size, the size the human chose to read at.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by a test of the theme's tokens.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "Fonts MUST be bundled with the app under an open licence, and the UI MUST NOT load a file from another host.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by a test of the built app.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "Icons MUST come from Lucide, unless another free set has a glyph that fits a concept clearly better.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "A harness MUST be marked by Codicons' drawing of its mark where Codicons has one, and by a neutral glyph drawn for Uraeda otherwise.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "must",
                runs: [
                  {
                    kind: "added",
                    text: "The logo and the favicon MUST be the dot-matrix tree, drawn once.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
            ],
          },
          {
            title: "Why",
            parts: [
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "The UI looked vanilla and unfinished before 1.0. The human compared five directions and picked the terminal one, with a touch of cyber (the visual direction). They asked for Catppuccin Mocha and Latte, with more schemes later (colour modes), and found 120% text more readable. Fonts are bundled because the server listens on the loopback and often runs offline (dependencies and fonts). The human kept Lucide after comparing ten sets, and allowed another set's glyph where it fits better (the icon set). They chose Codicons' marks for the harnesses that have one (harness marks), and the dot-matrix tree as the logo (logo). The investigation is in discovery.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Alternatives considered",
            parts: [
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Natural, cyber, glass, and blueprint directions: drawn over the same views, and not picked.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Material Design Icons, as in the human's Neovim: complete, but heavier than the mono text.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Neutral glyphs for every harness: no trademark question, but slower to recognise.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Consequences",
            parts: [
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Every view inherits the look from the theme, so later features restyle nothing.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "The marks of Claude Code and Codex are used without their owners' approval, as the human chose.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "The bundled font adds to the app's download.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Applies to",
            parts: [
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "packages/web/: its theme in src/theme/, its icons, and every view",
                  },
                ],
                check: [],
              },
            ],
          },
        ],
      },
      {
        name: "ui-layout",
        title: "UI layout",
        kind: "changed",
        listed: true,
        fields: [
          {
            name: "approved-by",
            before: "mrtolkien",
            after: "",
          },
          {
            name: "status",
            before: "active",
            after: "proposed",
          },
        ],
        sections: [
          {
            title: "",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Every layout choice in the web UI serves one goal first: the human reads and understands what is on screen. The UI adapts to the screen's width, not to the device, and each view takes the shape that reads best for what it is for. The rules below serve that goal, and give way to it when a view's spec says why.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Rules",
            parts: [
              {
                kind: "changed",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "A view's spec MUST say why its layout reads best, with mockups at",
                  },
                  {
                    kind: "removed",
                    text: "both",
                  },
                  {
                    kind: "added",
                    text: "each",
                  },
                  {
                    kind: "kept",
                    text: "width",
                  },
                  {
                    kind: "removed",
                    text: "classes.",
                  },
                  {
                    kind: "added",
                    text: "class.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "changed",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "The UI MUST adapt to",
                  },
                  {
                    kind: "removed",
                    text: "two",
                  },
                  {
                    kind: "added",
                    text: "three",
                  },
                  {
                    kind: "kept",
                    text: "width classes,",
                  },
                  {
                    kind: "added",
                    text: "narrow, semi-wide, and wide,",
                  },
                  {
                    kind: "kept",
                    text: "not to the device, through the theme and never per-view media queries.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by",
                  },
                  {
                    kind: "removed",
                    text: "review.",
                  },
                  {
                    kind: "added",
                    text: "the browser tests, at each class.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "On narrow screens, views MUST be pages and menus and forms sheets; on wide screens, popovers and dialogs.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "Text MUST stay readable at each width without zoom, and controls MUST be easy to hit by touch.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "An open detail, tab, or sheet MUST be in the URL, so reload, Back, or a width change keeps it.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the UI tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "should",
                runs: [
                  {
                    kind: "kept",
                    text: "A column that takes room from the main content SHOULD be foldable and resizable.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the browser tests.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "should",
                runs: [
                  {
                    kind: "kept",
                    text: "A detail glanced at from a list SHOULD open in a pane beside it, and a view the human follows SHOULD be a page of its own.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
            ],
          },
          {
            title: "Why",
            parts: [
              {
                kind: "changed",
                runs: [
                  {
                    kind: "kept",
                    text: "The desktop showed the phone's layout, and the human zoomed it to 120% to read it (text size). An agent's session, squeezed into a pane beside its list, was too narrow to follow. The human then asked for concepts over hard rules: \"Goal #1 is always readability and clarity for the user\" (the session view's review). The sidebar's rows of sub-agents and tasks were hard to read, so it became \"small and visual more than textual\" (the sidebar's rows).",
                  },
                  {
                    kind: "added",
                    text: "Half a screen, where the human often works, got the desktop's layout and broke: the human asked for a middle class, wide enough to hold their 1205 px half screen (width classes).",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Alternatives considered",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "A column near 70 characters: it left most of a desktop empty and read too slim.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "CSS zoom on desktop: it breaks dragging's position math.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Justified paragraphs: rivers on the phone's narrow lines.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Every detail in a pane on wide screens: an agent's session became too narrow to follow.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Two width classes, switching at 768 px: half a screen got the desktop's layout, and broke.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "Panes that adapt to their own width, with container queries: no class to test, but each pane tested alone.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Consequences",
            parts: [
              {
                kind: "changed",
                runs: [
                  {
                    kind: "kept",
                    text: "Each view is designed, mocked up, and checked at",
                  },
                  {
                    kind: "removed",
                    text: "two",
                  },
                  {
                    kind: "added",
                    text: "three",
                  },
                  {
                    kind: "kept",
                    text: "widths.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "A renamed feature reads by its new name in the sidebar only: addresses, branches, and commits keep its slug.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Applies to",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "packages/web/, and every feature that adds or changes a view",
                  },
                ],
                check: [],
              },
            ],
          },
        ],
      },
      {
        name: "preview",
        title: "Preview",
        kind: "changed",
        listed: true,
        fields: [
          {
            name: "approved-by",
            before: "mrtolkien",
            after: "",
          },
          {
            name: "status",
            before: "active",
            after: "proposed",
          },
        ],
        sections: [
          {
            title: "",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Uraeda's planned UI and the states of its views are Storybook stories. They are written with the real components, so a mockup is the code that ships. Uraeda embeds them live in specs, questions, and sessions, fed by its real server, so a story shows what the app shows. A layout or freeform mockup may be an HTML page instead.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Rules",
            parts: [
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "Uraeda's preview MUST be the Storybook of packages/web, run by the command this decision's preview-folder and preview-command fields hold.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by ura check.",
                  },
                ],
              },
              {
                kind: "changed",
                strength: "must",
                runs: [
                  {
                    kind: "removed",
                    text: "Mockups",
                  },
                  {
                    kind: "added",
                    text: "A spec's mockups",
                  },
                  {
                    kind: "kept",
                    text: "and named states of views MUST be stories written with the real components, next to them.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review and lint.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "may",
                runs: [
                  {
                    kind: "kept",
                    text: "A layout or freeform mockup MAY be an HTML page in the feature's or the change's mockups/ folder instead, linked from its story: a page's layout, or a sketch no component holds yet.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "Storybook MUST run Uraeda's real server over fixture data, and stories MUST NOT fake its responses.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must-not",
                runs: [
                  {
                    kind: "kept",
                    text: "Stories MUST NOT run as tests: UI tests are Vitest tests, per the UI checks decision.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "vp run ready MUST build Storybook, so a story that does not compile fails.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by the storybook:build task.",
                  },
                ],
              },
              {
                kind: "kept",
                strength: "must",
                runs: [
                  {
                    kind: "kept",
                    text: "Storybook's packages MUST be pinned to exact versions.",
                  },
                ],
                check: [
                  {
                    kind: "kept",
                    text: "Checked by review.",
                  },
                ],
              },
              {
                kind: "added",
                strength: "may",
                runs: [
                  {
                    kind: "added",
                    text: "An investigation MAY compare throwaway prototypes in any format, in its feature's mockups folder, and the approval of its spec deletes them.",
                  },
                ],
                check: [
                  {
                    kind: "added",
                    text: "Checked by review.",
                  },
                ],
              },
            ],
          },
          {
            title: "Why",
            parts: [
              {
                kind: "changed",
                runs: [
                  {
                    kind: "kept",
                    text: "The human asked for real, interactive mockups inside the spec, and chose Storybook to run them (what the feature covers, Uraeda's preview environment). A mockup written with the real components removes the drift between mockups and code. Storybook runs on this repository's Vite+, React Compiler, StyleX, and WebKit, and Astryx develops its own components in it.",
                  },
                  {
                    kind: "added",
                    text: "Comparing several looks with the real components was too slow, so the human allowed throwaway prototypes in an investigation (prototypes in the workflow).",
                  },
                  {
                    kind: "kept",
                    text: "Running the real server keeps the stack decision's data only from the server, through fate.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Alternatives considered",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "A vp run preview task serving the whole app over fixtures: no new dependency, but pages only, and no place for variants.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Stories fed by fate caches from snapshots: works in a static build, but needs a snapshot per state.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Consequences",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Planned UI starts as real code: the picked variant is the first commit of its view.",
                  },
                ],
                check: [],
              },
              {
                kind: "added",
                runs: [
                  {
                    kind: "added",
                    text: "An investigation can compare several looks cheaply, and git keeps its prototypes once deleted.",
                  },
                ],
                check: [],
              },
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "Storybook adds many development dependencies and frequent releases to follow.",
                  },
                ],
                check: [],
              },
            ],
          },
          {
            title: "Applies to",
            parts: [
              {
                kind: "kept",
                runs: [
                  {
                    kind: "kept",
                    text: "packages/web/, its Storybook configuration, and every feature with UI work",
                  },
                ],
                check: [],
              },
            ],
          },
        ],
      },
    ],
    stories: [
      {
        id: "US1",
        title: "The terminal look",
        priority: "P1",
        journey: [
          "Every page takes the theme: JetBrains Mono at 120%, Catppuccin colours, square corners, and the dot-matrix tree as the logo and favicon. Settings switch between Mocha, Latte, and the system's.",
        ],
        mockups: [
          {
            label: "The look, in Mocha and Latte, and the logo",
            href: "mockups/terminal-2.html?w=1440&theme=mocha#/home",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "a system in dark mode and no scheme picked, "],
            ["When", "the human opens the app, "],
            ["Then", "it draws in Mocha, and in Latte once the system turns light."],
          ],
          [
            ["Given", "the scheme set to Latte in settings, "],
            ["When", "the system turns dark, "],
            ["Then", "the app stays in Latte, and does so again after a reload."],
          ],
          [
            ["Given", "a session on Claude Code and one on Pi, "],
            ["When", "they show in the sidebar, "],
            ["Then", "the first has Codicons' Claude mark, and the second the neutral Pi glyph."],
          ],
        ],
        more: [
          [
            ["Given", 'a browser whose earlier pick was "dark", '],
            ["When", "it opens the new version, "],
            ["Then", "it draws in Mocha, and settings show Mocha picked."],
          ],
          [
            ["Given", "no network, "],
            ["When", "the app loads, "],
            ["Then", "every font and icon draws, and no request leaves the machine."],
          ],
        ],
      },
      {
        id: "US2",
        title: "A shell for three widths",
        priority: "P1",
        journey: [
          "The shell is a column of bordered panes: the logo and repository, New and Note, the search, then Navigate, Needs you, Sessions, In progress, and Done, with the 5 h window and Settings at its foot. At 1280 px and wider it is a full column. From 768 to 1279 px it folds to a 52 px rail of icons, which opens over the page. Below 768 px it is a top bar of icon tabs. A status line at the bottom shows the page's key hints and the counts.",
        ],
        mockups: [
          {
            label: "Shell, wide",
            href: "mockups/terminal-2.html?w=1440#/home",
          },
          {
            label: "Shell, semi-wide",
            href: "mockups/terminal-2.html?w=1205#/home",
          },
          {
            label: "Shell, narrow",
            href: "mockups/terminal-2.html?w=390#/home",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "a window 1205 px wide, "],
            ["When", "the home opens, "],
            [
              "Then",
              "the shell is a 52 px rail, and pointing at it, focusing it, or tapping its logo opens it over the page at its full width.",
            ],
          ],
          [
            ["Given", "a window 1900 px wide, "],
            ["When", "the app opens, "],
            [
              "Then",
              "the column is 266 px wide, 14% of the window, and dragging its edge to 320 px keeps 320 px after a reload.",
            ],
          ],
          [
            ["Given", "a phone 390 px wide and 3 running sessions, "],
            ["When", "the human taps the Sessions tab, "],
            ["Then", "the sessions page opens, and the tab's badge reads 3."],
          ],
        ],
        more: [
          [
            ["Given", "the rail open over the page at 1205 px, "],
            ["When", "the human presses Escape or moves away, "],
            ["Then", "it folds back to 52 px."],
          ],
          [
            ["Given", "a window 1440 px wide and a feature waiting on the human, "],
            ["When", "any page shows, "],
            [
              "Then",
              'the feature sits in the Needs you pane, and the status line reads "1 need you".',
            ],
          ],
        ],
      },
      {
        id: "US3",
        title: "A home of core and overview",
        priority: "P2",
        journey: [
          'The home is centred. Above a dashed "Overview" line, the core, in this order: problems when there are any, then Needs you, then In progress beside Sessions. Below it, widgets in two columns: the priorities now, the usage of the 5 h window and the week, the inbox\'s three latest notes, and recent activity.',
        ],
        mockups: [
          {
            label: "Home, wide",
            href: "mockups/terminal-2.html?w=1440#/home",
          },
          {
            label: "Home, semi-wide",
            href: "mockups/terminal-2.html?w=1205#/home",
          },
        ],
        why: null,
        key: [
          [
            [
              "Given",
              "a feature whose `spec.md` lacks a required section, which stops the workflow, ",
            ],
            ["When", "the home opens, "],
            ["Then", "a red Problems pane names it first, above Needs you."],
          ],
          [
            ["Given", "a window 1205 px wide, "],
            ["When", "the home opens, "],
            ["Then", "In progress and Sessions sit side by side, and the widgets in two columns."],
          ],
          [
            ["Given", '"Layout and look and feel" waiting for answers, '],
            ["When", "the home opens, "],
            [
              "Then",
              'its row shows its full title, "Questions" and the round\'s size on a second line, and "Answer".',
            ],
          ],
        ],
        more: [
          [
            ["Given", "nothing stops the workflow, "],
            ["When", "the home opens, "],
            ["Then", "no Problems pane shows, and Needs you comes first."],
          ],
          [
            ["Given", "a phone, "],
            ["When", "the home opens, "],
            ["Then", "every pane is in one column, in the same order."],
          ],
        ],
      },
      {
        id: "US4",
        title: "Decisions in three columns",
        priority: "P2",
        journey: [
          'The decisions page has the shell, the list, and the reader. The list is the active pane, its border in the accent colour, 30% of the window on wide screens: the constitution\'s principles, then the decisions, each with its icon and the first sentence of its intent. The reader is open by default. A principle opens the whole constitution in it, at that principle. A palette, opened with `/` or "Jump to…", finds any entry and previews the one under the cursor.',
        ],
        mockups: [
          {
            label: "Decisions, the constitution open",
            href: "mockups/terminal-2.html?w=1900#/decisions/p-III",
          },
          {
            label: "Decisions, a changed decision",
            href: "mockups/terminal-2.html?w=1440#/decisions/ui-layout",
          },
          {
            label: "Decisions, the palette",
            href: "mockups/terminal-2.html?w=1440#/decisions/stack",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "the decisions page with nothing picked, "],
            ["When", "it opens, "],
            ["Then", "the reader shows the constitution, and the list marks principle I."],
          ],
          [
            ["Given", "the reader on principle III, "],
            ["When", 'the human clicks "UI layout" in the list, '],
            ["Then", "the reader shows it, and the address ends in `/decisions/ui-layout`."],
          ],
          [
            ["Given", "the decisions page, "],
            ["When", 'the human presses `/` and types "noti", '],
            ["Then", 'the palette lists "Notifications", and previews its intent and first rules.'],
          ],
        ],
        more: [
          [
            ["Given", "a phone, "],
            ["When", 'the human taps "Settings" in the list, '],
            ["Then", "the reader replaces the list, with a way back to it."],
          ],
          [
            ["Given", "a decision changed on this branch, "],
            ["When", "it opens, "],
            ["Then", "the reader shows the change as a diff before its rules."],
          ],
        ],
      },
      {
        id: "US5",
        title: "Settings on one page",
        priority: "P3",
        journey: [
          "Settings is one form of bordered sections, Server, Appearance, Sign-in, Agents, Runs, and Reviews, each row with an icon, a name, a line of help, and its control. A search at the top right filters the rows. A Form and File switch shows `settings.toml` as written, where clicking a value with a fixed set of values opens a picker.",
        ],
        mockups: [
          {
            label: "Settings, the form",
            href: "mockups/terminal-2.html?w=1440#/settings",
          },
          {
            label: "Settings, the file and a picker",
            href: "mockups/terminal-2.html?w=1440&sv=file#/settings",
          },
        ],
        why: null,
        key: [
          [
            ["Given", "the settings page, "],
            ["When", 'the human types "port" in the search, '],
            ["Then", "only the Port row shows, under Server."],
          ],
          [
            ["Given", "the file view, "],
            ["When", "the human clicks the value of `open_browser` and picks `false`, "],
            [
              "Then",
              "the file is written with its comments kept, and the form shows the switch off.",
            ],
          ],
        ],
        more: [
          [
            ["Given", 'a search with no match, "zzz", '],
            ["When", "it is typed, "],
            ["Then", 'the page reads "No setting matches “zzz”."'],
          ],
        ],
      },
      {
        id: "US6",
        title: "Prototypes in an investigation",
        priority: "P3",
        journey: [
          "An investigation can compare looks as throwaway prototypes, in any format, in its feature's `mockups` folder. The approval of the spec deletes them, and the spec's mockups are stories.",
        ],
        mockups: [],
        why: null,
        key: [
          [
            ["Given", "a feature whose discovery compares three looks, "],
            ["When", "the agent writes its round, "],
            ["Then", "it may link HTML prototypes in `mockups/`, and `ura check` passes."],
          ],
          [
            ["Given", "that feature's spec approved, "],
            ["When", "the approval step runs, "],
            ["Then", "it deletes the prototypes in the same commit."],
          ],
        ],
        more: [],
      },
    ],
    archIntro: [
      "The look is one Astryx theme, and the layout three width classes read from it. Four parts Astryx lacks become small shared components, as the [UI look](../decisions/ui-look.md) and [components](../decisions/ui-components.md) decisions allow. Astryx is upgraded to 0.7 first, so the theme is built on the version it ships with ([discovery](discovery-02.md#astryx-and-the-terminal-look)).",
    ],
    units: [
      "**The theme** holds the Catppuccin schemes as named token pairs, the font, square corners, the 120% scale, and the breakpoints at 768 and 1280 px. It owns every colour and size.",
      "**The scheme preference** keeps Mocha, Latte, or System in the browser, and resolves System.",
      "**The width class** turns the breakpoints into narrow, semi-wide, or wide: the one place a view learns its width.",
      "**The pane** draws a border with its title in it, and an accent when active. Every view's grouping uses it.",
      "**The shell** composes the panes into the column, the rail, or the top tabs, by width class. It owns what stays one tap away at each width.",
      "**The status line** shows the hints a page declares, and the counts.",
      "**The marks**: the logo and favicon, drawn once, the icon registry with its few glyphs from other sets, and the harness mark.",
      "**The home**, **the decisions page with its palette**, and **the settings page** compose these parts. The file view reads `settings.toml` through the server, and writes through the setters the form uses.",
      "**The skill** lets discovery link prototypes, and the approval step delete them.",
    ],
    tradeoffs: [
      "Squaring Astryx may need more overrides into its inner elements, which an upgrade can break.",
      "The prototypes stay until the stories replace them, past the spec's approval this once.",
    ],
    edges: [
      [
        "High",
        'A browser picked "light" or "dark" before',
        "it reads as Latte or Mocha, and nothing resets",
      ],
      [
        "High",
        "`settings.toml` is missing or invalid",
        "both views show the file's problem, as the form does today",
      ],
      [
        "High",
        "A write from the file view fails",
        "the value stays as it was, and the error shows beside it",
      ],
      [
        "Normal",
        "The rail on a touch screen, which has no pointer",
        "a tap on the logo opens it, and a tap outside folds it",
      ],
      [
        "Normal",
        "A harness Codicons has no mark for, or an unknown one",
        "it gets its neutral glyph, or a generic agent glyph",
      ],
      ["Normal", "The palette's search matches nothing", 'it reads "Nothing matches."'],
      ["Normal", "The column dragged past its limits", "it stops at 220 px and at 480 px"],
      [
        "Niche",
        "The window crosses 1280 px with the rail open",
        "the rail becomes the column, and the page keeps its place",
      ],
      [
        "Niche",
        "A value without a fixed set, like the port, in the file",
        "it opens the form at that row",
      ],
    ],
    criteria: [
      {
        id: "SC-001",
        measure: "contrast",
        sentence: "every text token reaches 4.5:1, and borders 3:1, in Mocha and Latte.",
      },
      {
        id: "SC-002",
        measure: "offline",
        sentence: "the built app makes no request to another host.",
      },
      {
        id: "SC-003",
        measure: "half screen",
        sentence: "at 1205 px the shell takes 52 px, and the home keeps two columns.",
      },
      {
        id: "SC-004",
        measure: "one pane",
        sentence: "every bordered group on the four views is the shared pane.",
      },
      {
        id: "SC-005",
        measure: "palette",
        sentence: "any of the 30 entries opens in three keys or fewer from the decisions page.",
      },
    ],
    assumptions: [
      "The points settled in [round 01](clarifications-01.md#settled-without-the-human) and [round 02](clarifications-02.md#settled-without-the-human) hold as written there, except the spec's mockups, which you asked to be the HTML prototypes. Settled while writing this spec:",
      {
        list: [
          "**Decisions keep today's order**, newest change first or A to Z, with its sort menu. Decisions have no area, so the mockup's grouping by area would need a new field.",
          "**Settings show the real settings**, not the mockup's examples. Appearance holds the colour scheme, kept in this browser as today.",
          "**Key hints show only keys that work today**: `j` and `k` in lists, `/`, and Escape. The keyboard feature adds the rest.",
          "**What the shell keeps from today**: the repository menu on the logo, the session search, the ＋ on Priorities, and the latest done items in a Done pane.",
          "**Text is 120% at every width**, the phone included, since the mono font reads small below it.",
          "**Codicons' licence asks for attribution**, which the README's credits give.",
        ],
      },
    ],
    principles: [
      {
        label: "I. Humans in control",
        ok: true,
      },
      {
        label: "II. Plain text",
        ok: true,
      },
      {
        label: "III. Async",
        ok: true,
      },
      {
        label: "IV. Review effort",
        ok: true,
      },
      {
        label: "V. Tools optional",
        ok: true,
      },
      {
        label: "VI. Checked code",
        ok: true,
      },
    ],
    riskText:
      "**Medium**: every view changes look, and one stored browser preference changes its values. No workflow data changes.",
  },
};
