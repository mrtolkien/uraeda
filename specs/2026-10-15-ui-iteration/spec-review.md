---
verdict: changes-requested
commit: 14e951b
---

# Review: Spec, UI iteration flow

An important thing is phone vs desktop previews:

- On desktop it should be easy to look and test both
- For mobile I think we'll have to be happy with testing mostly mobile behaviour

Also will we be able to see the full, standard storybook UI? I feel like it could often be helpful
too!

## C1: Lines 20–21, under "Spec: UI iteration flow"

> > - **Nothing after the pull request**, as your note on "After the code" says. Fixes after the
> >   pull request still go through the session.

Actually you're right, it's not nothing-nothing: we should be able to have Storybooks embeds IN THE
CHAT, or at least be easy to open from the chat. How hard is it?

## C2: Lines 27–28, under "Spec: UI iteration flow"

> > - **A limit of that choice.** Stories run on 127.0.0.1, so they embed only on the computer that
> >   runs Uraeda, not from your phone.

This is not acceptable. The embeds should work remotely through tailscale. It's ok to change the
Origin rule to be a bit more lax, we will implement basic security soon enough.
