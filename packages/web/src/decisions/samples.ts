// The literal props of the decisions page's stories, taken from this repository's own
// `specs/CONSTITUTION.md` and `specs/decisions/*.md` on 2026-10-16, with each decision's last change
// from `git log -1 --format=%cs`. Links and code marks are written as plain text.
import type { Constitution, DecisionDocument, DecisionSummary } from "./model.ts";

export const CONSTITUTION: Constitution = {
  principles: [
    {
      numeral: "I",
      rationale:
        "Uraeda exists so agents cannot make consequential choices without the human knowing.",
      rules: [
        "Agents MUST stay within the scope and decisions a human approved.",
        "Agents MUST NOT activate a decision unless a human explicitly asks them to, for example by approving the spec that lists it. Only a human can override an active decision.",
        "Conflicts with active decisions or with this constitution MUST be resolved explicitly by a human.",
      ],
      title: "Humans stay in control",
    },
    {
      numeral: "II",
      rationale:
        "git gives history, review, and traceability for free, and plain text works with every agent and editor.",
      rules: [
        "Workflow state, decisions, and design changes MUST be stored as plain text in git. Exceptions MUST be justified in a decision.",
        "Workflow artifacts MUST stay readable and editable without uraeda tools.",
      ],
      title: "Git and plain text first",
    },
    {
      numeral: "III",
      rationale:
        "humans answer when they have time and agents run when triggered. Neither should wait for the other.",
      rules: [
        "Every workflow step MUST be completable with a git commit, without a live chat session.",
        "Durable workflow state MUST be recoverable from the repository alone. Only temporary chat state and caches MAY live in memory.",
        "Work MUST be resumable by a different agent or session than the one that started it.",
      ],
      title: "Asynchronous by default",
    },
    {
      numeral: "IV",
      rationale: "human attention is the scarcest resource in the workflow.",
      rules: [
        "Documents written for human review MUST explain needs and tradeoffs in terms the reader understands.",
        "Every question asked to a human MUST come with a recommended answer.",
        "Agents SHOULD settle implementation details within the approved spec without asking.",
      ],
      title: "Review effort matches impact",
    },
    {
      numeral: "V",
      rationale:
        "the workflow is the product. Tools make it faster and safer, but must never be the only way to follow it.",
      rules: [
        "A coding agent with no uraeda-specific instructions MUST be able to navigate the specs/ folder through clear file names and contents. specs/README.md MUST explain the folder layout and link to the Uraeda skill.",
        "The workflow MUST work with any agent, with or without the uraeda CLI, web UI, or remote workers.",
        "Tools MUST only enforce rules that humans and agents can follow unaided.",
        "Uraeda MUST ship a template or skill for every artifact, and tools MUST validate artifacts whatever produced them.",
      ],
      title: "Tools are optional",
    },
    {
      numeral: "VI",
      rationale:
        '"high-quality code" cannot be checked, but acceptance tests, justified complexity, and checks that never go back can. Agents grow and copy code feature after feature unless something measured stops them.',
      rules: [
        "Implementations MUST include tests covering the spec's acceptance scenarios.",
        "Code SHOULD stay explicit and simple. New abstractions MUST be justified in the plan's complexity tracking.",
        "Each rule MUST live in one place. A copy in another layer or language MUST be justified in the plan's complexity tracking.",
        "Warnings, size, complexity, and duplication measured by the project's checks MUST NOT go up. An exception MUST be approved by a human in the spec or plan.",
      ],
      title: "Code is checked and stays maintainable",
    },
  ],
  version: "Version 1.3.1 · Ratified 2026-10-07 · Last amended 2026-10-14",
};

export const DECISIONS: Array<DecisionSummary> = [
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-14",
    slug: "agents",
    status: "active",
    subtitle:
      "Uraeda's server runs coding agents by starting the agent's own command-line tool, installed on the machine and signed in by the user, never through a bundled binary or Claude's SDK.",
    title: "Agents",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "attachments",
    status: "active",
    subtitle:
      "Images a human attaches to a workflow file are committed to the repository, as WebP files in an images/ folder next to the file that links to them, and leave the default branch with their folder when the feature finishes.",
    title: "Attachments",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "cli",
    status: "active",
    subtitle:
      "The ura CLI is a fast path through the workflow, never the only one: every rule it follows or checks is written in the skill, and every action it offers can be done by hand.",
    title: "CLI",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-14",
    slug: "code-quality",
    status: "active",
    subtitle: "Size and nesting limits hold Uraeda's Rust and TypeScript code.",
    title: "Code quality",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "distribution",
    status: "active",
    subtitle:
      "The web UI and its server ship as one npm package, @uraeda/ui, which users run with npx @uraeda/ui on their own Node.",
    title: "Distribution",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-16",
    slug: "git",
    status: "active",
    subtitle:
      "Uraeda's Rust tools read git with gix, the pure Rust implementation, inside the binary, and run the system git binary for every write.",
    title: "Git",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-16",
    slug: "preview",
    status: "active",
    subtitle:
      "Uraeda's UI states and the mockups of its planned UI are Storybook stories, written with its real components next to them in packages/web/src.",
    title: "Preview",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-14",
    slug: "repositories",
    status: "active",
    subtitle:
      "One Uraeda server serves every repository the human added, from a plain-text list in Uraeda's data folder that the CLI and the server both read and write through the core.",
    title: "Repositories",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-16",
    slug: "stack",
    status: "active",
    subtitle: "Uraeda's workflow logic is written once, in Rust, in a core crate.",
    title: "Stack",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "toolchain",
    status: "active",
    subtitle:
      "One command, vp run ready, runs every format check, lint, type check, test, and build of the repository, as a graph of cached Vite Task tasks: it only reruns the checks whose inputs changed, and runs independent ones in parallel.",
    title: "Toolchain",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-13",
    slug: "tui",
    status: "active",
    subtitle:
      "Every interactive screen of ura, from a one-question picker to the planned answer and review screens, is drawn with ratatui, on its crossterm backend.",
    title: "TUI",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "ui-behaviour",
    status: "active",
    subtitle:
      "The web UI acts on things where they are: a row is tapped as a whole, a small edit happens in place, and status shows next to what it is about.",
    title: "UI behaviour",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-16",
    slug: "ui-checks",
    status: "active",
    subtitle: "UI work is checked by what it does, not by how its markup looks.",
    title: "UI checks",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-13",
    slug: "ui-components",
    status: "active",
    subtitle:
      "The web UI is built from Astryx components wherever one exists, and the few styles of its own are written in StyleX, next to the component that uses them, with Astryx's tokens only.",
    title: "UI components",
  },
  {
    approvedBy: "mrtolkien",
    changed: "2026-10-15",
    slug: "ui-layout",
    status: "active",
    subtitle:
      "Every layout choice in the web UI serves one goal first: the human reads and understands what is on screen.",
    title: "UI layout",
  },
];

/** The "UI behaviour" decision's content, past its title. */
export const UI_BEHAVIOUR: DecisionDocument = {
  sections: [
    {
      bullets: [
        "A row that leads somewhere MUST be tappable as a whole, not only through a button or a chevron.",
        "A small edit, like a line's text, MUST happen in place: Enter or its Save button saves, Escape or its Cancel button cancels. Leaving the field MUST NOT save it: it stays open with its text.",
        "A text field MUST save only when the human presses its Save button, its own key (Enter in a one-line field, Ctrl+Enter or Cmd+Enter in a multi-line one), or a button that uses its text, like Add comment, Submit, Commit, Start, or a verdict. It MUST NOT save as it is typed, after a pause, or when it loses the focus. Adding an image to a field MAY save that field at once, with its text as typed. Toggles, switches, segmented controls, and option picks MAY save at once.",
        'A text field whose text differs from what is saved MUST say "Unsaved changes" next to its Save button. Its Save button MUST be disabled while nothing changed.',
        'Cancel or Escape on a field whose text changed MUST ask first, with "Discard" and "Keep editing".',
        'Leaving a page that holds unsaved text MUST ask first: the app\'s own dialog, "Leave page" and "Stay", for a link or Back, and the browser\'s prompt for a reload or a closed tab. Nothing MUST ask when nothing is unsaved.',
        "The unsaved text of every field MUST be kept in the browser until it is saved or discarded, and restored when the field shows again, with a notice saying so and a Discard button.",
        "Every multi-line text field MUST have a fixed height, set by what it holds, a little larger than its usual text, and the same wherever that kind of field appears: 20 rows for the editor of drafts and proposals, 12 for notes, 7 for every comment and summary, 4 for the chat composer, and 3 for a line that may wrap. A field MUST NOT grow or shrink with its text: past its height, it scrolls. It MAY keep the browser's resize handle, for the human to drag it taller. Every multi-line field except the chat composer MUST use the app's one text area.",
        "A modal sheet or dialog MUST be used only to confirm an irreversible action or to fill a short form, like adding a line. Everything else happens in the page.",
        "Every sheet and dialog MUST have a visible close button, and Back MUST close it.",
        "A save's status MUST show next to its control: saving, saved, or the error.",
        "A toast MAY confirm only a result the human cannot see on screen. It MUST last 5 seconds, MAY carry one action, Undo, which reverts that change alone, and MUST NOT be the only place an error shows.",
        "Errors MUST stay on screen until the human deals with them, or the action is retried.",
        "Back MUST return to the same scroll position and the same open items. A page MUST keep showing its content while its data reloads.",
        "Nothing MUST work only on hover: every action has a tap or a keyboard path.",
        "A keyboard shortcut MUST NOT act while a text field has the focus. A field's own keys, Enter and Ctrl+Enter or Cmd+Enter, are not shortcuts.",
      ],
      heading: "Rules",
    },
    {
      heading: "Why",
      paragraphs: [
        "The proposal's problems are behaviour as much as looks: a one-word edit behind a modal, a confirmation taking the top bar's place, a reading position lost on Back (proposal). Design systems answer each with a rule: modals only when needed (NN/g, Atlassian), status inline and short toasts (Pajamas), a visible close and Back on sheets (NN/g), state that survives navigation (Vercel) (Q3, how the UI behaves).",
        "Text is saved only on a button: notes saved as they were typed lost letters, because each save came back trimmed into the field, and a line saved on blur saves half-typed text; the human asked for every text field to save only with a button, lines on Enter or a Save button (Q1, which fields), and Primer recommends explicit saving for text. Saving on a button puts unsaved text at risk, so the human asked for both a warning before leaving and text kept in the browser, like GitHub (Q3, unsaved text). Images keep saving their field at once, so an image and its link are never apart (Q6). The human found text boxes taller than their text, asked for one coherent behaviour everywhere (notes), and then for fixed heights by kind of field, since fields that grow move the page's layout as the human types (the review of the spec).",
      ],
    },
    {
      bullets: [
        "The same rules with no toasts at all, as Primer advises for accessibility: confirmations from another page then have nowhere to show, and Undo no place to live.",
        "Text areas growing with their text, measured, up to half the window: no empty rows, but the page moves under the human as they type.",
        "Lines saving on Enter or blur, the earlier rule: a tap elsewhere saved a half-typed line.",
        "Notes and the editor saving 400 ms after the last keystroke: the field took the file's trimmed text back while the human typed.",
      ],
      heading: "Alternatives considered",
    },
    {
      bullets: [
        'Undo in a toast goes against Pajamas\' "no actions in toasts"; it is limited to the change just made, and Discard still covers every uncommitted change.',
        "Every page needs its own scroll restoration once its data has drawn, through the shared router.",
        "Short forms may still be modal, which keeps ＋ quick to reach on any width.",
        "Every field that saves text goes through one shared hook, which holds its unsaved text, keeps it in the browser, and tells the router whether a page may be left.",
        "A line left open stays open until it is saved or cancelled.",
        "Text typed on one device is restored on that device only.",
      ],
      heading: "Consequences",
    },
    {
      bullets: ["packages/web/, and every feature that adds or changes a view"],
      heading: "Applies to",
    },
  ],
  summary:
    "The web UI acts on things where they are: a row is tapped as a whole, a small edit happens in place, and status shows next to what it is about. Overlays are kept for short forms and for confirming what cannot be undone, a toast confirms only what cannot be seen, and leaving a page and coming back keeps the human's place. Text is saved only by a button or the field's own key, unsaved text is kept in the browser and never left without asking, and every multi-line field has a fixed height.",
};
