// TEMPORARY: mockup of the feature page redesign (specs/2026-10-18-redesign-feature/), replaced by the real page.
// The states the mockup draws, as static data: what the core and the server would send.

/** A stage of the strip: its name, and the line under it once reached. */
export type MockStage = { label: string; line?: string };

/** What comes next, who acts, and the one button that acts on it. */
export type MockNext = {
  action?: string;
  line: string;
  title: string;
};

/** The feature's session, as its card shows it. */
export type MockAgent = {
  lastRun: string;
  progress?: { position: number; title: string; total: number };
  status: "working" | "idle";
  subagents?: number;
};

/** A figure's value: plain text, lines added and removed, or lines of their own. */
export type MockValue = string | { added: string; removed: string } | { lines: Array<string> };

/** A figure of what the feature produced, and where tapping it leads, when it has a detail. */
export type MockFigure = { caption: string; href?: string; label: string; value: MockValue };

/** A workflow file: its name for a person, its file, its step's icon, and its status. */
export type MockFile = {
  file: string;
  kind: "proposal" | "discovery" | "questions" | "spec" | "plan" | "done";
  name: string;
  status: string;
};

/** A problem: its file and line, and its message. */
export type MockProblem = { at: string; message: string };

/** The record of a done feature, drawn in place. */
export type MockRecord = {
  behaviour: Array<string>;
  decisions: Array<string>;
  followUps: Array<string>;
  questions: Array<{ answer: string; title: string }>;
  questionsLine: string;
  whatAndWhy: string;
};

/** Everything a feature page mockup draws. */
export type FeatureMock = {
  agent?: MockAgent;
  blocking?: Array<MockProblem>;
  current: number;
  figures: Array<MockFigure>;
  files?: Array<MockFile>;
  kind: "feature" | "change";
  line: string;
  next: MockNext;
  notes?: Array<MockProblem>;
  pullRequest?: number;
  record?: MockRecord;
  stages: Array<MockStage>;
  title: string;
};

const FEATURE_STAGES: Array<MockStage> = [
  { label: "Proposal", line: "10:52 · 26 min" },
  { label: "Questions", line: "11:18 · 53 min" },
  { label: "Spec", line: "12:11 · 2 h 50 min" },
  { label: "Plan", line: "15:01 · 7 min" },
  { label: "Build" },
  { label: "Pull request" },
  { label: "Merged" },
];

const LIVE_FIGURES: Array<MockFigure> = [
  {
    caption: "23 files",
    href: "#changes",
    label: "Lines changed",
    value: { added: "+1,204", removed: "−310" },
  },
  { caption: "cache reads left out", label: "Tokens", value: { lines: ["5.2 M in", "113 k out"] } },
];

const FILES: Array<MockFile> = [
  { file: "proposal.md", kind: "proposal", name: "Proposal", status: "committed" },
  { file: "discovery-01.md", kind: "discovery", name: "Discovery, round 01", status: "committed" },
  {
    file: "clarifications-01.md",
    kind: "questions",
    name: "Questions, round 01",
    status: "answered",
  },
  { file: "spec.md", kind: "spec", name: "Spec", status: "approved" },
  { file: "plan.md", kind: "plan", name: "Plan", status: "auto-approved" },
];

const NOTES: Array<MockProblem> = [
  { at: "plan.md:12", message: 'missing section "## Waves"' },
  { at: "spec.md:40", message: 'unknown section "## History"' },
  { at: "proposal.md:8", message: "link to a missing file: ../redesign-specs.md" },
];

const WORKING_AGENT: MockAgent = {
  lastRun: "Last run: Plan · done · 12 min",
  progress: { position: 7, title: "Session column", total: 11 },
  status: "working",
  subagents: 2,
};

const TITLE = "Redesign clarifications";
const LINE = "Feature · Oct 17 · branch 2026-10-17-redesign-clarifications";

/** The agent builds task 7 of 11. */
export const WORKING: FeatureMock = {
  agent: WORKING_AGENT,
  current: 4,
  figures: LIVE_FIGURES,
  files: FILES,
  kind: "feature",
  line: LINE,
  next: { line: "Task 7 of 11: Session column", title: "The agent is building" },
  notes: NOTES,
  stages: FEATURE_STAGES.map((stage, index) =>
    index === 4 ? { ...stage, line: "since 15:08" } : stage,
  ),
  title: TITLE,
};

/** The spec waits for the human's review. */
export const WAITING: FeatureMock = {
  agent: { lastRun: "Last run: Spec · done · 10 min", status: "idle" },
  current: 2,
  figures: [
    { caption: "spec only so far", label: "Lines changed", value: { added: "+0", removed: "−0" } },
    {
      caption: "cache reads left out",
      label: "Tokens",
      value: { lines: ["1.1 M in", "41 k out"] },
    },
  ],
  files: [
    ...FILES.slice(0, 3),
    { file: "spec.md", kind: "spec", name: "Spec", status: "awaiting-human" },
    { file: "plan.md", kind: "plan", name: "Plan", status: "not yet" },
  ],
  kind: "feature",
  line: LINE,
  next: {
    action: "Review the spec",
    line: "Spec to review, about 15 minutes.",
    title: "You review the spec",
  },
  notes: NOTES.slice(2),
  stages: FEATURE_STAGES.map((stage, index) =>
    index === 2 ? { ...stage, line: "since 12:11" } : index > 2 ? { label: stage.label } : stage,
  ),
  title: TITLE,
};

/** The pull request is open, with comments. */
export const PULL_REQUEST: FeatureMock = {
  agent: { lastRun: "Last run: Final review · done · 18 min", status: "idle" },
  current: 5,
  figures: LIVE_FIGURES,
  files: [
    {
      file: "2026-10-17-redesign-clarifications.md",
      kind: "done",
      name: "Record",
      status: "record",
    },
  ],
  kind: "feature",
  line: LINE,
  next: {
    action: "Open pull request #31",
    line: "Review it on GitHub. The session's recommended message sends the agent to its comments.",
    title: "Your review on pull request #31",
  },
  pullRequest: 31,
  stages: FEATURE_STAGES.map((stage, index) =>
    index === 4
      ? { ...stage, line: "15:08 · 6 h 55 min" }
      : index === 5
        ? { ...stage, line: "since Oct 18, 09:10" }
        : stage,
  ),
  title: TITLE,
};

/** A file the workflow cannot read: the step cannot be found. */
export const BLOCKED: FeatureMock = {
  ...WAITING,
  agent: { lastRun: "Last run: Spec · done · 10 min", status: "idle" },
  blocking: [{ at: "spec.md:3", message: 'unknown status "aproved"' }],
  next: {
    line: "Fix the file above: the workflow cannot tell what comes next.",
    title: "Nothing can go on",
  },
  notes: undefined,
};

const CLARIFICATIONS_RECORD: MockRecord = {
  behaviour: [
    "A round opens with the counts and the time, then a verdict, with at most 7 items.",
    "Each question is a card, with a muted “Why it matters” box after its context.",
    "Settled points show under “Settled without you”, in three groups, the last one folded.",
    "A mermaid code block draws as a diagram, in a frame without scripts.",
  ],
  decisions: [
    "New: Diagrams. Flows and states are Mermaid code blocks, drawn by the UI.",
    "New: Compatibility. Before 1.0, formats change without keeping the old ones working.",
  ],
  followUps: [
    "Proposal links to files on other branches read as errors: noted in the inbox.",
    "Keyboard navigation between question cards: left for later.",
  ],
  questions: [
    { answer: "A: one card per question.", title: "Q1: How should a question read on the page?" },
    { answer: "B: Mermaid, drawn in a frame.", title: "Q2: How should flows be drawn?" },
  ],
  questionsLine: "Questions · 10 in 1 round",
  whatAndWhy:
    "Rounds of questions had grown long and read as a flat list. You asked for a round that is quick to read once, top to bottom, with a verdict first and each question as a card.",
};

/** The clarifications redesign, merged. */
export const DONE: FeatureMock = {
  current: 7,
  figures: [
    { caption: "10:52 to 22:03", href: "#stages", label: "Total time", value: "11 h 11 min" },
    {
      caption: "113 files",
      href: "https://github.com/mrtolkien/uraeda/pull/30/files",
      label: "Lines changed",
      value: { added: "+6,633", removed: "−1,455" },
    },
    {
      caption: "cache reads left out",
      label: "Tokens",
      value: { lines: ["5.2 M in", "113 k out"] },
    },
    { caption: "1 round", href: "#questions", label: "Questions", value: "10" },
    { caption: "new or changed", href: "#decisions", label: "Decisions", value: "2" },
  ],
  kind: "feature",
  line: "Feature · Oct 17 · pull request #30",
  next: { line: "On Oct 17, in pull request #30.", title: "Merged" },
  pullRequest: 30,
  record: CLARIFICATIONS_RECORD,
  stages: [
    ...FEATURE_STAGES.slice(0, 4),
    { label: "Build", line: "15:08 · 6 h 55 min" },
    { label: "Pull request", line: "22:03 · 6 min" },
    { label: "Merged", line: "22:09" },
  ],
  title: TITLE,
};

/** A change, merged before tokens were recorded. */
export const DONE_CHANGE: FeatureMock = {
  current: 4,
  figures: [
    { caption: "15:40 to 16:13", href: "#stages", label: "Total time", value: "33 min" },
    {
      caption: "7 files",
      href: "https://github.com/mrtolkien/uraeda/pull/28/files",
      label: "Lines changed",
      value: { added: "+487", removed: "−9" },
    },
    { caption: "before Oct 19", label: "Tokens", value: "Not recorded" },
  ],
  kind: "change",
  line: "Change · Oct 17 · pull request #28",
  next: { line: "On Oct 17, in pull request #28.", title: "Merged" },
  pullRequest: 28,
  record: {
    behaviour: [
      "A worktree links the main checkout's ignored folders, like node_modules, instead of copying them.",
      "A link that would point outside the repository is refused, and named in the error.",
    ],
    decisions: [],
    followUps: ["The commit hook type-checks root files without Node's types: noted in the inbox."],
    questions: [],
    questionsLine: "",
    whatAndWhy:
      "New worktrees took minutes to set up, copying folders the main checkout already had.",
  },
  stages: [
    { label: "Proposal", line: "15:40 · 4 min" },
    { label: "Fix", line: "15:44 · 22 min" },
    { label: "Pull request", line: "16:06 · 7 min" },
    { label: "Merged", line: "16:13" },
  ],
  title: "Symlinks",
};
