---
verdict: approved
commit: fea8da8
---

# Review: Spec, Image attachments

## C1: Lines 18–21, under "Spec: Image attachments"

> > - Your image processing answer named sharp, on the server. This spec encodes in the Rust core
> >   with libwebp instead: your Neovim note needs encoding in `ura lsp`, which runs without Node,
> >   and libwebp gives the same bytes as sharp. It costs `ura` and the binding about 0.8 MB and a C
> >   compiler.

This seems reasonable. I have no attachement to "sharp", use what's best.

## C2: Lines 22–24, under "Spec: Image attachments"

> > - You suggested WebP or JPEG XL: WebP it is. Claude and Obsidian cannot read JPEG XL, and on 97
> >   screenshots near-lossless WebP took 25 % of the PNG size, while lossy WebP took more and
> >   blurred coloured text. Photos stay lossy.

We can be a bit lossy if the accuracy losses are reasonable compared to the file size gains. For
example if we can divide the size by two without losing accuracy on text, that would be ok. Make the
arbitrage when writing the plan. Near-lossless is ok if that's the best tradeoff.
