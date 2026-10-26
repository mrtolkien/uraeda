---
verdict: changes-requested
commit: 3d3cdaa
---

# Review: Spec, Testing strategy review

## C1: Decision testing, lines 9–13, under "Testing"

> Tests let the project change with confidence: they are evidence of what the human asked for, never
> an authority over it. How much is tested follows the project's stage, now `early`: only what is
> costly to get wrong and rarely changes, such as stored formats, git, security, and the contracts
> between the core, the CLI, and the server. The web UI is not tested automatically: the human
> reviews it live in the sandbox.

They are not really evidence of what the human asked for??? Tests validate behaviour?

Evidence of what the human asked for is in the decisions and the code itself?

Also we shouldn't forbid ALL webUI tests I think, but they should be extremely useful if there are
any.

## C2: Decision testing, lines 22–23, under "Rules"

> - A test MUST assert behaviour a caller or a user can observe through a public interface, and MUST
>   NOT assert markup, class names, sizes, call sequences, or private state. Checked by review.

Feels overly specific?

## C3: Decision ui-checks, lines 15–16, under "Rules"

> - UI work MUST be checked by the human live, in the sandbox, against the spec and the decisions
>   the view follows. Checked by review.

Honestly that's not even really how I do it: I do multiple UI features together, I merge them, then
I do some quickfixing in a new session.

## C4: Decision ui-look, lines 22–23, under "Rules"

> - Every text colour MUST reach WCAG's contrast for text against its background, and borders and
>   controls its contrast for components, in every scheme. Checked by a test of the theme's tokens.

Feels too unspecific lol, how is the agent supposed to know which values this refers to...
