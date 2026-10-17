# Discovery, round 01: Redesign and reword specs

## Summary

A spec is what the human approves before code is written. Established practice puts a short summary
and the approval state first, keeps the reviewer-facing "what" apart from the "how", lists
decisions, risks, and non-goals as their own parts, and shows any change to an approved text as a
redline in place. Spec Kit and Kiro split the "what" (spec, requirements) from the "how" (plan,
design) into separate files. Products differ on length budgets, on cards against plain documents,
and on whether an approved decision is edited or superseded.

The proposal asks for specs readable in one sitting, without any outside context: decisions first,
each change shown as a diff and easy to comment on, then a linear document with cards, tables,
colour, and hierarchy. It adds a word budget, cuts, and moves to the plan, measured on 16 specs. It
also names two bugs: the frontmatter shown in the edit box, and the page jumping on comment.

Today, specs run 3,900 to 7,700 words, and every spec created or changed about two decisions. A
decision change restates every rule in a `## Proposed change` section, so the change is never shown.
The web UI draws a spec as generic markdown, with folds and a few story headings. Decision links
open the default branch's ledger, where a proposed decision does not exist. The
[clarifications redesign](#the-clarifications-redesign), approved but not built, already brings a
shared writing reference, `ura check` warnings, Mermaid diagrams, and table column floors.

## How other products do it

### GitHub Spec Kit

- The spec holds user scenarios with Given/When/Then, edge cases, requirements, success criteria,
  and assumptions. Stories are ordered P1, P2, each "independently testable", with "Why this
  priority"
  ([spec template](https://raw.githubusercontent.com/github/spec-kit/main/templates/spec-template.md)).
- It keeps the spec to "WHAT users need and WHY", and says "Avoid HOW to implement (no tech stack,
  APIs, code structure)", "Written for business stakeholders, not developers"
  ([specify command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/specify.md)).
- The plan holds the technical context, a constitution check as a gate, and complexity tracking
  filled "ONLY if Constitution Check has violations"
  ([plan template](https://raw.githubusercontent.com/github/spec-kit/main/templates/plan-template.md)).
  Research, data model, and contracts are separate files
  ([plan command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/plan.md)).

### Kiro

- Three files: requirements, design, tasks, with a review pause between phases
  ([specs](https://kiro.dev/docs/specs/),
  [feature specs](https://kiro.dev/docs/specs/feature-specs/)).
- Requirements are user stories with EARS criteria: "WHEN [condition] THE SYSTEM SHALL [behavior]".
  The design holds architecture, sequence diagrams, data models, error handling, and testing
  ([requirements-first](https://kiro.dev/docs/specs/feature-specs/requirements-first/)).
- Its Markdown Review comments on a selected passage, groups comments under the nearest heading,
  sends them as one batch, and marks a comment "document updated" once its passage is gone. It draws
  an outline, zoomable Mermaid, and tables that scroll sideways
  ([markdown review](https://kiro.dev/docs/ide/editor/markdown-review/)).
- Best practice: "Maintain focused, manageable spec documents", several small specs rather than one
  ([best practices](https://kiro.dev/docs/specs/best-practices/)).

### BMAD

- A solo PRD aims for "about two pages", internal tools "five to eight"; extra detail goes to an
  addendum
  ([bmad-prd](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/skills/bmad-prd/SKILL.md)).
- Architecture decisions are short blocks with three fields, Binds, Prevents, and Rule: "Decisions,
  not rationale (rationale lives in the memlog)"
  ([spine template](https://raw.githubusercontent.com/bmad-code-org/BMAD-METHOD/main/skills/bmad-architecture/assets/spine-template.md)).

### Superpowers

- The design is played back in chunks of "about 200-300 words", then handed over as "a plain
  document" with "a short list of its own calls" for the human to check
  ([brainstorming](https://raw.githubusercontent.com/obra/superpowers/main/skills/brainstorming/SKILL.md)).

### Copilot Workspace

- Its spec compared "the current state (as is) with the desired outcome (to be)" as editable bullet
  lists, a behaviour diff ([Montini](https://leonardomontini.dev/copilot-workspace)).

### Design documents and RFCs

- Google design docs: context, goals and non-goals, the design, alternatives ("one of the most
  important sections"), cross-cutting concerns. 10 to 20 pages for a large project, 1 to 3 for a
  "mini design doc"
  ([Design Docs at Google](https://www.industrialempathy.com/posts/design-docs-at-google/)).
- Rust RFCs open with a one-paragraph summary, and explain the feature to users before its reference
  design ([template](https://raw.githubusercontent.com/rust-lang/rfcs/master/0000-template.md)).
- Squarespace's RFC opens with its approvers, "yes | not yet", then an overview: "If someone only
  reads this far, what do you want them to know?"
  ([template](https://slab.com/library/templates/squarespace-rfc-template/)).
- KEPs put a signoff checklist first, user stories, and risks and mitigations
  ([KEP template](https://raw.githubusercontent.com/kubernetes/enhancements/master/keps/NNNN-kep-template/README.md)).
- Shape Up pitches name the rabbit holes and the no-gos
  ([chapter 6](https://basecamp.com/shapeup/1.5-chapter-06)).
- Stripe publishes exemplar documents rather than fill-in templates
  ([Slab](https://slab.com/blog/stripe-writing-culture)).

### Decision records

- Nygard: "The whole document should be one or two pages long"
  ([Cognitect](https://cognitect.com/blog/2011/11/15/documenting-architecture-decisions)).
- MADR 4.0.0's minimal template: the problem in two or three sentences, the options, "Chosen option:
  X, because", and consequences. Its optional "Confirmation" says how compliance is checked
  ([MADR](https://adr.github.io/madr/),
  [minimal template](https://raw.githubusercontent.com/adr/madr/develop/template/adr-template-minimal.md)).
- AWS treats an accepted record as immutable and supersedes it with a new one
  ([AWS](https://docs.aws.amazon.com/prescriptive-guidance/latest/architectural-decision-records/adr-process.html)).
  Henderson's collection says "mutability has worked better for our teams"
  ([collection](https://github.com/joelparkerhenderson/architecture-decision-record)). Uraeda edits
  in place, so its reviewer needs to see the change.
- log4brains and Backstage's ADR plugin list decisions with status chips. Neither shows a diff
  ([log4brains](https://github.com/thomvaill/log4brains),
  [Backstage](https://github.com/backstage/community-plugins/blob/main/workspaces/adr/plugins/adr/README.md)).

### Showing a change to a text

- Google Docs, Word, Notion, GitBook, and Confluence all show the change inside the rendered text,
  insertions marked and deletions struck, each change commented on in place
  ([Google](https://support.google.com/docs/answer/6033474),
  [Word](https://support.microsoft.com/en-us/office/track-changes-in-word-197ba630-0f5f-4a8e-9a77-3712475e806a),
  [Notion](https://www.notion.com/help/suggested-edits),
  [GitBook](https://gitbook.com/docs/collaboration/change-requests),
  [Confluence](https://confluence.atlassian.com/display/DOC/Page+History+and+Page+Comparison+Views)).
- GitBook shows before and after side by side by default, or inline. GitHub's rendered prose diff
  cannot be commented on: comments go on the source lines
  ([GitHub](https://docs.github.com/en/repositories/working-with-files/using-files/working-with-non-code-files)).
- The US House requires a "comparative print" of how a bill changes current law, because bills are
  written as "strike X, insert Y" instructions
  ([Rule XXI clause 12](https://budgetcounsel.com/laws-and-rules/%c2%a7371-12-clause-12-of-rule-xxi/)).
  Judgement: instructions alone lost to the redline.
- GOV.UK change notes say what changed, specifically, on top of the change
  ([change notes](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/change-notes/)).

### Presenting stories and reading attention

- Readers read about 20% of a page's words, and scan headings
  ([NN/g](https://www.nngroup.com/articles/how-little-do-users-read/),
  [F-pattern](https://www.nngroup.com/articles/f-shaped-pattern-reading-web-content/)).
- Reviewers comment more on what comes first: a defect in the last file had 64% lower odds of being
  found than in the first ([Fregnan et al.](https://arxiv.org/abs/2208.04259)).
- Code review finds most defects at 200 to 400 lines per 60 to 90 minutes
  ([SmartBear](https://smartbear.com/learn/code-review/best-practices-for-peer-code-review/)). No
  equivalent figure exists for design documents.
- Cucumber recommends 3 to 5 steps per example
  ([Gherkin reference](https://cucumber.io/docs/gherkin/reference/)).
- Cards suit "heterogeneous items" users browse, and are "less scannable than lists"
  ([NN/g cards](https://www.nngroup.com/articles/cards-component/)).
- GOV.UK and NN/g advise against hiding what most readers need behind folds or tabs
  ([details](https://design-system.service.gov.uk/components/details/),
  [accordions](https://www.nngroup.com/articles/accordions-complex-content/),
  [tabs](https://design-system.service.gov.uk/components/tabs/)).
- GitHub limits alerts to "one or two per article"
  ([syntax](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/basic-writing-and-formatting-syntax)).

### What they have in common

1. A summary first, for the reader who stops there, with the approval state.
2. The "what" to approve apart from the "how": separate files, or an appendix.
3. Decisions as short records, with how they are checked.
4. Alternatives, risks, and non-goals as their own parts.
5. Prioritised stories with few concrete criteria.
6. Stable IDs that trace stories to tests and tasks.
7. A length budget, from one page to six, with the rest in an appendix.
8. A review that comments on a passage and sends the comments as one batch.
9. A change to an approved text shown as a redline, with a change note.
10. An outline beside a long document, diagrams that zoom, tables that scroll.

## Standards and libraries

### The clarifications redesign

On branch `2026-10-17-redesign-clarifications`, approved with its plan, not merged
(`specs/2026-10-17-redesign-clarifications/spec.md` there):

- `skills/uraeda/references/writing.md`: "the one home of the writing rules of every document
  written for the human". It states "The specs redesign extends it". It already holds sentences of
  at most 25 words, terms defined at first use, no answer cited by its number alone, and no ID from
  a file the reader has not seen.
- `ura check` gains warnings, which do not fail it, on files waiting for the human. The limits live
  in one core module, `check/writing.rs`.
- The time estimate is computed: words at 250 a minute, plus a minute per question. The proposal
  here says 200 a minute plus a minute per mockup.
- Two new decisions. **Diagrams**: Mermaid code blocks, drawn on demand in a sandboxed frame, for
  "rounds of questions, specs, plans, data models". A diagram "MUST NOT repeat what the text around
  it already says as a list". **Compatibility**: no old format is kept before 1.0. A format change
  updates the templates, the example, the fixtures, and the default branch's files on the same
  branch. Records in `specs/done/` are not converted.
- Tables get a 144 px column floor and scroll in their own region, "rounds and specs alike".
- It leaves to this feature: the right sidebar, the reading measure of spec pages, the spec's
  writing rules, and separating answers to review comments from revision 2 on.
- Its plan edits `SKILL.md`, `references/spec.md`, `finish.md`, `conventions.md`, and `Blocks.tsx`,
  which this feature also edits.

### Writing instructions every model follows

- Anthropic, OpenAI, and Google all recommend stating the format explicitly, and steering it with
  consistent examples
  ([Anthropic](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/claude-4-best-practices),
  [OpenAI](https://developers.openai.com/api/docs/guides/prompt-guidance),
  [Gemini](https://ai.google.dev/gemini-api/docs/prompting-strategies)).
- Their defaults differ: GPT-6 "tends to use lists, tables and Markdown", GPT-5.2's guide preferred
  "compact bullets", Anthropic's sample asks for prose
  ([GPT-5.2](https://developers.openai.com/cookbook/examples/gpt-5/gpt-5-2_prompting_guide)). The
  skill must state the format.
- Anthropic notes Opus 5 writes files "longer than on prior models"
  ([Opus 5](https://platform.claude.com/docs/en/build-with-claude/prompt-engineering/prompting-claude-opus-5)).
- Models follow word counts poorly: under 30% strict compliance with naive prompts
  ([Xie and Lee](https://arxiv.org/abs/2508.13805v1),
  [LIFEBench](https://arxiv.org/abs/2505.16234)). Verifiable limits, checked by code, work
  ([IFEval](https://arxiv.org/abs/2311.07911)).
- GOV.UK: split sentences over 25 words, at most 5 sentences a paragraph, most important first
  ([clear language](https://guidance.publishing.service.gov.uk/writing-to-gov-uk-standards/writing-guidelines/clear-language/)).

### Diffing prose

- Markdown here wraps at 100 characters (`proseWrap: "always"`,
  [`vite.config.ts`](/vite.config.ts)), so one changed word can move every later line break of a
  paragraph. A diff by paragraph or list item, with lines joined, sees no change in a rewrap.
  Judgement, from [git's word diff](https://git-scm.com/docs/git-diff) and
  [sembr](https://sembr.org/).
- The core parses with pulldown-cmark 0.13.4, whose offset iterator gives each block's place in the
  source ([docs](https://docs.rs/pulldown-cmark/0.13.4/pulldown_cmark/struct.Parser.html)).
- Word diff libraries: `similar` 3.2.0 and `dissimilar` 1.0.11 in Rust
  ([similar](https://docs.rs/similar/latest/similar/),
  [dissimilar](https://docs.rs/dissimilar/latest/dissimilar/)); jsdiff 9.0.0 in the browser, about 8
  KB gzipped ([jsdiff](https://github.com/kpdecker/jsdiff)). React diff viewers are line-based code
  widgets: `@git-diff-view/react` is 338 KB gzipped, and `react-diff-viewer-continued` brings
  emotion ([git-diff-view](https://github.com/MrWangJustToDo/git-diff-view),
  [react-diff-viewer](https://github.com/Aeolun/react-diff-viewer-continued)).
- `git diff main...branch -- specs/decisions/` gives exactly a branch's changes
  ([git-diff](https://git-scm.com/docs/git-diff)).

### Data models

- Mermaid 12 lays out ER diagrams with ELK. Attribute types must start with a letter: no generics or
  unions. Class diagrams handle in-memory types, with generics and enumerations. `accTitle` and
  `accDescr` work on every diagram
  ([ER syntax](https://mermaid.js.org/syntax/entityRelationshipDiagram.html),
  [class diagram](https://mermaid.js.org/syntax/classDiagram.html),
  [accessibility](https://mermaid.js.org/config/accessibility.html)).
- Stripe lists each attribute as name, type, then a sentence
  ([Customer](https://docs.stripe.com/api/customers/object)). A generated ER diagram plus a field
  list is the common pairing
  ([prisma-erd-generator](https://github.com/keonik/prisma-erd-generator)).

### Reading and colour

- Body text reads best at 50 to 75 characters a line; WCAG's AAA limit is 80
  ([Baymard](https://baymard.com/blog/line-length-readability),
  [WCAG 1.4.8](https://www.w3.org/WAI/WCAG22/Understanding/visual-presentation.html)).
- Colour is never the only cue (WCAG 1.4.1): a diff needs strike-through and underline too
  ([1.4.1](https://www.w3.org/WAI/WCAG22/Understanding/use-of-color.html)).

### Scroll anchoring

- Browsers keep the reading place when content above it changes size, unless
  `overflow-anchor: none`. MDN marks it "Baseline 2026", across current browsers since September
  2026 ([MDN](https://developer.mozilla.org/en-US/docs/Web/CSS/overflow-anchor)).

## The code

### Important reads

- [`FilePage.tsx`](/packages/web/src/FilePage.tsx): a spec or plan waiting for the human goes to
  `ReviewPage`. Everything else, approved specs, plans, rulings, data models, and records, goes to
  `DocumentPage` and the generic [`Blocks.tsx`](/packages/web/src/Blocks.tsx).
- [`ReviewPage.tsx`](/packages/web/src/ReviewPage.tsx), 355 lines, its main function near the
  100-line limit: the mockup buttons, then the blocks with folds, then "Your review". It shows a
  review's comments only while it is pending, so a revision shows none of the comments it answers.
  The comments still reach the page, in `FileView.review`.
- [`ReviewHeadings.tsx`](/packages/web/src/ReviewHeadings.tsx): a story heading becomes a band, "US1
  · P1", on the review page only. [`ReviewMockups.tsx`](/packages/web/src/ReviewMockups.tsx): one
  large button per mockup, the "big links" the proposal removes.
- [`Blocks.tsx`](/packages/web/src/Blocks.tsx), 439 lines: a callout is a 4 px coloured bar and a
  bold title. Tables have no column floor. Acceptance scenarios are a plain numbered list. The
  reading measure is 90 characters.
- [`Folds.tsx`](/packages/web/src/Folds.tsx): each story's scenarios fold as "Scenarios (N)", and
  `## Details` folds whole.
- [`files/spec.rs`](/crates/core/src/files/spec.rs): finds stories, "Why this priority", the list
  after a paragraph ending "scenarios:", `SC-` criteria, the `Mockups` and `Details` sections by
  name. The web uses neither the criteria nor "Why this priority".
- [`check/sections.rs`](/crates/core/src/check/sections.rs): `ura check` takes every file's sections
  from its template, so changing a template changes the check. An unknown level-2 section is an
  error.
- [`workspace/read.rs`](/crates/core/src/workspace/read.rs): a decision is pending when the spec's
  `## Decisions` section links it and it is `proposed` or has `## Proposed change (<folder>)`.
  Nothing parses that section's content.
- [`api/ledger.rs`](/crates/core/src/api/ledger.rs): decisions are read from the default branch
  only. [`links.tsx`](/packages/web/src/links.tsx) sends every decision link to that page.
  [`workspace/links.rs`](/crates/core/src/workspace/links.rs) drops a link's `#anchor`.
- [`decisions/DecisionDetail.tsx`](/packages/web/src/decisions/DecisionDetail.tsx): a decision with
  a status badge, then its blocks. No diff exists anywhere in the core or the web. Astryx 0.6.8 has
  no diff component.
- [`EditorPage.tsx`](/packages/web/src/EditorPage.tsx) and
  [`pane/useDraftEditor.ts`](/packages/web/src/pane/useDraftEditor.ts): the text box holds the whole
  file, frontmatter included, under the "Discovery effort" control that sets the same value.
- [`files/document.rs`](/crates/core/src/files/document.rs), 628 lines, over the 500-line limit and
  allowed only to shrink: a task must split it before adding to it. `views.ts` (381) and `items.rs`
  (379) grow with every new field.
- No story exists for `ReviewPage`, `DocumentPage`, or `Blocks`.

### The proposal's path and existing actions

- **Opening a spec to review**: the page shows the mockup buttons, then the block, the intro, and
  every section, details folded. With the redesign, what is approved comes first, then the answers
  to the last review, then decisions.
- **Following a decision link**: today a new decision shows "Nothing here." and a changed one shows
  the default branch's text, without its proposed change or anchor. The links in the files are
  right: all 29 links of the basic-security spec resolve at its commit `b938093`.
- **Commenting**: a tap opens the comment form under the tapped block. The page shifts when the form
  moves to another block, when it closes on send, when the phone's full-height spacer goes, and when
  story frames above the reading place load and resize. Nothing keeps the reading place on this
  page.
- **Requesting changes, then reading revision 2**: the earlier review's record stays above the
  summary, and the new block answers "C1: done" by number. Specs at revision 2 or 3 open with 460 to
  874 words of such records.
- **Approving**: the approval step, an agent, rewrites each changed decision from its proposed
  change section, then removes the section. The only trace of the change is then git history.
- **Finishing**: the spec is deleted and replaced by the record, which cites ruling IDs ("ruling
  R3") into a deleted file. The skill's example record does it too.
- **Editing a proposal**: the text box shows the frontmatter's
  `discovery: high # low, medium, or high: ...` under the control that sets it.
- **A spec in the old format on a branch in flight**: the compatibility decision makes it fail
  `ura check` until an agent rewrites it.

### Rules and their owners

- **The block's contents**: [`SKILL.md`](/skills/uraeda/SKILL.md), copied in `spec.md`, `plan.md`,
  `discovery.md`, `implementation.md`, `change.md`, and the spec template. The clarifications
  redesign moves it to `writing.md`.
- **The time estimate**: "an honest estimate" in `SKILL.md`, and five other wordings.
- **The constitution check as a full table**: `spec.md` and `plan.md`, word for word, and both
  templates. The constitution only requires "a constitution check".
- **A decision change restates every rule**: `spec.md`, `change.md`, the decision template, and
  `approval.md`, which applies it.
- **The spec's sections**: the template, read by `check/sections.rs`. Names copied in
  `files/spec.rs` ("Mockups", "Details"), `workspace/read.rs` ("Decisions"), and web and core tests.
- **Which branch decisions are read from**: `api/ledger.rs`, the default branch only.

### Likely changes

Under every option:

- [`skills/uraeda/references/spec.md`](/skills/uraeda/references/spec.md),
  [`approval.md`](/skills/uraeda/references/approval.md),
  [`plan.md`](/skills/uraeda/references/plan.md),
  [`finish.md`](/skills/uraeda/references/finish.md),
  [`change.md`](/skills/uraeda/references/change.md), [`SKILL.md`](/skills/uraeda/SKILL.md), and
  `writing.md` once merged.
- The templates: [spec](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/spec.md),
  [plan](/skills/uraeda/assets/templates/specs/YYYY-MM-DD-feature-slug/plan.md),
  [decision](/skills/uraeda/assets/templates/specs/decisions/decision-topic.md), and the
  [example](/skills/uraeda/assets/example/specs/2026-10-06-recurring-tasks/spec.md) with its plan,
  decisions, and record.
- The fixtures' specs and plans, in `fixtures/repo/branches/` and `fixtures/preview/`.
- `ReviewPage.tsx`, split first, `ReviewHeadings.tsx`, `ReviewMockups.tsx` removed, `Folds.tsx`,
  `Blocks.tsx`, split first, `links.tsx`, `decisions/DecisionDetail.tsx`, and new stories.
- `files/spec.rs`, `files/items.rs`, `workspace/links.rs` to keep anchors, `api/ledger.rs` or a new
  view to read a branch's decisions.
- `useCommentDraft.ts`, `StoryFrames.tsx`, and `ReviewPage.tsx` for the reading place;
  `EditorPage.tsx` and `pane/useDraftEditor.ts` for the frontmatter.

With a decision diff: a word diff in the core, from `similar` or `dissimilar`, or in the web, from
jsdiff, and a view of each decision's default-branch and branch versions. With
[the change written in place](#how-a-spec-changes-a-decision): `approval.md`, `workspace/read.rs`,
and the decision template lose the proposed change section. With a decisions rewrite: the 18 files
of [`specs/decisions/`](/specs/decisions/) and the fixtures' 5.

## The proposal

### The scope holds several features

The proposal covers the spec's wording and page, decisions' format, diff, and comments, plans, data
models, the right sidebar, the edit box's frontmatter, and the page jump. Plans were never reviewed:
no `plan-review.md` ever existed, and all 21 specs set `plan-review: false`. No `data-model.md` was
ever committed. Data lived in each spec's "Data" bullets, 22 of 24 with inline types.

### The word budget against "more context"

The proposal's findings ask for a 1,500 to 2,000 word budget. The human answered the clarifications
redesign "I want MORE context if anything, do not limit it", and said of records: "I'm not sure a
line count goal is necessary. What matters is a clear structure". Folding alone did not shorten
specs: 5,054 words on average before it, 5,474 after.

### "Decisions first" against "mockups front and center"

The proposal puts decisions first, then a mockups gallery second (change 2), and removes the big
mockup links "now that they are embedded". In an earlier review, the human wrote "Mockups should be
front and center in the spec view". A gallery would repeat every mockup a story already embeds.

### What "not human-checked enough" means

Every spec created or changed a decision: 20 new and 27 changes over 24 specs, against the skill's
"Most features produce no decision, or one". Of 37 review comments, 4 touched a decision, all on the
block, none on a decision file. About 12 rule changes went in through fix, feat, chore, and docs
commits, outside any spec. The one structural request on a decision, "more concepts-based and less
'hard rules'", produced 77% more words and 3 more MUSTs.

### Decisions are long, and only grow

The 18 decisions hold 18,728 words, about 1,040 each, against 276 in the example. Every decision a
spec changed grew 2 to 4 times. A one-rule change restates every rule: add-bugfixing's "wording
only" change was 1,095 words for about 30 changed lines. redesign-interface asked for 4,555 words of
decision text on top of a 6,742-word spec.

### Comment answers by number

"C1: done" sits in 5 of 5 items of a revision's block, the same problem as "Your Q4 answer". The
human asked, in the clarifications redesign's review, to "clearly separate comment answers from the
spec on v2 and forward". 36 phrases in specs cite an answer by its number, and 129 links show only
"Q4" as their text.

### The right sidebar is open

The proposal's "TODO: Define what goes in the right sidebar on desktop!" has no answer yet. The
clarifications redesign moved the session-beside-the-page idea to a later feature. The
[UI layout decision](/specs/decisions/ui-layout.md) says a column beside a view MAY hold what the
human needs in view, and MUST be foldable and resizable.

## Worth it and feasibility

- **Worth it**: approving a spec is the human's main job, and it takes about 15 minutes against
  blocks claiming 20 to 45. Comments land on the block and mockups only, so 30 to 50% of each spec
  goes unread. Decisions, "the main thing that stays from a branch", are never reviewed as files.
  The cost is a format change across the skill, the core, and the web, on top of the clarifications
  redesign. Judgement: worth it, with the scope cut to specs and decisions.
- **Relies on the clarifications redesign**: the writing reference, warnings, diagrams, and table
  floors come from that branch. Building this feature first would duplicate them.
- **Outside behaviour**: scroll anchoring is "Baseline 2026" per MDN; Safari's version was seen only
  in a secondary source, so the plan checks it in WebKit first. Mermaid's ER syntax limits are
  documented. A word diff by block was checked in the mockups: a rewrapped paragraph shows no
  change.
- **Guards**: none relaxed. A decision written in place on a branch is not binding until approval,
  and other branches read the default branch's.

## Approaches

Criteria: the proposal (readable without context, decisions first with a diff, cards, colour, and
hierarchy), Principle I (humans stay in control), Principle II (plain text first), Principle IV
(review effort matches impact), Principle V (tools are optional), the
[UI layout](/specs/decisions/ui-layout.md), and the compatibility decision.

### Scope

What this feature covers, and what becomes its own feature.

| Option                                  | Readability gain           | Size   | Unreviewed work redesigned |
| --------------------------------------- | -------------------------- | ------ | -------------------------- |
| A. Specs and decisions, with both bugs  | the review page, decisions | large  | none                       |
| B. Specs only, decisions later          | the review page            | medium | none                       |
| C. Every agent page: plans, data, rules | every page                 | larger | plans, rulings             |

### How a spec changes a decision

How the change is written in the decision file. See
[decisions are long](#decisions-are-long-and-only-grow).

| Option                                          | Diff shown by     | Words to read     | Plain text, git         |
| ----------------------------------------------- | ----------------- | ----------------- | ----------------------- |
| A. Edit the file in place, `status: proposed`   | git, exactly      | the change        | `git diff` works        |
| B. A proposed change section with changed rules | a parser of rules | the changed rules | readable, no `git diff` |
| C. Today's section restating every rule, diffed | a parser of rules | every rule again  | readable, no `git diff` |

### How a decision's change shows

Applies under every option above. See [showing a change to a text](#showing-a-change-to-a-text).

| Option                | Who does it         | On a phone | Old wording visible |
| --------------------- | ------------------- | ---------- | ------------------- |
| A. Inline redline     | Google Docs, Word   | same       | struck, in place    |
| B. Side by side       | GitBook (default)   | stacked    | in its own column   |
| C. Marked, old hidden | Notion's side notes | same       | behind a toggle     |

### The shape of a decision

| Option                                      | Length            | Concepts first | Rewrite forced |
| ------------------------------------------- | ----------------- | -------------- | -------------- |
| A. Intent first, at most 7 rules, warnings  | about MADR's      | yes            | no             |
| B. Today's shape, with sentence limits only | shorter sentences | no             | no             |
| C. Today's shape                            | grows             | no             | no             |

### The existing decisions

A, a follow-up feature; B, in this feature; C, only when next changed. Only matters with A or B of
[the shape of a decision](#the-shape-of-a-decision).

### Who creates a decision

| Option                                                 | Human check          | Rounds      |
| ------------------------------------------------------ | -------------------- | ----------- |
| A. Only from an answered question, and a check warning | every decision asked | more, early |
| B. The spec step proposes, as today, and a warning     | at approval only     | as today    |
| C. As today                                            | at approval only     | as today    |

### The page's order

| Option                                                    | Decisions first | Mockups       |
| --------------------------------------------------------- | --------------- | ------------- |
| A. Block, review answers, decisions, stories with mockups | yes             | in each story |
| B. Same, plus a gallery after decisions                   | yes             | twice         |
| C. A gallery first, then decisions                        | no              | first         |

### The page's look

Cards, or one document with coloured rules and bands. Mockups in
[`SpecPage.stories.tsx`](/packages/web/src/SpecPage.stories.tsx). NN/g finds cards less scannable
than lists, and right for chunks of different kinds.

### Length

| Option                                         | Matches                   | Enforced          |
| ---------------------------------------------- | ------------------------- | ----------------- |
| A. A target, a warning, key scenarios, a split | the proposal              | `ura check` warns |
| B. Structure only, no number                   | the human's earlier words | no                |
| C. A hard limit                                | BMAD's pages              | `ura check` fails |

### What the spec keeps

| Option                                          | Spec length | Human sees               |
| ----------------------------------------------- | ----------- | ------------------------ |
| A. Details move to the plan, architecture stays | shorter     | the big picture          |
| B. Details stay, folded                         | as today    | everything, if opened    |
| C. A design file between spec and plan          | shorter     | a third file, unreviewed |

### The right column

| Option                                          | Pattern           |
| ----------------------------------------------- | ----------------- |
| A. An index with comment counts and the verdict | the round's index |
| B. Nothing: one column                          | today             |
| C. The decisions and their state                | log4brains        |

### Data models

| Option                                                   | Diagrams                |
| -------------------------------------------------------- | ----------------------- |
| A. Tables always, a diagram for relationships and states | when they add something |
| B. Tables and a diagram, always                          | always                  |
| C. As today                                              | none                    |

### Needs no choice

- **A summary first, and the approval state**: the block already opens the spec. Its first line
  becomes what is approved, as the proposal asks.
- **Alternatives, risks, non-goals**: alternatives live in the discovery and the decisions. Risks
  and what was left out go in the block, as the proposal asks.
- **Stable IDs**: US, SC, and Task IDs exist and stay.
- **A batch of comments**: the review already sends its comments as one review file.
- **Answers to the last review**: the human asked for them apart, in a card. Only their form is
  settled.
- **Writing rules**: the clarifications redesign chose a shared reference with warnings; this
  feature extends it.
- **The time estimate**: computed, one formula, from the clarifications redesign's.
- **Cuts the proposal lists**: the constitution check, "Relied on", "Why this priority", restated
  clarifications, UI strings, ruling IDs in records.
- **Decision links**: a link to a decision opens the branch's version, anchor kept, under every
  option.
- **The page jump and the frontmatter**: bugs, fixed under any scope that holds them.
- **Accessibility**: the diff marks changes with strike-through and underline, not colour alone.
- **Plans and rulings**: never reviewed; the plan drops what it copies from the spec.
- **Locales, time zones, offline, security**: nothing in this feature depends on them.

## Not checked

- Safari's scroll anchoring version: seen only in a secondary news article, not in Apple's release
  notes.
- Tessl's spec format, Devin's planning page, and Linear's spec guidance: their pages no longer
  describe them, or did not load.
- A reading-time figure for design documents, like code review's lines per hour: none found.
- Whether Astryx has an insertion or deletion style: not in its component list.
- The mockups take the branch's decision text from a constant, because the server reads decisions
  from the default branch only: the implementation reads it from the branch.
