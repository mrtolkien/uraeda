# Documentation

How the README and the pages around it should read, and what goes where. Read it before changing
[`README.md`](/README.md), [`INSTALL.md`](/INSTALL.md), [`docs/`](/docs/), or
[`CONTRIBUTING.md`](/CONTRIBUTING.md), and before a feature that changes how Uraeda is installed,
configured, or used.

## Who reads it

> "Agents should pull the skill and read it, the README is not documentation for them."

Documentation is for people. An agent learns the workflow from [the skill](/skills/uraeda/SKILL.md),
which is its source of truth. Nothing here needs to be complete enough to follow the workflow from.
A page is good when a person finds what they came for without leaving it.

## The README

> "README should be short and easy to read. Use the Uraeda logo, make a small SVG banner for the
> intro, and make sure the README looks and reads _appealing_ to a human. It needs to be extremely
> clear what uraeda is: first of all a workflow. Then a CLI to enforce the workflow. Then a web UI
> to control the workflow."

The README is for someone discovering Uraeda. In order, it lets them understand it, see it, install
it, and start:

- **The order is the product's identity**: a workflow first, then `ura`, the CLI that enforces it,
  then the pages that drive it. The web UI of the quote is `ura serve`'s pages today, which are part
  of `ura`: since version 3, Uraeda has no app. A README that opens on `ura`, or lists the parts as
  equals, says something else about what Uraeda is.
- **It shows what a person will use**: the human once asked for screenshots of the app, "generated
  from the sandbox "realistic" env, for both 1440px and mobile". They went with the app. Pictures of
  `ura serve`'s pages, from `just sandbox`, would take their place, at a desk's width and a phone's,
  each showing what matters on its page: "Questions should show Q3 and not the start of the page".
- **Its install is a few commands**, and links the rest: "Quick install guidelines should be in the
  README.md. Very short guidelines though, with an extra INSTALL.md."
- **It says plainly what Uraeda needs and does not ship**. The proposal once asked to "Highlight
  that at the moment it relies on a local Claude Code install ONLY", when the app ran the agents.
  `ura` runs none now, so the README says that agents run in the person's own terminal or session
  host.
- **No flourish.** The human's edit of the first README, named "unslop readme", cut the tagline's
  gloss of the name and a paragraph on another product's plans. A line that does not help someone
  understand, install, or start goes.

## What goes where

| Page                         | Its reader              | It holds                                                          |
| ---------------------------- | ----------------------- | ----------------------------------------------------------------- |
| `README.md`                  | someone discovering it  | what Uraeda is, what it looks like, a quick install, how to start |
| `INSTALL.md`                 | someone installing it   | every way to install                                              |
| `docs/`                      | someone using it        | reference: the `ura` CLI and its pages, the `specs/` folder       |
| `CONTRIBUTING.md`            | someone building Uraeda | building, testing, releasing                                      |
| [the skill](/skills/uraeda/) | an agent                | the workflow, naming tools only as examples                       |

The README links the others, and holds none of their content beyond the quick install.

## Repeating is fine

> "I disagree: doc is here for readability and information, it can hold whatever it needs to hold.
> Docs is the only place where information duplication is ok."

Said against a first rule that kept the workflow's rules out of the documentation. A page repeats a
rule of the skill, or a fact of another page, wherever its reader needs it. A fact repeated costs
less than a link they must follow. The cost is a page that goes stale when the skill changes: a
change that makes a page wrong updates it in the same pull request.

It runs one way. The documentation may explain the workflow, and the skill never describes a tool's
screens: "The web ui is its own thing. Don't mix both." The skill names `ura`'s commands, and its
pages only as one way to answer.

## Habits and rules

- **Asked for by the human, in these words**: the README's order, the quick install with
  `INSTALL.md` beside it, pictures of what a person uses, and that repeating is fine.
- **Habits, to change when a better place appears**: the names of the other pages, and one page per
  tool under `docs/`.
