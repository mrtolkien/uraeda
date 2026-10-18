---
discovery: high # low, medium, or high: how far the agent researches before asking
---

# Diagram frames

## What

- Mermaid draws each diagram first in a temporary frame of the app origin that runs scripts, so a
  sanitiser bypass reaches the app despite the diagrams decision: running it in an opaque-origin
  frame needs the decision amended (strict level, as WebKit gives such frames no contentDocument)
  and the guard to allow Origin: null reads of /assets/*
- Diagram measures its width once: a diagram fixed by a live edit after failing never gets its
  keyboard-scrollable region
- Diagram frames: Mermaid working id can equal a heading anchor (diagram-_r_0_);
  allow-top-navigation-by-user-activation lets a diagram link replace the app tab; viewBox not
  clamped; no loading state; every frame titled "Diagram"; a failed draw can leave Mermaid temporary
  frame in the page

## Why

## Notes
