---
verdict: approved
commit: 936d31e
---

# Review: Spec, Claude Code runner (triggered manually)

## C1: Lines 27–29, under "Spec: Claude Code runner (triggered manually)"

> > - **Your note on models and effort, read one way.** The command-line tool cannot list its models
> >   without the SDK's undocumented protocol, so the choices are the aliases Claude Code documents.
> >   They are picked when the feature's first session starts.

Drop it then and use the active settings. Note that claude code will not be the recommended runner
in future features because it's hard to interoperate with it.

## C2: Lines 30–32, under "Spec: Claude Code runner (triggered manually)"

> > - **The SQLite cache you asked for** keeps session IDs, runs, and their parsed events, in the
> >   repository's git folder. It uses Node's built-in `node:sqlite`: no dependency, but a release
> >   candidate in Node 24.

Don't keep it in the repository's git folder, use an app data folder for uraeda based on OS defaults

## C3: Lines 35–36, under "Spec: Claude Code runner (triggered manually)"

> > - **The agent's messages show as plain text.** The stack decision forbids parsing markdown in
> >   the UI.

We'll allow it. It'll look much better.

## C4: General

You are allowed to use the local claude code install to test it out. Actual tests should use mocks,
but in the development process you are allowed to test the server code against the real, local
claude code.

And you should save those tests, maybe as "e2e tests" or "validation scripts", your call. But we'll
re-run them if the claude code integration breaks, to understand the issues.
