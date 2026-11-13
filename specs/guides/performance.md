# Performance

How Uraeda stays fast, and how to check that it does. The [Performance](../decisions/performance.md)
decision holds the boundaries: 100 ms, 120 frames a second, no loading state, and numbers that are
targets. This guide holds the habits that reach them. Read it before adding a page, a read, a write,
or anything that scrolls or streams.

## What the human asked for

The performance pass started from four lines:

> Performance pass: the UI feels sluggish
>
> - needs optimistic UI _everywhere_
> - needs caching of almost all values ahead of time
> - ideally locally no page takes more than 100ms to load
> - Moving a draft to a feature takes upwards of 10s with many page changes and no clear feedback

Then, asked how a feature should start: "I want to be able to fully start a feature, session in
included, and go continue working, without waiting at any point after finishing writing the
proposal."

The human notices a slow answer before anything else, and says so in a few words. These are what a
miss sounds like:

- "… can the leader menu appear instantly on status bar click?"
- "Ah, the picker at the top is a bit slow to move, that was the issue. Can the top change be
  instant?"
- "The keys and movement seem a bit sluggish. Can we make everything optimistic and changes async?"
- "Small question: right now the perf is _bad_: clicking a tab at the top or on the left feels
  sluggish."

A tab, a picker, a menu: the complaints are about small moves made hundreds of times a day, never
about a heavy page. Those are the ones to make instant first.

## The numbers

| What                                         | Target                        | Whose number           | Measured by             |
| -------------------------------------------- | ----------------------------- | ---------------------- | ----------------------- |
| A page drawn, or an action's result shown    | 100 ms, from the key or press | the human's            | `just bench-navigation` |
| A frame while scrolling or streaming         | 8.3 ms, 120 frames a second   | the human's            | `just frames <scene>`   |
| A reload                                     | 1 second                      | the performance pass's | `just bench-navigation` |
| The frame's 99th percentile, 20,000 messages | how the frame target is read  | the benchmark's        | `just frames <scene>`   |
| A warning in a development build             | past 100 ms, in the console   | the performance pass's | `app/ui/timing.ts`      |

The first two rows are rules. The others are how the project chose to read them: change them when a
better measure exists, and say so in the feature's spec.

## How a page stays fast

These are habits. Each one is the usual way to reach 100 ms, not the only one.

- **The server answers from what it has already read.** It reads git again only for what changed
  since. A page chains several reads, and one read of git per page is already too slow. The cost is
  stale data when a change is missed: knowing what a change makes stale is the core's job, and the
  one place where a test of the cache earns its keep.
- **The client keeps what it has shown.** A page seen once draws from memory the next time, and the
  old page stays until the new one draws. A change made outside the app, by an agent or by git,
  reaches the page through the server's live updates, never through a reload.
- **Keys count as much as clicks.** The page of the selected row is read ahead, so `Enter` finds it
  ready. Reading ahead on hover alone helps the mouse only: "Prefetch doesn't work well with
  keyboard navigation. Need a cache."
- **A write shows its result at once**, and the write runs behind it.
  [Space and motion](../ui/space-and-motion.md#speed) says how, and what a refusal does.
- **Heavy work is not in TSX.** Native Shell runs TSX in an interpreter, so parsing, diffing, and
  what runs on each key are Rust, as [Stack](../decisions/stack.md) says.
- **Glass and motion are paid in frames.** The [design language](../ui/design-language.md) says what
  glass may cost, and what goes first when a frame runs late.

## What may take longer

The human wants the UI "to feel instant, but we don't have to "lie" to the user". A commit runs the
user's hooks, and an agent takes minutes. Neither is hidden, and neither blocks: the result of the
human's act shows at once, the slow part shows its progress where it runs, and the human goes on
working. The commit toast is the model: it names what is landing, and nothing waits for it.

What this rules out is the middle ground: a page that shows a spinner, a bar, or a skeleton while it
reads what the app could have held. The human refused it in one line: "pages should simply ALL DRAW
in 100ms."

## How to measure

Both benchmarks run on demand, once, on a quiet machine. Neither is part of a check: timings vary
with the machine, and the numbers are targets.

- **`just bench-navigation`** presses the keys of a day's work over a fresh sandbox, with its chat
  of 20,000 messages. It prints, for each page and action, the time from the key to the frame that
  draws the result, against 100 ms, and a reload against 1 second. `just bench-navigation web` does
  the same in the web build, at a phone's size, on a slowed processor.
- **`just frames <scene>`** draws a scene of the gallery, `streaming`, `scrolling`, `glass`, or
  `reading`, and prints the median, the 95th and 99th percentiles, and the worst frame. It draws on
  the GPU's hidden display, at 120 Hz. With `software` it paints without a GPU, at 60 Hz: a frame's
  time there is not a GPU's.
- **A development build warns** in the console when a key or a navigation passes 100 ms, with what
  was done and how long it took. Read it while trying a change in the sandbox.

Run the benchmark that fits in a feature's review, when the feature adds a page, a read, a write, or
a moving view. Put a miss in the pull request, with its number, and in the record's follow-ups when
it stays.
