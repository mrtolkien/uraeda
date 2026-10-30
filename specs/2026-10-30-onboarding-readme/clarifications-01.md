---
status: answered
---

# Clarifications, round 01: Onboarding + README pass

> [!NOTE]
>
> Answered on 2026-10-30.
>
> - Verdict: worth building, with changes: only the web UI's sessions rely on Claude Code, and "not
>   ready" needs a definition the proposal leaves open.
> - Where the README's long reference goes decides how short it gets, and whether a docs folder
>   starts now.
> - The banner is a visual choice: three prototypes to open.
> - Which files count as "set up" and where Home shows them work together.
> - A Claude Code plugin marketplace would be a new way to ship Uraeda, changing the distribution
>   decision.
> - Check the Claude Code wording before the questions: the README cannot say Uraeda needs it.

## Context

### Goal

The [proposal](proposal.md) makes Uraeda easy for a human to start with. A short, appealing README
says what Uraeda is: a workflow first, then a CLI that enforces it, then a web UI that drives it.
The web UI shows which core files a project lacks. A visible "Set up project with agent" button on
Home opens a session with a pre-filled message.

### Today

- The [README](/README.md) is 3,515 words. About two thirds is reference: install methods, Tab
  completion, the web UI's flags, sign-in, the settings file, proxies, the CLI's commands, building
  from source.
- A repository without `specs/` shows one warning on Home, "No specs/ folder in …. Set Uraeda up
  with ura init.", with no button ([`Missing.tsx`](/packages/web/src/layout/Missing.tsx)).
- A repository after `ura init` looks ready on Home, though its constitution is still the template.
  Nothing computes whether a project is set up.
- The skill's [setup](/skills/uraeda/references/projects.md#setting-up-a-project) is the
  constitution, written with the human, then three decisions: code quality, testing, and preview for
  a project with a UI.
- The logo is a tree of 34 dots on an 8 × 8 grid ([`Logo.tsx`](/packages/web/src/Logo.tsx)).

| Product             | How setup is checked                        | How setup is done                               |
| ------------------- | ------------------------------------------- | ----------------------------------------------- |
| GitHub              | a list of files, "Added" or "Not added yet" | an Add button per file, opening a draft         |
| Claude Code `/init` | none                                        | writes `CLAUDE.md`, suggests edits if it exists |
| Spec Kit            | none                                        | a command fills the constitution's placeholders |
| Kiro                | none                                        | a "Generate Steering Docs" button               |
| Renovate            | its config file                             | an onboarding pull request to merge             |

### Scope

The README, a page or pages for what leaves it, a banner, the onboarding on Home, and its setup
button. Home's layout beyond the onboarding is the [review home](/specs/proposals/review-home.md)
proposal's. How the agent sets a project up stays the skill's, unchanged.

### Sources

- The README, Home ([`Home.tsx`](/packages/web/src/Home.tsx), [`home/`](/packages/web/src/home/)),
  the core's workspace and constitution readers, `ura init`, and the session pre-fill.
- READMEs of Claude Code, Codex, opencode, BMAD, uv, Spec Kit, superpowers, and Bun.
- GitHub's docs on READMEs, images, and community standards; MDN and W3C on SVG as an image.
- Claude Code's setup, skills, plugins, and deep links docs; Spec Kit, Kiro, Copilot, Vercel, and
  Netlify setup flows.
- NN/g on empty states and onboarding; Primer's blankslate and banner guidelines.
- The full investigation is in [discovery](discovery-01.md). Each question links to its topic.

## Check these

- **The Claude Code wording**: the README says the workflow works with any agent that reads Agent
  Skills. Only the web UI's sessions need a local, signed-in Claude Code, for now. The constitution
  requires the workflow to work with any agent
  ([principle V](/specs/CONSTITUTION.md#v-tools-are-optional)). See
  [discovery](discovery-01.md#relies-on-a-local-claude-code-install-only).
- **A project without `specs/`** gets the same setup button, in place of the "run ura init" warning.
  The agent creates the folder from the skill's templates, as `ura init` would. One path serves both
  cases. See [discovery](discovery-01.md#not-ready-to-be-used-with-uraeda).
- **A constitution counts as written** once no bracketed placeholder of the template is left, like
  `[Project]` or `[Principle name]`. A half-written one still shows as missing. See
  [discovery](discovery-01.md#important-reads).
- **The onboarding has no dismiss button.** Each item is done by a file, and a "no" to a decision is
  a decision file too, as the skill already records it. The onboarding disappears when the last item
  is done, as GitHub's checklist does. See [discovery](discovery-01.md#needs-no-choice).
- **The build waits for the performance pass to merge**: its plan changes the session start and the
  composer's pre-fill, which the setup button uses. See
  [discovery](discovery-01.md#the-proposals-path-and-existing-actions).

## Q1: Where does the README's long reference go?

Today's README holds install methods, Tab completion, the web UI's flags, sign-in, the settings
file, proxies, the CLI's commands, and building from source. Comparable tools keep it elsewhere:
Claude Code's README is 309 words, opencode's 456, Spec Kit's 1,364, each linking its docs. GitHub
says a README "should only contain information necessary for developers to get started". A docs
website is in the priorities' Next. More in [discovery](discovery-01.md#the-readmes-reference).

Why it matters: it sets how short the README gets, and whether the docs website later starts from
pages or from scratch.

- **A (recommended). Move the reference to a few pages under `docs/`, such as install, the web UI,
  and the CLI. Building from source goes to `CONTRIBUTING.md`. The README links them.**
  - [pro] the README reads in about 4 minutes, and nothing is lost.
  - [con] two places to keep up to date when a flag changes.
  - Why recommended: the shortest README that keeps every fact, and the pages can feed the docs
    website.
- **B. Cut the reference. `ura --help`, `uraeda --help`, the settings file's comments, and the skill
  cover what remains.**
  - [pro] the least to maintain.
  - [con] proxies, sign-in, and `devEngines` workarounds lose their only explanation.
- **C. Keep one README: a short first screen, with the reference folded in collapsible sections
  below.**
  - [pro] one file, and GitHub's outline still finds every heading.
  - [con] the file stays long, and folded sections hide what a search lands on.

**Answer:** A

## Q2: Which banner opens the README?

GitHub loads no font inside an SVG, so each prototype draws the name in dots, like the logo. Each
switches between Catppuccin's light and dark colours. Open each file to see it. Animation plays in a
README image, and a reader's reduced-motion setting turns it off. More in
[discovery](discovery-01.md#the-banner).

Why it matters: it is the first thing a visitor sees, and it sets the project's mark outside the
app.

- **A (recommended). The dot tree, then "URAEDA" in dots, on no background.**

  [Plain banner](mockups/banner-a-plain.svg)

  - [pro] reads at any width, and matches the logo exactly.
  - [con] says nothing of what Uraeda does.
  - Why recommended: the tagline under it says what Uraeda does, in text a screen reader reads.

- **B. A bordered pane, like the app's, with the tree and the name. Below them, the workflow's five
  steps as a row of dots joined by a line.**

  Pane banner (`mockups/banner-b-pane.svg`, deleted)

  - [pro] echoes the app's look and the workflow's steps.
  - [con] the steps' dots carry no labels, so they read as decoration.

- **C. A, with the tree growing from its trunk, then the name appearing, once, in about a second.**

  Growing banner (`mockups/banner-c-growing.svg`, deleted)

  - [pro] a small moment of life on the first screen.
  - [con] plays again at each page load.

**Answer:** A

## Q3: How does the README tell a Claude Code user to get the workflow?

Today, `ura install` installs the skill, and `npx skills add mrtolkien/uraeda` does it without
`ura`, for Claude Code and most agents. Claude Code also installs plugins from a marketplace, a
`marketplace.json` in a repository: superpowers ships that way. Uraeda's npm package already carries
a plugin, used by its sessions only. More in
[discovery](discovery-01.md#installing-the-skill-for-claude-code).

Why it matters: a marketplace is a new way to ship Uraeda, which the
[distribution](/specs/decisions/distribution.md) decision would have to cover and every release
would update.

- **A (recommended). Keep `ura install`, and `npx skills add mrtolkien/uraeda` without `ura`.**
  - [pro] nothing new to release; the same command serves every agent.
  - [con] Claude Code users run a shell command rather than a slash command.
  - Why recommended: the workflow is agent-neutral, and one install path is easier to keep right.
- **B. Add a Claude Code plugin marketplace to the repository, and lead with
  `/plugin marketplace add mrtolkien/uraeda` for Claude Code users.**
  - [pro] the install Claude Code users expect, with updates from Claude Code.
  - [con] a second channel in the distribution decision, and a version to keep in step.

**Answer:** A

## Q4: Which files must a project have to count as set up?

The skill's setup writes the constitution with the human. It then proposes a code-quality decision,
a testing decision, and, for a project with a UI, a preview decision. Nothing in a project says
whether it has a UI. How the list shows is Q5. More in
[discovery](discovery-01.md#what-set-up-means).

Example: a Django API without a UI, after `ura init`. Its constitution is the template, and
`specs/decisions/` is empty.

Why it matters: each item stays on Home until done. An item a project does not need is noise until
the human writes a "no" for it.

- **A (recommended). A written constitution, a code-quality decision, and a testing decision. A
  preview decision shows as optional, "for a project with a UI", and does not keep the list open.**
  - Example: the list shows three missing items and one optional; once the three exist, it goes.
  - [pro] the same files the skill's setup asks for.
  - [con] a preview item on a project without a UI, marked optional.
  - Why recommended: it follows the skill's setup exactly, so the button and the list agree.
- **B. A written constitution only.**
  - Example: the list shows one item, and goes once the constitution is written.
  - [pro] the least noise.
  - [con] the testing and code-quality decisions never get proposed unless the human asks.
- **C. A, plus Claude Code found on the machine, and the skill installed for the user's own
  agents.**
  - Example: A's items, plus "Claude Code not found" and "No skill for your agents".
  - [pro] covers everything a first run can miss.
  - [con] machine items mix with project items, and the skill check reads folders outside the
    project.

**Answer:** A

## Q5: Where does Home show what is missing?

Home has panes today: Problems, Needs you, In progress, then the inbox and the priorities. Empty
panes disappear. Products show a setup as a list of files with their state, and design systems keep
banners for one-line state, with at most two actions. Which items show is Q4. More in
[discovery](discovery-01.md#where-the-onboarding-shows).

Why it matters: it decides how visible the setup is, and what Home's layout makes room for.

- **A (recommended). A Setup pane, first on Home, listing each missing item with its state, and one
  primary button, "Set up with the agent". It disappears once complete.**
  - [pro] visible at once, and drawn like every other pane.
  - [con] pushes Needs you down while it shows.
  - Why recommended: a list belongs in a pane, and it leaves when the project is ready.
- **B. A banner at the top of Home, "3 setup files missing", with the button; the list itself on the
  Decisions page.**
  - [pro] one line on Home.
  - [con] the human leaves Home to learn what is missing.
- **C. A Setup page of its own, linked from a banner on Home.**
  - [pro] room to explain each file.
  - [con] a whole page for three lines, one more place to find.

**Answer:** A

## Q6: Does `ura status` show the same missing items?

`ura status` prints every feature and change today, and refuses without `specs/`. The check would
live in the core, so the CLI can print it at little cost. More in
[discovery](discovery-01.md#the-cli).

Why it matters: a CLI user would otherwise never learn the project is half set up.

- **A (recommended). Yes: `ura status` prints one line per missing item, after its list.**
  - [pro] the CLI and the web UI agree, and agents running `ura status` see it too.
  - [con] one more output line to keep stable for tools reading `--json`.
  - Why recommended: the workflow comes first, then the CLI, and the CLI should not know less than
    the web UI.
- **B. No: the web UI only.**
  - [pro] nothing changes in the CLI.
  - [con] the CLI says nothing about an unwritten constitution.

**Answer:** A

## Settled without the human

### Behaviour

- **The README's order** follows the proposal. First what Uraeda is: a workflow, then the CLI, then
  the web UI. Then one example from the todo app, getting started, and links. Detailed rules stay in
  the skill. See [discovery](discovery-01.md#readmes-of-comparable-tools).
- **Getting started** lists what to install, in order: the skill, `ura`, Claude Code with its paid
  plan, then the web UI. Then the first steps: add the repository, set it up, write a proposal. See
  [discovery](discovery-01.md#claude-code).
- **The setup button** fills the New page's composer with a short message naming the skill, and the
  human sends it, as a proposal's Start does. No agent starts unseen. See
  [discovery](discovery-01.md#products-that-set-a-project-up-with-an-agent).
- **The message** reads like the workflow's others:
  `/uraeda Set this project up for Uraeda: write what is missing, ask me before writing the constitution, never overwrite a file.`
  The skill holds the steps, so the message stays short. See
  [discovery](discovery-01.md#known-pitfalls-of-a-pre-filled-agent-prompt).
- **Without Claude Code**, the button gives way to the message to copy, as on the inbox and
  decisions pages. A link to Claude Code's install page comes with it. See
  [discovery](discovery-01.md#important-reads).
- **The setup session** runs in the main checkout and commits on the default branch, as `ura init`
  and every chat do. See [discovery](discovery-01.md#the-proposals-path-and-existing-actions).
- **The banner** uses GitHub's `<picture>` with a light and a dark file, which follows GitHub's
  theme in every browser, and its alt text is "Uraeda". See
  [discovery](discovery-01.md#svg-images-in-a-github-readme).
- **The npm package's README** stays short, with its links checked against the new README. See
  [discovery](discovery-01.md#svg-images-in-a-github-readme).

### Under the hood

- **The readiness check** lives in the core, next to the workspace reader. It reaches the web UI
  through the workspace view, so the rule has one home. See
  [discovery](discovery-01.md#rules-and-their-owners).
- **Tests** cover the core's check only, at the `early` stage: its cases are pure logic. The Home
  pane is reviewed in the sandbox. See [discovery](discovery-01.md#likely-changes).
- **The sandbox** gains a sample project without `specs/`; `empty` and `broken` already show an
  unwritten constitution. See [discovery](discovery-01.md#likely-changes).

**Notes:**
