---
verdict: approved
commit: 70b6fd3
---

# Review: Spec, Nvim plugin

## C1: Lines 28–29, under "Spec: Nvim plugin"

> > - Moving a `PRIORITIES.md` line between sections, "set priority" from our chat, is out of scope:
> >   say so if you want it in.

I'd still want the LSP to give some info on priorities, is there a way to draw them specially to
show it's a special file?

## C2: Lines 33–39, under "Spec: Nvim plugin"

> Workflow files opened in Neovim get Uraeda's own language server: the rules of `ura check` as
> diagnostics while typing, frontmatter values completed, and questions and comments in the outline.
> A Lua plugin, in this repository's `editors/nvim/`, puts every action under `<leader>a`: drafting
> a `PRIORITIES.md` line, starting a draft as a feature, commenting on lines of a spec, picking a
> frontmatter value, approving, and committing drafts, with LazyVim's pickers. Neovim is the human's
> main editor, and the web UI is not where they write. See the [proposal](proposal.md),
> [discovery](discovery-01.md), and [clarifications](clarifications-01.md).

I also use the webui, I just like the idea of having an editor plugin too!
