# Personas

The humans the UI is built for, each a way of using it end to end. Each is a real person, written
the way [_Laws of UX_](https://lawsofux.com/) describes a persona: who they are, how they work, what
they want and what frustrates them, in their own words where we have them. Each one's scenarios pair
a situation with what the persona expects in it. A view is finished when each of them can do
everything in it their own way.

A persona walkthrough picks one of them and plays their scenarios through the app, from a proposal
to a landed feature, staying in character: what the persona cannot do their way, or a scenario whose
expectation the app misses, is the finding.

## Tolki at the desk: the keyboard

> "If I reach for the mouse, the tool has failed."

**Who.** A solo senior developer, and Uraeda's author. A former professional esports player, with an
M.Sc. in computer science specialised in UX and machine learning, a former data analyst, and a
former CEO of a small company. Esports left them with muscle memory and no patience for input lag;
the UX training makes every inconsistency show; running a company taught them to delegate and review
rather than do.

**Setup.** A 27" 4K screen at 1.5× scaling, Uraeda full screen or in half of it, in a tiling window
manager, windows without decorations, and a light transparency. LazyVim every day.

**How they work.**

- Reads the Now priorities, writes proposals in detail, starts about four features in parallel, and
  leaves the desk.
- Comes back and answers every open question at once, in a batch, never one gate at a time.
- Keeps about four features in flight at any time.

**Goals.** A feature lands properly with the least input from them: "I feel productive when I can
focus on the big picture ideas, UI, and goals, and not get bogged down in small-scale Q&A due to
agents making wrong assumptions or doing messy work."

**Frustrations.** Q&A spent on small things that are not right everywhere, the UI first: a new
feature lands and is not reachable from the keyboard until they go back and ask for a change.

**What the UI owes them.**

- **Never the mouse.** Every view, every action, and every step of a flow is reachable and readable
  from the keyboard alone. A step that needs the mouse, or a long run of Tab, is a bug, and a new
  view or action ships with its keys, not after.
- **Coherence**: one key means one thing everywhere, and a key learned on one page works the same on
  the next. An Uraeda shortcut is simple to remember: few keys, mnemonic, and shown where they
  apply.
- **LazyVim's habits**: `j` `k` to move, `Space` as the leader, `g` to go, `Escape` to leave, Vim's
  keys in text fields. See [Keyboard](keyboard.md).
- **Any window**: the app looks right at full screen and tiled in a half or a third of it.
- **No lag**: a key answers within 100 ms, and what it shows is final, nothing jumping after.

**Scenarios.**

1. **Plan.** Tolki reads the Now priorities, writes about four detailed proposals, and starts each.
   _Expects_ to go from a priority to a running feature in a minute or two each, without the mouse.
2. **Answer in a batch.** Back at the desk, Tolki answers every open question across the features in
   one pass. _Expects_ each question to make sense on its own, its context in view, nothing to
   search for, and every agent to resume without further help.
3. **Approve and land.** Tolki reads a spec, then the finished feature. _Expects_ to approve or
   comment in place, try it live, and merge it without fixing small things by hand.

## Tolki on the phone: away from the desk

> "I can't smoothly do what I have in mind quickly: selecting and editing text, reading
> information."

**Who.** Tolki, between two sessions at the desk, checking on the features they left running.

**Setup.** An iPhone 18 Pro Max, 440 × 956 pt, with the app added to the home screen and opened full
screen: the Dynamic Island, the screen's rounded corners, and the home indicator cut into the page.
See [the phone](phone.md).

**When and where.**

- **In the train, in the morning**, where the connection drops now and then.
- **In the afternoon, with their son napping on them**: one hand, no room to shift, sound off.

**How they work.** Everything but reviewing stories, which is too fiddly on a phone: reading the
inbox and the features' progress, answering questions, writing proposals, reading specs and plans,
and looking at big-picture mockups.

**Frustrations.** The selection dies, the window moves under the thumb, the text box is out of
reach.

**What the UI owes them.**

- **Nothing under the edges**: no control sits under the Dynamic Island, the rounded corners, or the
  home indicator, and no bar pads by more than the safe area needs: a bar's bottom room is the safe
  area's inset, not an inset on top of a margin.
- **Text input stays in view**: a field being typed in is never hidden by the keyboard, a bar, or a
  sheet; what was typed is never lost to a scroll, a dropped connection, or a reload; a text
  selection survives until the human lets it go.
- **One thumb**: targets large enough for a thumb, spaced apart, with icons that say what they do,
  one obvious action per step, and the common ones in the thumb's reach.
- **Still works narrower**: 390 pt is the narrowest phone every view must still work at.

**Scenarios.**

1. **Check in.** On the train, Tolki opens the app. _Expects_ to see in a few seconds which features
   wait on them and which are still working.
2. **Answer one-handed.** With their son asleep on them, Tolki answers a round's questions.
   _Expects_ to read each, select and quote text, and type an answer with one thumb, the page never
   jumping, the answer kept if the connection drops.
3. **Propose.** On the train, Tolki writes a new proposal and starts it. _Expects_ the same flow as
   at the desk, the field and its button above the keyboard throughout.

## Lolly: the mouse, on a desktop

> "Where do I click to start a feature?"

**Who.** Tolki's wife, a project manager with an M.Sc. in UI/UX design. Tech literate, but she has
not written code in 20 years: no terminal, no IDE, no git.

**Setup.** A MacBook Air M1, Chrome full screen.

**How she works.** About once a week, on her own projects, mostly web apps for her own use. She has
no backlog: she comes in, writes a feature proposal, and starts it straight away. She is there for
the human gates, answering questions and approving the spec, and expects the rest to happen without
her.

**Goals.** The feature lands well, coherent with the rest of her app, and she never has to come back
to Uraeda to fix it.

**Frustrations.** Above everything, wasted time and half-done work. Poor UX, poor visual hierarchy,
laggy interfaces, and unclear actions, which her design training spots at once.

**What the UI owes her.**

- **Clicks through the UI**, and uses the keyboard only to type text.
- **No developer's words or habits**: nothing assumes she knows git's, Vim's, or a shell's words. A
  key shown as a hint is never the only way: each has a button.
- **Clear buttons**: what can be clicked looks clickable, its label says what it does, and it is
  large enough to hit without aiming. See [Look and feel](look-and-feel.md).
- **The next step is obvious**: each page's primary action stands out, and an empty page says what
  to do.

**Scenarios.**

1. **Start a feature.** Lolly opens the app after a week away. _Expects_ to see where to write a
   proposal and how to start it, without looking for it.
2. **Pass a gate.** Lolly answers the agent's questions, then reads and approves the spec. _Expects_
   questions in her words, no jargon, and one clear button to send or approve.
3. **See it land.** Lolly opens her app with the feature in it. _Expects_ it to look and behave like
   the rest of the app, nothing left to fix.
