# Discovery, round 01: Onboarding + README pass

## Summary

The proposal asks for three things that serve one goal, making Uraeda easy for a human to start
with: a short, appealing README; an onboarding in the web UI that shows which core workflow files a
project lacks; and a "Set up project with agent" button on Home that opens a session with a
pre-filled message.

Comparable tools keep their README to a pitch, a visual, a few install commands, and a link to the
docs. Workflow tools such as superpowers, Spec Kit, and BMAD add a walkthrough of their process.
Products that check a project's setup show a list of files with "added" or "missing", each missing
one leading to an action. Products that set a project up with an agent pre-fill a short prompt that
the human reviews before sending, and point the agent at instructions it already has.

Today, the README is 3,515 words and holds most of Uraeda's documentation: install, settings,
sign-in, completions, building from source. Nothing in the code computes whether a project is set
up, beyond the absence of `specs/`, which Home answers with a warning banner saying to run
`ura init`. No route opens a new chat with an unsent, pre-filled message, though feature hand-overs
and the New page already pre-fill their composer.

## How other products do it

### READMEs of comparable tools

Read on 2026-10-30 through the GitHub API; word counts include markup.

| Project                                                             | Words | Hero                                     | Order                                                       |
| ------------------------------------------------------------------- | ----- | ---------------------------------------- | ----------------------------------------------------------- |
| [anthropics/claude-code](https://github.com/anthropics/claude-code) | 309   | badges, demo GIF                         | one paragraph, install, link to docs                        |
| [openai/codex](https://github.com/openai/codex)                     | 375   | one-liner, splash image                  | one-liner, quickstart, docs link                            |
| [anomalyco/opencode](https://github.com/anomalyco/opencode)         | 456   | logo in `<picture>`, light and dark SVGs | tagline, install, docs link                                 |
| [BMAD-METHOD](https://github.com/bmad-code-org/BMAD-METHOD)         | 989   | banner image, loop diagram               | tagline, diagram, install, docs links                       |
| [astral-sh/uv](https://github.com/astral-sh/uv)                     | 1,080 | benchmark chart in `<picture>`           | one-liner, highlights, install, docs                        |
| [github/spec-kit](https://github.com/github/spec-kit)               | 1,364 | centred logo, tagline, badges            | tagline, "choose your process" table, get started, docs     |
| [obra/superpowers](https://github.com/obra/superpowers)             | 1,961 | none                                     | one sentence, how it works, install per harness, philosophy |
| [oven-sh/bun](https://github.com/oven-sh/bun)                       | 2,064 | centred logo, link row                   | what it is, install, link index to docs                     |

- The shortest READMEs are a pitch, an install, and a docs link. Workflow tools run 1,000 to 2,000
  words, mostly a walkthrough of their process and per-agent install.
- Spec Kit and BMAD, the closest to Uraeda, explain the process with a table or a diagram, not
  prose.

### Products that check a project's setup

- **GitHub's community standards**
  ([docs](https://docs.github.com/en/communities/setting-up-your-project-for-healthy-contributions/about-community-profiles-for-public-repositories)):
  a checklist of recommended files (README, code of conduct, license, contributing, issue
  templates), each "Added" or "Not added yet". A missing one has an **Add** button that opens a
  draft of the file. It cannot be dismissed: rows change as files appear.
- **Renovate's onboarding pull request**
  ([docs](https://docs.renovatebot.com/getting-started/installing-onboarding/)): enabling Renovate
  opens a pull request adding its config, and nothing else happens until it is merged. Closing it
  opts out.
- **GitHub Copilot's cloud agent**
  ([docs](https://docs.github.com/en/copilot/how-tos/configure-custom-instructions/add-repository-instructions)):
  the first pull request comments with a link to generate `.github/copilot-instructions.md`. The
  published prompt asks the agent to "onboard" the repository and inventory the codebase; the result
  is a draft pull request.
- **Backstage Tech Insights**
  ([README](https://github.com/backstage/community-plugins/blob/main/workspaces/tech-insights/plugins/tech-insights/README.md)):
  scorecards of boolean checks per entity, with an option to show only failing ones.

### Products that set a project up with an agent

- **Claude Code's `/init`** ([docs](https://code.claude.com/docs/en/memory)) analyses the code and
  writes `CLAUDE.md`. "If a CLAUDE.md already exists, `/init` suggests improvements rather than
  overwriting it." Its newer interactive mode asks follow-up questions and "presents a reviewable
  proposal before writing any files".
- **Spec Kit**: `specify init`, then `/speckit-constitution` with the user's principles
  ([README](https://github.com/github/spec-kit)). The command fills every placeholder of the
  constitution template, and asks only when something is unknown
  ([command](https://raw.githubusercontent.com/github/spec-kit/main/templates/commands/constitution.md)).
  Its guide for existing projects warns: "Do not invent standards merely to fill the constitution
  template" ([guide](https://github.github.com/spec-kit/guides/existing-projects.html)).
- **Kiro**: a **Generate Steering Docs** button writes `product.md`, `tech.md`, and `structure.md`
  ([docs](https://kiro.dev/docs/steering/)). Its docs do not say whether it asks first.
- **OpenAI Codex**: `/init` generates an `AGENTS.md` scaffold
  ([docs](https://learn.chatgpt.com/docs/developer-commands?surface=cli)).
- **VS Code's Copilot**: a button "start[s] a chat that analyzes your repository and creates
  instructions", which "might be incomplete" and must be verified
  ([docs](https://code.visualstudio.com/docs/copilot/customization/custom-instructions)).
- **Vercel** leads its getting-started page with a copyable agent prompt, "Help me get set up with
  Vercel…" ([docs](https://vercel.com/docs/getting-started-with-vercel)). **Netlify** offers an
  editable starter prompt and a **Build now** button
  ([docs](https://docs.netlify.com/start/quickstarts/create-new-project-with-ai-agent/)).
- **Claude Code's deep links** pre-fill a prompt that is "populated but not sent until you press
  Enter", and warn when it is long, "since long prompts can push instructions off screen". The docs
  advise naming a skill in the prompt rather than inlining a runbook
  ([docs](https://code.claude.com/docs/en/deep-links)). Cursor's links never run on their own either
  ([docs](https://cursor.com/docs/integrations/deeplinks)).

### What they have in common

- A setup check lists files by name, with a state, and links each missing one to an action.
- The check goes away as files appear, rather than through a dismiss button.
- Setup by an agent pre-fills a short prompt, never sent unseen, which points at instructions the
  agent already has.
- The agent never overwrites an existing file without asking, and asks rather than inventing what it
  does not know.
- The result can be reviewed before it lands: a pull request, a diff, or a proposal.

## Standards and libraries

### README guidance

- GitHub: a README covers what the project does, why it is useful, how to get started, where to get
  help. "A README should only contain information necessary for developers to get started using and
  contributing to your project"; longer docs belong elsewhere. GitHub builds an outline from the
  headings, and truncates past 500 KiB
  ([docs](https://docs.github.com/en/repositories/managing-your-repositorys-settings-and-features/customizing-your-repository/about-readmes)).
- Art of README: "The ideal README is as short as it can be without being any shorter. Detailed
  documentation is good -- make separate pages for it!" The broadest details go first
  ([fork of the original, which is gone](https://github.com/bradparks/art-of-readme)).
- standard-readme: the banner sits right after the title, without a heading, as a local image
  ([spec](https://github.com/RichardLitt/standard-readme/blob/main/spec.md)).
- Alt text includes any text in the image
  ([GitHub blog](https://github.blog/developer-skills/github/5-tips-for-making-your-github-profile-page-accessible/)).

### SVG images in a GitHub README

- A relative image renders as an `<img>` served from `raw.githubusercontent.com`, with
  `content-security-policy: default-src 'none'; style-src 'unsafe-inline'; sandbox` (checked with
  `curl -I` on 2026-10-30). Inline `<svg>` and `<style>` in the README are stripped
  ([github/markup](https://github.com/github/markup)).
- An SVG shown as an image runs no script and loads no external resource, fonts included
  ([MDN](https://developer.mozilla.org/en-US/docs/Web/SVG/Guides/SVG_as_an_image)). Declarative
  animation, CSS `@keyframes`, still plays
  ([W3C SVG integration](https://www.w3.org/TR/svg-integration/)); Aider's README hero is an
  animated SVG ([file](https://aider.chat/assets/screencast.svg)). Text must be drawn as shapes to
  look the same everywhere.
- Light and dark: GitHub documents `<picture>` with a
  `<source media="(prefers-color-scheme: dark)">`
  ([quickstart](https://docs.github.com/en/get-started/writing-on-github/getting-started-with-writing-and-formatting-on-github/quickstart-for-writing-on-github)).
  The `#gh-dark-mode-only` fragment was dropped from the docs in January 2025
  ([commit](https://github.com/github/docs/commit/2f8656e498445ced902433aa4976c99871a776bf)). A
  media query inside the SVG follows GitHub's theme in Chrome and Firefox, but Safari follows the
  system's ([WebKit bug 316640](https://bugs.webkit.org/show_bug.cgi?id=316640)).
- npm renders a package's README through GitHub's API
  ([docs](https://docs.npmjs.com/about-package-readme-files)); relative images reportedly break
  there (community reports, not checked: npmjs.com refused the fetch). The npm package `@uraeda/ui`
  ships its own [README](/packages/uraeda/README.md), not the root one, and the crates are not
  published (`publish = false`), so only GitHub shows the root README.

### Claude Code

- Installed with `curl -fsSL https://claude.ai/install.sh | bash`, Homebrew, WinGet, or Linux
  package repositories; npm is deprecated. It "requires a Pro, Max, Team, Enterprise, or Console
  account. The free claude.ai plan does not include Claude Code access"
  ([setup](https://code.claude.com/docs/en/setup)).
- Skills live in `~/.claude/skills/` or `.claude/skills/`, and follow the Agent Skills standard
  ([skills](https://code.claude.com/docs/en/skills)). Plugins install from a marketplace,
  `/plugin marketplace add owner/repo`, which needs a `marketplace.json` in that repository
  ([plugins](https://code.claude.com/docs/en/discover-plugins)).
- `npx skills add owner/repo` installs a skill for "OpenCode, Claude Code, Codex, Cursor, and 75
  more" ([vercel-labs/skills](https://github.com/vercel-labs/skills)). The Agent Skills showcase
  lists 46 clients, among them Codex, Gemini CLI, Cursor, GitHub Copilot, and OpenCode
  ([clients](https://github.com/agentskills/agentskills/blob/main/docs/snippets/clients.jsx)).

### Onboarding and empty-state guidance

- NN/g: an empty state says what could be shown and how to fill it, with "direct pathways (i.e.,
  links) to getting started"
  ([empty states](https://www.nngroup.com/articles/empty-state-interface-design/)). Pushed tutorials
  "interrupt users … and are quickly forgotten"
  ([onboarding](https://www.nngroup.com/articles/onboarding-tutorials/)).
- Primer: one primary action in an empty state
  ([blankslate](https://primer.style/product/components/blankslate/guidelines/)). Banners are rare,
  one per page, with at most two actions; a banner that hides something critical is not dismissible
  ([banner](https://primer.style/product/components/banner/guidelines/)).
- WCAG 4.1.3: a change of state that does not move focus is announced as a polite status
  ([status messages](https://www.w3.org/WAI/WCAG21/Understanding/status-messages.html)).

### Known pitfalls of a pre-filled agent prompt

- Overwriting: Spec Kit's constitution command overwrites the file, and its `init --force` replaces
  files ([upgrade](https://github.github.com/spec-kit/upgrade.html)).
- Invented content: agents fill templates with standards nobody chose (Spec Kit's guide, above).
- Cost: broad requests "trigger broad scanning", and usage scales with context
  ([costs](https://code.claude.com/docs/en/costs)).
- Instruction files are agent instructions too: hidden Unicode in rule files has been used to steer
  agents (Pillar Security's "Rules File Backdoor", seen in
  [a news report](https://thehackernews.com/2025/03/new-rules-file-backdoor-attack-lets.html) only).

## The code

### Important reads

- [`README.md`](/README.md): 3,515 words, 11 sections. About two thirds is reference: install
  methods, Tab completion, the web UI's flags, sign-in, the settings file, proxies, `devEngines`,
  the CLI's commands, building from source, the data folder, licenses of bundled fonts.
- [`packages/web/src/Home.tsx`](/packages/web/src/Home.tsx): without `specs/` it renders only
  `NoSpecs`; otherwise the drop notes, then `HomeHub`.
- [`packages/web/src/home/HomeHub.tsx`](/packages/web/src/home/HomeHub.tsx) and
  [`home/Core.tsx`](/packages/web/src/home/Core.tsx): the core panes (Problems, Needs you, In
  progress, Sessions), then Inbox and Priorities now. Empty panes disappear
  ([look and feel](/specs/ui/look-and-feel.md)).
- [`packages/web/src/layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx): `NoSpecs`, a
  warning banner "No specs/ folder in …. Set Uraeda up with ura init.", with no button. The
  Decisions page shows it too.
- [`crates/core/src/api.rs`](/crates/core/src/api.rs) `read_workspace`: returns `no_specs` when the
  folder is missing. It is the only readiness signal.
- [`crates/core/src/actions/init.rs`](/crates/core/src/actions/init.rs): copies the README,
  constitution, priorities, and inbox templates, and creates four folders, never overwriting.
- [`crates/core/src/api/ledger.rs`](/crates/core/src/api/ledger.rs): parses the constitution's
  title, version, and principles; `None` without the file. Nothing reads `testing.md` or
  `code-quality.md`; only [`api/preview.rs`](/crates/core/src/api/preview.rs) reads `preview.md`.
- [`crates/core/src/embedded.rs`](/crates/core/src/embedded.rs) `is_placeholder`: a paragraph in
  brackets is a template's placeholder. The constitution template's title is
  `# [Project] Constitution`, its first two principles `[Principle name]`, its dates `[YYYY-MM-DD]`
  ([template](/skills/uraeda/assets/templates/specs/CONSTITUTION.md)).
- [`skills/uraeda/references/projects.md`](/skills/uraeda/references/projects.md#setting-up-a-project):
  setting a project up is the skill's: templates, then the constitution written with the human, then
  code-quality, testing, and, for a project with a UI, preview decisions, each `proposed` until
  approved. The skill has templates for testing and preview, none for code quality.
- [`packages/server/src/runner/round-messages.ts`](/packages/server/src/runner/round-messages.ts):
  the messages of chats outside a feature (organize the inbox, the decisions check), each starting
  `/uraeda`. No setup message exists.
- [`packages/web/src/StartChat.tsx`](/packages/web/src/StartChat.tsx): those chats are sent at once
  and open the session. Without the agent, `MessageToCopy` shows the message with a copy button.
- [`packages/web/src/NewPage.tsx`](/packages/web/src/NewPage.tsx): the New page's composer accepts
  an inserted text on arrival, the path a proposal's Start uses.
- [`packages/server/src/runner/claude.ts`](/packages/server/src/runner/claude.ts): the agent is
  "available" when `claude --version` answers. Nothing checks that it is signed in.
- [`packages/web/src/Logo.tsx`](/packages/web/src/Logo.tsx) and
  [`public/favicon.svg`](/packages/web/public/favicon.svg): the logo is a tree of 34 dots on an 8 ×
  8 grid, in the theme's green (`#40a02b` in the favicon). No other brand asset exists.

### The proposal's path and existing actions

1. **A human reads the README** on GitHub. Today they meet the pitch, then a long reference.
2. **They install** `ura`, the web UI, and Claude Code. Claude Code's install is not in the README
   today: only "sessions need `claude` installed and signed in".
3. **They add a repository** in the web UI. A repository without `specs/` is accepted, and Home
   shows `NoSpecs`. A repository after `ura init` shows Home as if ready, with an unwritten
   constitution.
4. **They press "Set up project with agent"**. Nothing exists. The New page's composer, or a chat
   started at once, are the two existing paths.
5. **The agent sets the project up**, following the skill. It runs in the main checkout, as every
   chat does ([`runner/sessions.ts`](/packages/server/src/runner/sessions.ts) `newChat`), and
   commits on the default branch, as `ura init` writes.
6. **The onboarding updates** as files land: Home already re-reads the workspace when files change
   ([`crates/core/src/watch.rs`](/crates/core/src/watch.rs)).

Existing actions it meets:

- **Removing a repository** from Uraeda: unchanged.
- **The Decisions page** shows "No constitution yet." and "No decisions yet." as empty states: they
  stay.
- **Without `claude`**: chats are refused, and pages show the message to copy instead.
- **An unwritten constitution** reads as a constitution titled "[Project] Constitution" on the
  Decisions page today.

Features in flight:

- [Performance pass](/specs/2026-10-29-performance-pass/) (branch `2026-10-29-performance-pass`):
  its approved plan changes the session start and the composer's pre-fill (`HandOver.tsx`,
  `NewChangePage.tsx`, `useStartFrom.ts`, `session.send`) and caches `read_workspace`. The setup
  button builds on both.
- [Review home](/specs/proposals/review-home.md), a proposal not yet in the priorities: a better
  balanced Home at every width. Both place things on Home.
- [Feature state pass](/specs/proposals/feature-state-pass/proposal.md), in Now: the states behind
  Needs you and In progress. No overlap with setup.

### Rules and their owners

- **What a set-up project has**: owned by the skill,
  [Setting up a project](/skills/uraeda/references/projects.md#setting-up-a-project); copied in part
  by `actions::init` (the templates and folders) and by `ura init`'s closing hint. A readiness check
  would be a third copy, in the core, as the [stack](/specs/decisions/stack.md) decision puts logic.
- **What Home shows**: [Problems](/specs/decisions/problems.md) says "Home and the sidebar's cards
  MUST show problems only", about check results on feature cards; a setup list is not a check
  result.
- **No agent started unseen**: [flows](/specs/ui/flows.md) and the [UI guides](/specs/ui/README.md).

### Likely changes

Under every option:

- [`README.md`](/README.md): rewritten.
- A banner SVG, light and dark, next to it.
- [`crates/core/`](/crates/core/): a readiness function, exposed in the workspace view.
- [`packages/server/src/runner/round-messages.ts`](/packages/server/src/runner/round-messages.ts):
  the setup message.
- [`packages/web/src/Home.tsx`](/packages/web/src/Home.tsx), `home/`, and
  [`layout/Missing.tsx`](/packages/web/src/layout/Missing.tsx): the onboarding and the button.
- The sandbox's [sample projects](/packages/web/samples/projects.ts): `empty` and `broken` already
  have an unwritten constitution; none lacks `specs/`.
- [`skills/uraeda/references/projects.md`](/skills/uraeda/references/projects.md): only if the
  setup's order or files change.

With option A of [the README's reference](#the-readmes-reference): new pages under `docs/`, and a
`CONTRIBUTING.md`. With option B of [installing the skill](#installing-the-skill-for-claude-code): a
`.claude-plugin/marketplace.json` at the root, and the
[distribution](/specs/decisions/distribution.md) decision. With option A of [the CLI](#the-cli):
[`crates/cli/src/`](/crates/cli/src/) `status`.

Tests that guard behaviour the feature changes:

- `packages/server/src/__tests__/server.test.ts`, "starting in a repository without specs/ adds it,
  given: %s": asserts `noSpecs`; kept, unless the no-specs view changes shape.
- `crates/cli/tests/status.rs`, `no_specs_folder`: kept.
- `packages/web/src/__tests__/keys-pages.test.tsx`, "US3: `a` on Home opens the New page, as its
  button does": kept.

## The proposal

### "Relies on a local Claude Code install ONLY"

The workflow is a skill that works with any agent that reads Agent Skills, and the constitution says
it MUST ([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)). Only the web UI's sessions
need Claude Code ([agents](/specs/decisions/agents.md)). Read literally, the sentence would tell
readers the whole of Uraeda needs Claude Code.

### "Missing core files" is not defined

The proposal names the constitution and the testing decision, and ends with "...". The skill's setup
names four: the constitution, then code-quality, testing, and preview decisions, the last for a
project with a UI only. Nothing in a project says whether it has a UI.

### "Not ready to be used with Uraeda"

A project with no `specs/` at all, and a project after `ura init` with the unwritten template, are
both not ready, but differ: the first lacks even the folder Home reads.

### The README's long reference

The proposal wants a short README. About two thirds of today's README is reference with no other
home. Cutting it needs a place for it. A docs website is in the priorities' Next.

### The banner

"A small SVG banner" with the logo. GitHub loads no font in an SVG, and Safari mismatches a theme
read inside it.

## Worth it and feasibility

- **Worth it**: the README is the first thing a visitor reads, and today they meet a reference
  before knowing how to start. A project set up by `ura init` alone looks ready on Home while its
  constitution is a template. The cost is small: a core function over files already parsed, one
  message, one Home element, and a rewrite of a document.
- **Outside behaviour relied on**: SVG rendering on GitHub, checked by its headers and documents
  above. Claude Code reading a pre-filled message is the existing hand-over. The agent's setup
  quality rests on the skill's [projects](/skills/uraeda/references/projects.md) reference,
  unchanged.
- **Guards**: none relaxed. The button pre-fills; the human sends.

## Approaches

Criteria: a README short and appealing to a human (the proposal); the workflow first, then the CLI,
then the web UI (the proposal); every tool optional
([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)); one home per rule
([principle III](/specs/CONSTITUTION.md)); no agent started unseen ([flows](/specs/ui/flows.md)).

### The README's reference

Where the install details, settings, sign-in, and build instructions go once the README is short.

| Option                                                        | README length (estimate) | Reference kept | Upkeep                                    |
| ------------------------------------------------------------- | ------------------------ | -------------- | ----------------------------------------- |
| A. Pages under `docs/`, and `CONTRIBUTING.md` for building    | ~800 words               | all, linked    | two places; a later docs site reuses them |
| B. Cut: `--help`, the skill, and the settings file's comments | ~800 words               | partly         | least                                     |
| C. One README, the reference folded in `<details>`            | short screen, long file  | all            | one place; still one long file            |

### The banner

How the banner looks. Throwaway prototypes are in [`mockups/`](mockups/).

| Option                                                     | Fits the UI's look | Motion                        | Size   |
| ---------------------------------------------------------- | ------------------ | ----------------------------- | ------ |
| A. The dot tree and the name in dots                       | yes                | none                          | ~7 KB  |
| B. A bordered pane, with the workflow's five steps as dots | yes, the pane      | none                          | ~9 KB  |
| C. A, with the tree growing row by row                     | yes                | once, off with reduced motion | ~11 KB |

### Installing the skill for Claude Code

How the README tells a Claude Code user to get the workflow.

| Option                                                               | New channel                                                   | Steps for a user   |
| -------------------------------------------------------------------- | ------------------------------------------------------------- | ------------------ |
| A. `ura install`, or `npx skills add mrtolkien/uraeda` without `ura` | no                                                            | one command        |
| B. A, plus a plugin marketplace: `/plugin marketplace add`           | yes, changes [distribution](/specs/decisions/distribution.md) | two slash commands |

### What "set up" means

Which items the onboarding lists.

| Option                                                                         | Matches the skill | Noise for a project without a UI |
| ------------------------------------------------------------------------------ | ----------------- | -------------------------------- |
| A. Constitution written, code-quality and testing decisions; preview optional  | yes               | none: preview is marked optional |
| B. Constitution written only                                                   | partly            | none                             |
| C. A, plus Claude Code available and the skill installed for the user's agents | yes, and more     | none                             |

### Where the onboarding shows

| Option                                                 | Visibility | Space on Home | Fits [look and feel](/specs/ui/look-and-feel.md) |
| ------------------------------------------------------ | ---------- | ------------- | ------------------------------------------------ |
| A. A Setup pane, first on Home, gone when complete     | high       | one pane      | yes, a pane like the others                      |
| B. A banner above Home, the list on the Decisions page | high       | one line      | banners are for state, not lists                 |
| C. A Setup page, linked from a banner on Home          | medium     | one line      | a page for a few lines                           |

### The CLI

Whether `ura status` shows the same items.

| Option                            | Parity               | Cost                       |
| --------------------------------- | -------------------- | -------------------------- |
| A. Yes, one line per missing item | the CLI and UI agree | small: the core's function |
| B. No                             | the UI only          | none                       |

### Needs no choice

- **A missing file links to an action**: every item leads to the one setup button; the agent picks
  up what is missing from the skill.
- **No dismiss**: the skill turns a "no" into a decision file, so every item can be completed;
  products drop the list as files appear.
- **No overwrite**: the skill already says "Never overwrite a file that exists".
- **Accessibility**: an item that turns done is a polite status, as the existing banners'
  `role="status"` does.
- **Locales, time, scale, offline**: none apply; the check reads a few files already watched.
- **Removal**: the onboarding disappears once complete, and the README is a file.

## Not checked

- How npmjs.com renders relative or SVG images: npmjs.com refused the fetch. It does not matter
  here, since the npm package ships its own README.
- Whether a `data:` font inside a README SVG passes GitHub's policy: the banner draws its letters as
  dots, so it needs none.
- Claude Code's sign-in state: no documented command reports it without starting a session.
- The original Art of README repository: gone; a fork was read.
